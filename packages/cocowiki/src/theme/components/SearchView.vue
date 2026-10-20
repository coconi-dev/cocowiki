<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRouter, withBase } from 'vitepress'
import type { ContentRecord } from '../../shared/content'
import { useContentStore } from '../content'
import ContentStatus from './ContentStatus.vue'

type SearchResultRecord = ContentRecord & { contributorNames?: string[] }

const query = ref('')
const router = useRouter()
let previousNavigationHook: typeof router.onAfterRouteChange
let installedNavigationHook: typeof router.onAfterRouteChange
const type = ref('all')
const { searchable, index: miniSearch, loading, error, retry } = useContentStore()

const types = computed(() => [...new Set(searchable.value.map((item) => item.category || item.type).filter((value): value is string => Boolean(value)))])
const results = computed(() => {
  const found = query.value.trim()
    ? miniSearch.value?.search(query.value, { combineWith: 'AND' }) || []
    : searchable.value.map((item) => ({ ...item, id: item.route, score: 0 }))
  return found.filter((item) => type.value === 'all' || item.category === type.value || item.type === type.value)
})

function snippet(content = '', needle = '') {
  const plain = content.replace(/\s+/g, ' ')
  const index = plain.toLocaleLowerCase().indexOf(needle.toLocaleLowerCase())
  if (index < 0) return plain.slice(0, 110)
  return `${index > 35 ? '…' : ''}${plain.slice(Math.max(0, index - 35), index + needle.length + 65)}${index + needle.length + 65 < plain.length ? '…' : ''}`
}

function matchSnippet(item: SearchResultRecord, needle: string) {
  const names = item.contributorNames || item.contributors || []
  const contributorMatch = names.some((name) => name.toLocaleLowerCase().includes(needle.toLocaleLowerCase()))
  return contributorMatch ? `贡献者：${names.join('、')}` : snippet(item.content, needle)
}

onMounted(() => {
  const syncQuery = (href: string) => { query.value = new URL(href, location.href).searchParams.get('q') || '' }
  syncQuery(location.href)
  previousNavigationHook = router.onAfterRouteChange
  const previous = previousNavigationHook || router.onAfterRouteChanged
  installedNavigationHook = async (href) => {
    syncQuery(href)
    await previous?.(href)
  }
  router.onAfterRouteChange = installedNavigationHook
})
onUnmounted(() => {
  if (router.onAfterRouteChange === installedNavigationHook) router.onAfterRouteChange = previousNavigationHook
})
</script>

<template>
  <div class="cw-explorer">
    <header class="cw-explorer__header">

      <h1>搜索资料库</h1>
      <div class="cw-explorer__search"><svg class="cw-search-icon" aria-hidden="true" viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4"/></svg><label class="cw-sr-only" for="page-search">搜索资料库</label><input id="page-search" v-model="query" autofocus type="search" placeholder="搜索标题、别名、标签与正文"></div>
    </header>
    <div class="cw-explorer__body">
      <nav class="cw-filter-panel" aria-label="按分类筛选">
        <button :class="{ active: type === 'all' }" :aria-pressed="type === 'all'" @click="type = 'all'"><span>全部资料</span><b>{{ searchable.length }}</b></button>
        <button v-for="name in types" :key="name" :class="{ active: type === name }" :aria-pressed="type === name" @click="type = name"><span>{{ name }}</span></button>
      </nav>
      <section class="cw-results">
        <ContentStatus :loading="loading" :error="error" @retry="retry" />
        <div class="cw-results__summary" role="status"><strong>{{ results.length }}</strong> 条结果 <span v-if="query">关于“{{ query }}”</span></div>
        <a v-for="item in results" :key="item.id" class="cw-result" :href="withBase(item.route as string)">
          <div class="cw-result__meta"><span>{{ item.category || item.type || '资料' }}</span></div>
          <h2>{{ item.title }}</h2>
          <p>{{ item.description }}</p>
          <blockquote v-if="query">{{ matchSnippet(item as SearchResultRecord, query) }}</blockquote>
        </a>
        <div v-if="!loading && !error && !results.length" class="cw-empty"><strong>没有找到相关记录</strong><p>换一个名字、别名或更短的关键词试试。</p></div>
      </section>
    </div>
  </div>
</template>
