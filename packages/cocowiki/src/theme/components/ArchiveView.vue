<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive } from 'vue'
import { useRouter, withBase } from 'vitepress'
import { useContentStore } from '../content'
import ContentStatus from './ContentStatus.vue'
import { pageStatuses, statusLabel } from '../../shared/status'
import { browseRecords, readBrowseFilters } from '../browse'
import { archiveGroups } from '../archive'

const filters = reactive({ query: '', category: '', status: '', tags: [] as string[] })
const router = useRouter()
let previous: typeof router.onAfterRouteChange
let installed: typeof router.onAfterRouteChange
const { records, loading, error, retry } = useContentStore()
const archive = computed(() => records.value.filter((record) => {
  if (record.archive === false) return false
  return !['home', 'search', 'archive'].includes(record.layout || '')
}))
const groups = computed(() => archiveGroups(browseRecords(records.value, filters)))
const categories = computed(() => [...new Set(archive.value.map(page => page.category || page.type).filter((name): name is string => Boolean(name)))].sort((a, b) => a.localeCompare(b, 'zh-CN')))
const tags = computed(() => [...new Set(archive.value.flatMap(page => page.tags || []))].sort((a, b) => a.localeCompare(b, 'zh-CN')))
const activeCount = computed(() => Number(Boolean(filters.query)) + Number(Boolean(filters.category)) + Number(Boolean(filters.status)) + filters.tags.length)
const total = computed(() => groups.value.reduce((count, [, pages]) => count + pages.length, 0))
function writeFilters(replace = false) {
  const url = new URL(location.href)
  for (const field of ['q', 'category', 'tag', 'status']) url.searchParams.delete(field)
  if (filters.status) url.searchParams.set('status', filters.status)
  if (filters.query) url.searchParams.set('q', filters.query)
  if (filters.category) url.searchParams.set('category', filters.category)
  filters.tags.forEach(tag => url.searchParams.append('tag', tag))
  if (url.href !== location.href) history[replace ? 'replaceState' : 'pushState'](history.state || {}, '', url)
}
function toggleTag(tag: string) {
  filters.tags = filters.tags.includes(tag) ? filters.tags.filter(value => value !== tag) : [...filters.tags, tag]
  writeFilters()
}
function removeFilter(field: 'query' | 'category' | 'status') { filters[field] = ''; writeFilters() }
function clear() { Object.assign(filters, { query: '', category: '', status: '', tags: [] }); writeFilters() }
onMounted(() => {
  const sync = (href: string) => Object.assign(filters, readBrowseFilters(href))
  sync(location.href)
  previous = router.onAfterRouteChange
  const existing = previous || router.onAfterRouteChanged
  installed = async href => { sync(href); await existing?.(href) }
  router.onAfterRouteChange = installed
})
onUnmounted(() => { if (router.onAfterRouteChange === installed) router.onAfterRouteChange = previous })
</script>

<template>
  <div class="cw-archive">
    <header>
      <div><h1>浏览全部资料。</h1><p>按分类浏览 {{ archive.length }} 份记录，或直接输入名称。</p></div>
      <label><svg class="cw-search-icon" aria-hidden="true" viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4"/></svg><span class="cw-sr-only">在归档中筛选</span><input v-model="filters.query" @input="writeFilters(true)" type="search" placeholder="在归档中筛选"></label>
    </header>
    <div class="cw-archive-filters" role="group" aria-label="归档筛选">
      <div class="cw-archive-controls">
      <label><span>分类</span><select v-model="filters.category" @change="writeFilters()"><option value="">全部分类</option><option v-for="category in categories" :key="category" :value="category">{{ category }}</option></select></label>
      <label><span>状态</span><select v-model="filters.status" @change="writeFilters()"><option value="">全部状态</option><option value="needs-attention">待维护</option><option v-for="(info, status) in pageStatuses" :key="status" :value="status">{{ info.label }}</option></select></label>
      </div>
      <div class="cw-archive-tags"><span>标签</span><div class="cw-tags" aria-label="按标签组合筛选"><button v-for="tag in tags" :key="tag" type="button" :aria-pressed="filters.tags.includes(tag)" @click="toggleTag(tag)">{{ tag }}</button></div></div>
      <div class="cw-archive-selection">
        <span role="status">{{ total }} 条结果</span>
        <div v-if="activeCount" class="cw-selected-filters" aria-label="已选条件">
          <button v-if="filters.query" type="button" :aria-label="`移除关键词：${filters.query}`" @click="removeFilter('query')">{{ filters.query }} <span aria-hidden="true">×</span></button>
          <button v-if="filters.category" type="button" :aria-label="`移除分类：${filters.category}`" @click="removeFilter('category')">{{ filters.category }} <span aria-hidden="true">×</span></button>
          <button v-if="filters.status" type="button" :aria-label="`移除状态：${filters.status === 'needs-attention' ? '待维护' : statusLabel(filters.status)}`" @click="removeFilter('status')">{{ filters.status === 'needs-attention' ? '待维护' : statusLabel(filters.status) }} <span aria-hidden="true">×</span></button>
          <button v-for="tag in filters.tags" :key="tag" type="button" :aria-label="`移除标签：${tag}`" @click="toggleTag(tag)">{{ tag }} <span aria-hidden="true">×</span></button>
          <button type="button" class="cw-clear-filters" @click="clear">清除筛选</button>
        </div>
      </div>
    </div>
    <ContentStatus :loading="loading" :error="error" @retry="retry" />
    <section v-for="([name, items]) in groups" :key="name" class="cw-archive-group">
      <div class="cw-archive-group__title"><h2>{{ name }}</h2><small>{{ items.length }} 个条目</small></div>
      <div class="cw-archive-list">
        <a v-for="item in items" :key="item.route" :href="withBase(item.route)">
          <div><strong>{{ item.title }} <small v-if="item.status" class="cw-status-chip">{{ statusLabel(item.status) }}</small></strong><span v-if="item.aliases?.length">又名 {{ item.aliases.join('、') }}</span></div>
          <p>{{ item.description }}</p><b aria-hidden="true">›</b>
        </a>
      </div>
    </section>
    <div v-if="!loading && !error && !groups.length" class="cw-empty"><strong>没有匹配的词条</strong><p>清除筛选后查看全部归档。</p></div>
  </div>
</template>
