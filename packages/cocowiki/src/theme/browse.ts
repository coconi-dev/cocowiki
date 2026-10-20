import type { ContentRecord } from '../shared/content'
export interface BrowseFilters { query: string; category: string; tags: string[]; status?: string }
export function readBrowseFilters(href: string): BrowseFilters {
  const url = new URL(href, 'https://cocowiki.invalid')
  return { status: url.searchParams.get('status') || '', query: url.searchParams.get('q') || '', category: url.searchParams.get('category') || '', tags: [...new Set(url.searchParams.getAll('tag').filter(Boolean))] }
}
export function browseUrl(filters: Partial<BrowseFilters>) {
  const params = new URLSearchParams()
  if (filters.query) params.set('q', filters.query)
  if (filters.status) params.set('status', filters.status)
  if (filters.category) params.set('category', filters.category)
  for (const tag of [...new Set(filters.tags || [])]) params.append('tag', tag)
  return `/archive${params.size ? '?' + params : ''}`
}
export function browseRecords(records: readonly ContentRecord[], filters: BrowseFilters) {
  const needle = filters.query.trim().toLocaleLowerCase()
  return records.filter(page => page.archive !== false && !['home', 'search', 'archive'].includes(page.layout || '')
    && (!filters.status || (filters.status === 'needs-attention' ? ['draft', 'incomplete', 'outdated'].includes(page.status || '') : page.status === filters.status))
    && (!filters.category || (page.category || page.type) === filters.category)
    && filters.tags.every(tag => page.tags?.includes(tag))
    && (!needle || [page.title, page.description, page.content, ...(page.tags || []), ...(page.aliases || [])].join(' ').toLocaleLowerCase().includes(needle)))
}
