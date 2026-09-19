import fg from 'fast-glob'
import matter from 'gray-matter'
import { readFile } from 'node:fs/promises'
import { relative, sep } from 'node:path'
import type { CocoWikiPageMeta } from '../config.ts'

export interface SearchRecord extends CocoWikiPageMeta {
  id: string
  route: string
  content: string
  excerpt: string
}

function plainText(markdown: string) {
  return markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/\[\[([^\]]+)\]\]/g, '$1')
    .replace(/[#>*_`~|:-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function routeFromFile(contentRoot: string, filename: string) {
  const path = relative(contentRoot, filename).split(sep).join('/').replace(/(?:\.page\.json|\.md)$/, '')
  return path === 'index' ? '/' : `/${path.replace(/\/index$/, '')}`
}

function recordFromMeta(filename: string, contentRoot: string, meta: Partial<CocoWikiPageMeta>, content = '') {
  const route = routeFromFile(contentRoot, filename)
  return {
    id: route,
    route,
    title: meta.title || route.split('/').pop() || 'Untitled',
    layout: meta.layout,
    description: meta.description || '',
    type: meta.type || '',
    category: meta.category || '',
    tags: meta.tags || [],
    aliases: meta.aliases || [],
    contributors: meta.contributors || [],
    image: meta.image,
    updated: meta.updated,
    search: meta.search,
    archive: meta.archive,
    content,
    excerpt: meta.description || content.slice(0, 120)
  } satisfies SearchRecord
}

export async function scanContent(
  contentRoot: string,
  options: { include?: string[]; exclude?: string[] } = {}
): Promise<SearchRecord[]> {
  const filenames = await fg(options.include || ['**/*.md'], {
    cwd: contentRoot,
    absolute: true,
    ignore: options.exclude || []
  })

  const pageMetadata = await fg('**/*.page.json', {
    cwd: contentRoot,
    absolute: true,
    ignore: options.exclude || []
  })

  const records = await Promise.all(filenames.map(async (filename) => {
    const source = await readFile(filename, 'utf8')
    const parsed = matter(source)
    const content = plainText(parsed.content)
    const firstHeading = parsed.content.match(/^#\s+(.+)$/m)?.[1]?.trim()
    const meta = parsed.data as Partial<CocoWikiPageMeta>

    return recordFromMeta(filename, contentRoot, { ...meta, title: meta.title || firstHeading }, content)
  }))

  const vuePageRecords = await Promise.all(pageMetadata.map(async (filename) => {
    const meta = JSON.parse(await readFile(filename, 'utf8')) as Partial<CocoWikiPageMeta>
    return recordFromMeta(filename, contentRoot, meta, meta.description || '')
  }))

  return [...records, ...vuePageRecords]
    .sort((a, b) => a.title.localeCompare(b.title, 'zh-CN'))
}
