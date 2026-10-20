import type { ContentRecord } from '../shared/content'

export function archiveGroups(records: readonly ContentRecord[], query = '') {
  const needle = query.trim().toLocaleLowerCase()
  const grouped = new Map<string, ContentRecord[]>()
  for (const item of records) {
    if (item.archive === false || ['home', 'search', 'archive'].includes(item.layout || '')) continue
    if (needle && ![item.title, item.description, item.content, item.type, item.category, ...(item.aliases || []), ...(item.tags || [])].join(' ').toLocaleLowerCase().includes(needle)) continue
    const name = item.category || item.type || '未分类'
    const group = grouped.get(name) || []
    group.push(item)
    grouped.set(name, group)
  }
  return [...grouped].sort(([a], [b]) => a.localeCompare(b, 'zh-CN'))
}
