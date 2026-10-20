import { existsSync, statSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { dirname, extname, relative, resolve } from 'node:path'
import matter from 'gray-matter'
import { createMarkdownRenderer } from 'vitepress'
import type { CocoWikiConfig } from '../config'
import type { ContentPage } from '../shared/content'
import { canonicalRoute, normalizeBase, routeFromPath } from '../shared/routes'
import { scanContent } from './content'
import { pageResolver } from './relations'
import { resolveProjectPaths } from './project'
import { applyCocoWikiMarkdown } from './markdown'

export interface QualityIssue { code: string; file: string; line: number; target: string; message: string }
const isFile = (file: string) => { try { return statSync(file).isFile() } catch { return false } }
const external = (target: string) => /^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(target)

/** Static maintenance checks; does not execute Vue expressions or fetch remote URLs. */
export async function checkContent(config: CocoWikiConfig, projectRoot: string): Promise<QualityIssue[]> {
  const paths = resolveProjectPaths(projectRoot, config)
  const pages = await scanContent(paths.contentDir, config.search, config.markdown)
  const byRoute = new Map(pages.map(page => [page.route, page]))
  const resolvePage = pageResolver(pages)
  const issues: QualityIssue[] = []
  const add = (code: string, file: string, line: number, target: string, message: string) => issues.push({ code, file: relative(projectRoot, file).replace(/\\/g, '/'), line, target, message })
  const profilesFile = resolve(paths.dataDir, 'contributors.json')
  const profiles = existsSync(profilesFile) ? JSON.parse(await readFile(profilesFile, 'utf8')) : {}
  const md = await createMarkdownRenderer(paths.contentDir, { config(md) { applyCocoWikiMarkdown(md, pages, { ...config.markdown, base: normalizeBase(config.base) }) } })
  const anchorCache = new Map<string, Set<string>>()
  async function anchors(page: ContentPage) {
    if (anchorCache.has(page.route)) return anchorCache.get(page.route)!
    const source = page.kind === 'markdown' ? page.document?.source || matter(page.sourceContent).content : await readFile(page.sourcePath, 'utf8')
    const ids = new Set<string>()
    if (page.kind === 'markdown') for (const token of md.parse(source, {})) {
      const id = token.attrGet('id')
      if (id) ids.add(id)
      if (token.type === 'html_block') for (const match of token.content.matchAll(/\bid=["']([^"']+)["']/g)) ids.add(match[1])
      for (const child of token.children || []) if (child.type === 'html_inline') for (const match of child.content.matchAll(/\bid=["']([^"']+)["']/g)) ids.add(match[1])
    }
    else for (const match of source.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').matchAll(/\bid=["']([^"']+)["']/g)) ids.add(match[1])
    anchorCache.set(page.route, ids)
    return ids
  }
  const base = normalizeBase(config.base)
  async function checkLink(page: ContentPage, target: string, line: number, image = false, file = page.sourcePath) {
    if (!target || external(target)) return
    let url: URL, pathname: string
    try {
      url = new URL(target, `https://cocowiki.invalid${page.route}`)
      pathname = decodeURIComponent(url.pathname)
    } catch { add('invalid-url', file, line, target, '无效的本地 URL'); return }
    if (base !== '/' && pathname.startsWith(base)) pathname = '/' + pathname.slice(base.length)
    const authoredPath = decodeURIComponent(target.split(/[?#]/)[0])
    const localFile = authoredPath.startsWith('/') ? resolve(paths.contentDir, pathname.slice(1)) : resolve(dirname(page.sourcePath), authoredPath)
    const publicFile = resolve(paths.publicDir, pathname.slice(1))
    let destination = byRoute.get(canonicalRoute(pathname))
    if (/\.(?:md|page\.vue)$/.test(pathname)) destination = byRoute.get(routeFromPath(relative(paths.contentDir, localFile)))
    if (image || (!destination && extname(pathname) && !/\.(?:html|md|page\.vue)$/.test(pathname))) {
      if (!isFile(localFile) && !isFile(publicFile)) add(image ? 'missing-image' : 'missing-file', file, line, target, image ? '本地图片不存在' : '本地资源不存在')
      return
    }
    if (!destination) {
      if (!isFile(localFile) && !isFile(publicFile)) add('missing-page', file, line, target, '站内页面不存在')
      return
    }
    if (url.hash) {
      let id: string
      try { id = decodeURIComponent(url.hash.slice(1)) } catch { add('missing-anchor', file, line, target, '锚点编码无效'); return }
      if (!(await anchors(destination)).has(id)) add('missing-anchor', file, line, target, '目标页面中没有此锚点')
    }
  }
  for (const page of pages) {
    const metadataFile = page.kind === 'vue' ? page.sourcePath.replace(/\.vue$/, '.json') : page.sourcePath
    for (const name of page.contributors || []) if (!Object.hasOwn(profiles, name)) add('unknown-contributor', metadataFile, 1, name, '贡献者未在 contributors.json 登记')
    if (page.maintenance?.owner && !Object.hasOwn(profiles, page.maintenance.owner)) add('unknown-maintainer', metadataFile, 1, page.maintenance.owner, '维护者未在 contributors.json 登记')
    for (const target of page.related || []) if (!resolvePage(target)) add('unresolved-related', metadataFile, 1, target, '手动关联词条不存在')
    if (config.markdown?.wikiLink !== false) for (const link of page.analysis?.wiki || []) if (!resolvePage(link.target)) add('unresolved-wiki', link.file || page.sourcePath, link.line + (link.file ? 0 : sourceOffset(page)), link.target, 'Wiki 目标未解析，访问时将跳转搜索')
    for (const link of page.analysis?.links || []) await checkLink(page, link.target, link.line + (link.file ? 0 : sourceOffset(page)), link.image, link.file || page.sourcePath)
    if (page.image) await checkLink(page, page.image, 1, true, metadataFile)
  }
  const first = pages.find(page => page.route === '/') || pages[0]
  if (first) {
    const context = { ...first, route: '/', sourcePath: resolve(paths.contentDir, 'index.md') }
    const file = resolve(projectRoot, 'cocowiki.config.ts')
    const navigation = async (items: NonNullable<CocoWikiConfig['navigation']>) => {
      for (const item of items) { if (item.link) await checkLink(context, item.link, 1, false, file); if (item.items) await navigation(item.items) }
    }
    await navigation(config.navigation || [])
    for (const action of config.home?.actions || []) await checkLink(context, action.link, 1, false, file)
    for (const image of [config.logo, config.favicon, config.home?.visual?.image]) if (image) await checkLink(context, image, 1, true, file)
  }
  return [...new Map(issues.map(issue => [`${issue.file}:${issue.line}:${issue.code}:${issue.target}`, issue])).values()].sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line || a.code.localeCompare(b.code))
}
function sourceOffset(page: ContentPage) {
  return page.sourceContent.split('\n').length - matter(page.sourceContent).content.split('\n').length
}
