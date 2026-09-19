<script setup lang="ts">
import { computed, onMounted, ref, shallowRef } from 'vue'
import { withBase } from 'vitepress'
import type { SearchRecord } from '../../node/content'
import { loadContentRecords } from '../content'

const query = ref('')
const records = shallowRef<SearchRecord[]>([])
const archive = computed(() => records.value.filter((record) => {
  if (record.archive === false) return false
  return !['home', 'search', 'archive'].includes(record.layout || '')
}))
const groups = computed(() => {
  const needle = query.value.trim().toLocaleLowerCase()
  const filtered = archive.value.filter((item) => !needle || [item.title, item.description, item.content, item.type, item.category, ...(item.aliases || []), ...(item.tags || [])].join(' ').toLocaleLowerCase().includes(needle))
  const grouped = filtered.reduce<Record<string, typeof filtered>>((result, item) => {
    const name = item.category || item.type || '未分类'
    ;(result[name] ||= []).push(item)
    return result
  }, {})
  return Object.entries(grouped)
    .sort(([a], [b]) => a.localeCompare(b, 'zh-CN'))
})

onMounted(async () => { records.value = await loadContentRecords() })
</script>

<template>
  <div class="cw-archive">
    <header>
      <div><p class="cw-kicker">ARCHIVE INDEX · 全部词条</p><h1>归档索引</h1><p>按分类浏览 {{ archive.length }} 份记录，或直接输入名称。</p></div>
      <label><span>⌕</span><input v-model="query" type="search" placeholder="在归档中筛选"></label>
    </header>
    <section v-for="([name, items], groupIndex) in groups" :key="name" class="cw-archive-group">
      <div class="cw-archive-group__title"><span>0{{ groupIndex + 1 }}</span><h2>{{ name }}</h2><small>{{ items?.length }} ENTRIES</small></div>
      <div class="cw-archive-list">
        <a v-for="item in items" :key="item.route" :href="withBase(item.route)">
          <div><strong>{{ item.title }}</strong><span v-if="item.aliases?.length">又名 {{ item.aliases.join('、') }}</span></div>
          <p>{{ item.description }}</p><b>↗</b>
        </a>
      </div>
    </section>
    <div v-if="!groups.length" class="cw-empty"><strong>没有匹配的词条</strong><p>清除筛选后查看全部归档。</p></div>
  </div>
</template>
