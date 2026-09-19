import { withBase } from 'vitepress'
import type { SearchRecord } from '../node/content'
import { createSearch } from './search'

let recordsPromise: Promise<SearchRecord[]> | undefined
let searchPromise: Promise<{ records: SearchRecord[]; index: ReturnType<typeof createSearch> }> | undefined

function resetContentCache() {
  recordsPromise = undefined
  searchPromise = undefined
}

if (import.meta.hot) import.meta.hot.on('cocowiki:content-updated', resetContentCache)

export function loadContentRecords() {
  if (!recordsPromise) {
    recordsPromise = fetch(withBase('/search-index.json'), { cache: 'no-store' })
      .then((response) => {
        if (!response.ok) throw new Error(`无法加载搜索索引：${response.status}`)
        return response.json() as Promise<SearchRecord[]>
      })
      .catch((error) => {
        recordsPromise = undefined
        throw error
      })
  }
  return recordsPromise
}

export function loadSearchContent() {
  if (!searchPromise) {
    searchPromise = loadContentRecords().then((allRecords) => {
      const records = allRecords.filter((record) => record.search !== false && !['/', '/search', '/archive'].includes(record.route))
      return { records, index: createSearch(records) }
    }).catch((error) => {
      searchPromise = undefined
      throw error
    })
  }
  return searchPromise
}
