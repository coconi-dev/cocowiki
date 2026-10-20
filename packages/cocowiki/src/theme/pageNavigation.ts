import type { ContentRecord } from '../shared/content'

const excludedLayouts = new Set(['home', 'search', 'archive', 'contributors'])

function readingOrder(record: ContentRecord) {
  return typeof record.order === 'number' && Number.isFinite(record.order) ? record.order : Infinity
}

/** Keep search/archive ordering independent of the document reading sequence. */
export function navigationRecords(records: ContentRecord[]): ContentRecord[] {
  return records
    .filter(record => record.search !== false && !excludedLayouts.has(record.layout || ''))
    .sort((a, b) => {
      const left = readingOrder(a)
      const right = readingOrder(b)
      if (left !== right) return left < right ? -1 : 1
      return a.title.localeCompare(b.title, 'zh-CN') || a.route.localeCompare(b.route, 'en')
    })
}
