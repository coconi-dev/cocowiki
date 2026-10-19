<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, shallowRef } from 'vue'
import { useRouter, withBase } from 'vitepress'
import type { SearchRecord } from '../../node/content'
import { loadSearchContent } from '../content'
import { createSearch } from '../search'

const emit = defineEmits<{ close: [] }>()
const query = ref('')
const loadFailed = ref(false)
const dialog = ref<HTMLElement>()
const input = ref<HTMLInputElement>()
let previousFocus: HTMLElement | null = null
let previousOverflow = ''
const router = useRouter()
const searchable = shallowRef<SearchRecord[]>([])
const miniSearch = shallowRef<ReturnType<typeof createSearch>>()
const results = computed(() => {
  if (!query.value.trim()) return searchable.value.slice(0, 5)
  return miniSearch.value?.search(query.value, { combineWith: 'AND' }).slice(0, 6) || []
})
function go(route: string) { emit('close'); router.go(withBase(route)) }
function keydown(event: KeyboardEvent) {
  if (event.key === 'Escape') { event.preventDefault(); emit('close'); return }
  if (event.key !== 'Tab') return
  const elements = Array.from(dialog.value?.querySelectorAll<HTMLElement>('input, button, a[href]') || [])
  const first = elements[0]
  const last = elements[elements.length - 1]
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
}
onMounted(async () => {
  previousFocus = document.activeElement as HTMLElement | null
  previousOverflow = document.body.style.overflow
  document.body.style.overflow = 'hidden'
  window.addEventListener('keydown', keydown)
  await nextTick()
  input.value?.focus()
  try {
    const content = await loadSearchContent()
    searchable.value = content.records
    miniSearch.value = content.index
  } catch {
    loadFailed.value = true
  }
})
onUnmounted(() => {
  window.removeEventListener('keydown', keydown)
  document.body.style.overflow = previousOverflow
  previousFocus?.focus()
})
</script>

<template>
  <div class="cw-search-overlay" role="dialog" aria-modal="true" aria-label="搜索资料库" @click.self="$emit('close')">
    <div ref="dialog" class="cw-search-dialog">
      <div class="cw-search-dialog__input">
        <svg class="cw-search-icon" aria-hidden="true" viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4"/></svg>
        <input ref="input" v-model="query" aria-label="搜索资料库" type="search" placeholder="搜索资料库" @keydown.enter.prevent="results[0] && go(results[0].route)">
        <button class="cw-search-close" type="button" aria-label="关闭搜索" @click="emit('close')">×</button>
      </div>
      <div class="cw-search-dialog__results">
        <button v-for="item in results" :key="item.route" @click="go(item.route)"><span>{{ item.category || item.type }}</span><strong>{{ item.title }}</strong><small>{{ item.description }}</small></button>
        <p v-if="loadFailed">搜索暂时不可用，请关闭后重试。</p>
        <p v-else-if="!results.length">没有找到相关记录</p>
      </div>
      <button class="cw-search-dialog__all" @click="go(`/search?q=${encodeURIComponent(query)}`)">查看全部搜索结果 <span>→</span></button>
    </div>
  </div>
</template>
