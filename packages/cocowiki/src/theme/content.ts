import { withBase } from 'vitepress'
import type { SearchRecord } from '../node/content'

let recordsPromise: Promise<SearchRecord[]> | undefined

export function loadContentRecords() {
  if (!recordsPromise) {
    recordsPromise = fetch(withBase('/search-index.json'))
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
