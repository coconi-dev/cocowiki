import fg from 'fast-glob'
import matter from 'gray-matter'
import { createFilter } from 'vite'
import { readFile, stat } from 'node:fs/promises'
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
type GitRunner = (args: string[], cwd: string) => Promise<string>
const runGit: GitRunner = async (args, cwd) => (await exec('git', args, { cwd })).stdout

/** A scanner owns parsed pages and Git dates for one content root. */
export function createContentScanner(contentRoot: string, git: GitRunner = runGit) {
  let cached = new Map<string, { page: ContentPage; signature: string }>()
  const dates = new Map<string, number | undefined>()
  let revision: string | undefined
  let historyInvalidated = false
  let initialized = false
  let failed = false

  async function signature(file: string) {
    try {
      const info = await stat(file, { bigint: true })
      return info.isFile() ? `${info.ino}:${info.size}:${info.mtimeNs}:${info.ctimeNs}` : 'directory'
    } catch (error) {
      if (['ENOENT', 'ENOTDIR'].includes((error as NodeJS.ErrnoException).code || '')) return 'missing'
      throw error
    }
  }
  async function gitTime(file: string) {
    if (!revision) return undefined
    if (dates.has(file)) return dates.get(file)
    try {
      const stdout = await git(['log', '-1', '--format=%ct', '--', basename(file)], resolve(file, '..'))
      const time = Number(stdout.trim()) > 0 ? Number(stdout.trim()) * 1000 : undefined
      dates.set(file, time)
      return time
    } catch { return undefined }
  }

  async function scan(options: { include?: string[]; exclude?: string[] } = {}, changedFiles?: ReadonlySet<string>): Promise<ContentPage[]> {
    const previousFailure = failed
    failed = true
    let nextRevision: string | undefined
    try { nextRevision = (await git(['rev-parse', 'HEAD'], contentRoot)).trim() || undefined } catch {}
    const historyChanged = historyInvalidated || nextRevision !== revision
    historyInvalidated = false
    if (historyChanged) dates.clear()
    revision = nextRevision
    const changed = new Set<string>()
    for (const file of changedFiles || []) {
      const path = relative(contentRoot, file).replace(/\\/g, '/')
      if (path && !path.startsWith('..')) changed.add(path.replace(/\.page\.json$/, '.page.vue'))
    }
    const discover = !initialized || previousFailure || historyChanged || changedFiles === undefined || [...changed].some(path => !/(?:\.md|\.page\.vue)$/.test(path))
    const filenames = discover
      ? await fg(['**/*.md', '**/*.page.vue'], { cwd: contentRoot, onlyFiles: true })
      : [...new Set([...cached.keys(), ...changed])]
    const included = createFilter(options.include || ['**/*.md', '**/*.page.vue', '**/*.page.json'], undefined, { resolve: false })
    const excluded = options.exclude?.length ? createFilter(options.exclude, undefined, { resolve: false }) : () => false
    const next = new Map<string, { page: ContentPage; signature: string }>()

    async function readPage(path: string) {
      const sourcePath = resolve(contentRoot, path)
      const kind = path.endsWith('.page.vue') ? 'vue' : 'markdown'
      const metadataPath = sourcePath.replace(/\.page\.vue$/, '.page.json')
      const prior = cached.get(path)
      const check = discover || changed.has(path) || !prior
      const sourceSignature = check ? await signature(sourcePath) : undefined
      if (sourceSignature === 'missing' || sourceSignature === 'directory') return
      const metadataSignature = kind === 'vue' ? (check ? await signature(metadataPath) : prior!.signature.split('|')[1]) : ''
      const hasMetadata = kind === 'vue' && metadataSignature !== 'missing'
      const currentSignature = check ? `${sourceSignature}|${metadataSignature}` : prior!.signature
      let page = prior?.page
      if (!prior || prior.signature !== currentSignature) {
        let raw: unknown, content = '', sourceContent = '', heading: string | undefined
        try {
          if (kind === 'vue') raw = hasMetadata ? JSON.parse(await readFile(metadataPath, 'utf8')) : {}
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
        page = {
          ...meta, id: route, route, sourcePath, kind, sourceContent, frontmatter: meta as Record<string, unknown>,
          generatedPath: path.replace(/\.page\.vue$/, '.md'),
          title: meta.title || heading || basename(path).replace(/(?:\.page\.vue|\.md)$/, ''),
          layout: kind === 'vue' ? 'special' : meta.layout,
          description: meta.description || '', tags: meta.tags || [], aliases: meta.aliases || [], contributors: meta.contributors || [],
          content: kind === 'vue' ? meta.description || '' : content,
          excerpt: meta.description || content.slice(0, 120), searchable: true
        }
      }
      const identities = kind === 'vue' ? [path, path.replace(/\.page\.vue$/, '.page.json')] : [path]
      const searchable = page!.search !== false && options.include?.length !== 0 && !identities.some(excluded) && identities.some(included)
      let lastUpdated = page!.lastUpdated
      if (previousFailure || historyChanged || !prior || prior.signature !== currentSignature) {
        const times = await Promise.all([gitTime(sourcePath), ...(hasMetadata ? [gitTime(metadataPath)] : [])])
        lastUpdated = page!.updated ? Date.parse(page!.updated) : Math.max(0, ...times.map(time => time || 0)) || undefined
      }
      if (page!.searchable !== searchable || page!.lastUpdated !== lastUpdated) page = { ...page!, searchable, lastUpdated }
      next.set(path, { page: page!, signature: currentSignature })
    }
    // Bound cold Git lookups; ordinary edits reuse dates and unchanged pages.
    const sorted = filenames.sort()
    for (let i = 0; i < sorted.length; i += 8) {
      const results = await Promise.allSettled(sorted.slice(i, i + 8).map(readPage))
      const failure = results.find(result => result.status === 'rejected')
      if (failure?.status === 'rejected') throw failure.reason
    }
    const records = sorted.flatMap(path => next.has(path) ? [next.get(path)!.page] : [])
    validateIdentities(records)
    cached = next
    initialized = true
    failed = false
    return records.sort((a, b) => a.title.localeCompare(b.title, 'zh-CN'))
  }
  return { scan, invalidateGit() { dates.clear(); historyInvalidated = true } }
}

/** One-shot scanner for builds and callers without a development session. */
export async function scanContent(contentRoot: string, options: { include?: string[]; exclude?: string[] } = {}) {
  return createContentScanner(contentRoot).scan(options)
}

function validateIdentities(records: ContentPage[]) {
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
}

export function publicRecords(pages: ContentPage[]) {
  return pages.map(({ sourcePath, generatedPath, sourceContent, frontmatter, kind, ...record }) => record)
}
