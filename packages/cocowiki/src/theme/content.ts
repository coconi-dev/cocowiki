import { computed, onMounted, readonly, shallowReadonly, shallowRef, ref } from 'vue'
import { withBase } from 'vitepress'
import initialDirectory from 'virtual:cocowiki-directory'
import { isSearchable, type ContentDirectory, type ContentRecord, type PageSummary, type SearchPayload } from '../shared/content'
import type { createSearch } from './search'

const directory = shallowRef<ContentDirectory>(initialDirectory)
const records = computed(() => directory.value.records)
const version = computed(() => directory.value.version)
const loading = ref(false)
const error = shallowRef<Error>()
let requestVersion = 0
let pending: Promise<PageSummary[]> | undefined
let loaded = Boolean(initialDirectory.version)
const searchRecords = shallowRef<ContentRecord[]>([])
const searchable = computed(() => searchRecords.value.filter(isSearchable))
const index = shallowRef<ReturnType<typeof createSearch>>()
const searchLoading = ref(false)
const searchError = shallowRef<Error>()
let searchUsed = false, searchVersion = '', searchRequest = 0
let searchPending: { version: string; task: Promise<{ records: ContentRecord[]; index: ReturnType<typeof createSearch> }> } | undefined
const asError = (error: unknown) => error instanceof Error ? error : new Error(String(error))

export function refreshContent(force = true): Promise<PageSummary[]> {
  if (!force && pending) return pending
  if (!force && loaded) return Promise.resolve(records.value)
  const current = ++requestVersion
  loading.value = true; error.value = undefined
  const task = fetch(withBase('/content-directory.json'), { cache: 'no-store' })
    .then(response => {
      if (!response.ok) throw new Error(`无法加载页面目录：${response.status}`)
      return response.json() as Promise<ContentDirectory>
    })
    .then(next => {
      if (!next.version || !Array.isArray(next.records) || !next.searchUrl) throw new Error('页面目录格式无效')
      if (current === requestVersion) {
        directory.value = next; loaded = true
        // Never expose an index from another directory version.
        if (searchVersion !== next.version) { index.value = undefined; searchRecords.value = [] }
        if (searchUsed) void loadSearchContent().catch(() => {})
      }
      return next.records
    })
    .catch(caught => { if (current === requestVersion) error.value = asError(caught); throw caught })
    .finally(() => { if (current === requestVersion) { loading.value = false; pending = undefined } })
  pending = task
  return task
}
export function useContentStore() {
  onMounted(() => { void refreshContent(false).catch(() => {}) })
  return { records, loading: readonly(loading), error: readonly(error), version, retry: () => { void refreshContent().catch(() => {}) } }
}
export const loadContentRecords = () => refreshContent(false)
export async function loadSearchContent(): Promise<{ records: ContentRecord[]; index: ReturnType<typeof createSearch> }> {
  searchUsed = true
  await loadContentRecords()
  const target = directory.value
  if (index.value && searchVersion === target.version) return { records: searchable.value, index: index.value }
  if (searchPending?.version === target.version) return searchPending.task
  const current = ++searchRequest
  searchLoading.value = true; searchError.value = undefined
  const task = (async () => {
    const response = await fetch(withBase(target.searchUrl))
    if (!response.ok) throw new Error(`无法加载搜索正文：${response.status}，请刷新重试`)
    const payload = await response.json() as SearchPayload
    if (payload.version !== target.version) throw new Error('目录与搜索正文版本不一致，请刷新重试')
    const { createSearch } = await import('./search')
    if (current !== searchRequest || directory.value.version !== target.version) return loadSearchContent()
    const selected = payload.records.filter(isSearchable)
    const built = createSearch(selected)
    searchRecords.value = selected; index.value = built; searchVersion = target.version
    return { records: selected, index: built }
  })().catch(caught => { if (current === searchRequest) searchError.value = asError(caught); throw caught })
    .finally(() => { if (current === searchRequest) { searchLoading.value = false; searchPending = undefined } })
  searchPending = { version: target.version, task }
  return task
}
export function useSearchStore() {
  onMounted(() => { void loadSearchContent().catch(() => {}) })
  return { searchable, index: shallowReadonly(index), loading: computed(() => searchLoading.value || (!index.value && !searchError.value && !error.value)), error: computed(() => searchError.value || error.value), version, retry: () => { void refreshContent().then(() => loadSearchContent()).catch(() => {}) } }
}
if (import.meta.hot) import.meta.hot.on('cocowiki:content-updated', () => { void refreshContent().catch(() => {}) })
