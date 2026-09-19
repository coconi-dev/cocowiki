<script setup lang="ts">
import { computed, onMounted, ref, shallowRef } from 'vue'
import { withBase } from 'vitepress'
import type { SearchRecord } from '../../node/content'
import { loadContentRecords } from '../content'
import { createSearch } from '../search'

type SearchResultRecord = SearchRecord & { contributorNames?: string[] }

const query = ref('')
const type = ref('all')
const records = ref<SearchRecord[]>([])
const searchable = computed(() => records.value.filter((record) => record.search !== false && !['/', '/search', '/archive'].includes(record.route)))
const miniSearch = shallowRef<ReturnType<typeof createSearch>>()

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

onMounted(async () => {
  query.value = new URLSearchParams(location.search).get('q') || ''
  records.value = await loadContentRecords()
  miniSearch.value = createSearch(searchable.value)
})
</script>

<template>
  <div class="cw-explorer">
    <header class="cw-explorer__header">
      <p class="cw-kicker">GLOBAL SEARCH · 全文检索</p>
      <h1>从一个名字开始。</h1>
      <div class="cw-explorer__search"><span>⌕</span><input v-model="query" autofocus type="search" placeholder="搜索标题、别名、标签与正文"></div>
    </header>
    <div class="cw-explorer__body">
      <aside class="cw-filter-panel">
        <p>筛选范围</p>
        <button :class="{ active: type === 'all' }" @click="type = 'all'"><span>全部资料</span><b>{{ searchable.length }}</b></button>
        <button v-for="name in types" :key="name" :class="{ active: type === name }" @click="type = name"><span>{{ name }}</span></button>
      </aside>
      <section class="cw-results">
        <div class="cw-results__summary"><strong>{{ results.length }}</strong> 条结果 <span v-if="query">关于“{{ query }}”</span></div>
        <a v-for="item in results" :key="item.id" class="cw-result" :href="withBase(item.route as string)">
          <div class="cw-result__meta"><span>{{ item.category || item.type || '资料' }}</span><small>{{ item.route }}</small></div>
          <h2>{{ item.title }}</h2>
          <p>{{ item.description }}</p>
          <blockquote v-if="query">命中：{{ matchSnippet(item as SearchResultRecord, query) }}</blockquote>
        </a>
        <div v-if="!results.length" class="cw-empty"><strong>没有找到相关记录</strong><p>换一个名字、别名或更短的关键词试试。</p></div>
      </section>
    </div>
  </div>
</template>
