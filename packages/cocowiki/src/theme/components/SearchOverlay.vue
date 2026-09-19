<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, shallowRef } from 'vue'
import { useRouter, withBase } from 'vitepress'
import type { SearchRecord } from '../../node/content'
import { loadSearchContent } from '../content'
import { createSearch } from '../search'

const emit = defineEmits<{ close: [] }>()
const query = ref('')
const router = useRouter()
const searchable = shallowRef<SearchRecord[]>([])
const miniSearch = shallowRef<ReturnType<typeof createSearch>>()
const results = computed(() => {
  if (!query.value.trim()) return searchable.value.slice(0, 5)
  return miniSearch.value?.search(query.value, { combineWith: 'AND' }).slice(0, 6) || []
})
function go(route: string) { emit('close'); router.go(withBase(route)) }
function keydown(event: KeyboardEvent) { if (event.key === 'Escape') emit('close') }
onMounted(async () => {
  window.addEventListener('keydown', keydown)
  const content = await loadSearchContent()
  searchable.value = content.records
  miniSearch.value = content.index
})
onUnmounted(() => window.removeEventListener('keydown', keydown))
</script>

<template>
  <div class="cw-search-overlay" role="dialog" aria-modal="true" aria-label="搜索资料库" @click.self="$emit('close')">
    <div class="cw-search-dialog">
      <div class="cw-search-dialog__input"><span>⌕</span><input v-model="query" autofocus type="search" placeholder="搜索人物、物品、概念……"><kbd>ESC</kbd></div>
      <div class="cw-search-dialog__results">
        <button v-for="item in results" :key="item.route" @click="go(item.route)"><span>{{ item.category || item.type }}</span><strong>{{ item.title }}</strong><small>{{ item.description }}</small></button>
        <p v-if="!results.length">没有找到相关记录</p>
      </div>
      <button class="cw-search-dialog__all" @click="go(`/search?q=${encodeURIComponent(query)}`)">查看全部搜索结果 <span>→</span></button>
    </div>
  </div>
</template>
