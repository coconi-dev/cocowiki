import fg from 'fast-glob'
import matter from 'gray-matter'
import { createFilter } from 'vite'
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { basename, relative, resolve } from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import type { ContentPage } from '../shared/content'
import { routeFromPath } from '../shared/routes'
import { ContentError, validateMeta } from './validation'
export type { ContentPage, ContentRecord, SearchRecord } from '../shared/content'
const exec = promisify(execFile)

function visibleMarkdown(markdown: string) {
  return markdown
    .replace(/^([ \t]*)(`{3,}|~{3,})[^\n]*\n[\s\S]*?^\1\2[ \t]*$/gm, ' ')
    .replace(/<(script|style)\b[^>]*>[\s\S]*?(?:<\/\1\s*>|$)/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
}
function plainText(markdown: string) {
  return markdown.replace(/<[^>]+>/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/\[\[([^\]]+)\]\]/g, '$1').replace(/[#>*_`~|:-]/g, ' ').replace(/\s+/g, ' ').trim()
}
async function gitTime(file: string): Promise<number | undefined> {
  try {
    const { stdout } = await exec('git', ['log', '-1', '--format=%ct', '--', basename(file)], { cwd: resolve(file, '..') })
    return Number(stdout.trim()) > 0 ? Number(stdout.trim()) * 1000 : undefined
  } catch { return undefined }
}

/** Scan all real pages. Search globs only annotate search eligibility. */
export async function scanContent(contentRoot: string, options: { include?: string[]; exclude?: string[] } = {}): Promise<ContentPage[]> {
  const filenames = await fg(['**/*.md', '**/*.page.vue'], { cwd: contentRoot, onlyFiles: true })
  const included = createFilter(options.include || ['**/*.md', '**/*.page.vue', '**/*.page.json'], undefined, { resolve: false })
  const excluded = options.exclude?.length ? createFilter(options.exclude, undefined, { resolve: false }) : () => false
  const records: ContentPage[] = []
  for (const path of filenames.sort()) {
    const sourcePath = resolve(contentRoot, path)
    const kind = path.endsWith('.page.vue') ? 'vue' : 'markdown'
    const metadataPath = sourcePath.replace(/\.page\.vue$/, '.page.json')
    const identities = kind === 'vue' ? [path, path.replace(/\.page\.vue$/, '.page.json')] : [path]
    let raw: unknown, content = '', sourceContent = '', heading: string | undefined
    try {
      if (kind === 'vue') raw = existsSync(metadataPath) ? JSON.parse(await readFile(metadataPath, 'utf8')) : {}
      else {
        sourceContent = await readFile(sourcePath, 'utf8')
        const parsed = matter(sourceContent)
        raw = parsed.data
        const visible = visibleMarkdown(parsed.content)
        content = plainText(visible)
        heading = visible.match(/^#\s+(.+)$/m)?.[1]?.trim()
      }
    } catch (error) { throw new ContentError(kind === 'vue' ? metadataPath : sourcePath, 'metadata', String(error)) }
    const meta = validateMeta(raw, kind === 'vue' ? metadataPath : sourcePath)
    const route = routeFromPath(path)
    const times = await Promise.all([gitTime(sourcePath), ...(kind === 'vue' && existsSync(metadataPath) ? [gitTime(metadataPath)] : [])])
    const timestamp = Math.max(0, ...times.map(time => time || 0)) || undefined
    records.push({
      ...meta, id: route, route, sourcePath, kind, sourceContent, frontmatter: meta as Record<string, unknown>,
      generatedPath: path.replace(/\.page\.vue$/, '.md'),
      title: meta.title || heading || basename(path).replace(/(?:\.page\.vue|\.md)$/, ''),
      layout: kind === 'vue' ? 'special' : meta.layout,
      description: meta.description || '', tags: meta.tags || [], aliases: meta.aliases || [], contributors: meta.contributors || [],
      content: kind === 'vue' ? meta.description || '' : content,
      excerpt: meta.description || content.slice(0, 120),
      searchable: meta.search !== false && options.include?.length !== 0 && !identities.some(excluded) && identities.some(included),
      lastUpdated: meta.updated ? Date.parse(meta.updated) : timestamp
    })
  }
  const routes = new Map<string, ContentPage>()
  const names = new Map<string, ContentPage>()
  for (const page of records) {
    const prior = routes.get(page.route)
    if (prior) throw new ContentError(page.sourcePath, 'route', `路由 ${page.route} 与 ${prior.sourcePath} 冲突`)
    routes.set(page.route, page)
    for (const name of new Set([page.title, ...(page.aliases || [])])) {
      const previous = names.get(name)
      if (previous && previous !== page) throw new ContentError(page.sourcePath, 'title/aliases', `名称“${name}”与 ${previous.sourcePath} 冲突`)
      names.set(name, page)
    }
  }
  return records.sort((a, b) => a.title.localeCompare(b.title, 'zh-CN'))
}

export function publicRecords(pages: ContentPage[]) {
  return pages.map(({ sourcePath, generatedPath, sourceContent, frontmatter, kind, ...record }) => record)
}
