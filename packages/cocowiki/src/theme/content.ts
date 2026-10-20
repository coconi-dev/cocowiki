import { computed, onMounted, readonly, shallowReadonly, shallowRef, ref } from 'vue'
import { withBase } from 'vitepress'
import type { ContentRecord } from '../shared/content'
import { createSearch } from './search'

const records = shallowRef<ContentRecord[]>([])
const loading = ref(false)
const error = shallowRef<Error>()
const version = ref(0)
let requestVersion = 0
let pending: Promise<ContentRecord[]> | undefined
let loaded = false
const searchable = computed(() => records.value.filter(record => record.searchable !== false && record.search !== false && !['home', 'search', 'archive', 'contributors'].includes(record.layout || '')))
const index = computed(() => createSearch(searchable.value))

export function refreshContent(force = true): Promise<ContentRecord[]> {
  if (!force && pending) return pending
  if (!force && loaded) return Promise.resolve(records.value)
  const current = ++requestVersion
  loading.value = true
  error.value = undefined
  const task = fetch(withBase('/search-index.json'), { cache: 'no-store' })
    .then(response => {
      if (!response.ok) throw new Error(`无法加载内容索引：${response.status}`)
      return response.json() as Promise<ContentRecord[]>
    })
    .then(next => {
      if (current === requestVersion) {
        // Build before committing so consumers never observe a broken index.
        createSearch(next.filter(record => record.searchable !== false && record.search !== false))
        records.value = next
        loaded = true
        version.value++
      }
      return next
    })
    .catch(caught => {
      if (current === requestVersion) error.value = caught instanceof Error ? caught : new Error(String(caught))
      throw caught
    })
    .finally(() => { if (current === requestVersion) { loading.value = false; pending = undefined } })
  pending = task
  return task
}
export function useContentStore() {
  onMounted(() => { void refreshContent(false).catch(() => {}) })
  return { records: shallowReadonly(records), searchable, index, loading: readonly(loading), error: readonly(error), version: readonly(version), retry: () => { void refreshContent().catch(() => {}) } }
}
export const loadContentRecords = () => refreshContent(false)
export async function loadSearchContent() {
  await loadContentRecords()
  return { records: searchable.value, index: index.value }
}
if (import.meta.hot) import.meta.hot.on('cocowiki:content-updated', () => { void refreshContent().catch(() => {}) })
