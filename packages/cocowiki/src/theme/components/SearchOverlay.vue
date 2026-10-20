<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRouter, withBase } from 'vitepress'
import { useSearchStore } from '../content'
import { searchDocuments } from '../search'
import SearchHighlight from './SearchHighlight.vue'
import ContentStatus from './ContentStatus.vue'

const emit = defineEmits<{ close: [] }>()
const query = ref('')
const active = ref(0)
const dialog = ref<HTMLElement>()
const input = ref<HTMLInputElement>()
let previousFocus: HTMLElement | null = null
let previousOverflow = ''
const router = useRouter()
const { searchable, index: miniSearch, loading, error, retry } = useSearchStore()
const results = computed(() => {
  if (!query.value.trim()) return searchable.value.slice(0, 5)
  return searchDocuments(miniSearch.value, query.value).slice(0, 6)
})
watch(results, () => { active.value = 0 })
function go(route: string) { emit('close'); router.go(withBase(route)) }
function keydown(event: KeyboardEvent) {
  if (event.key === 'Escape') { event.preventDefault(); emit('close'); return }
  if (event.target === input.value && !event.isComposing) {
    if (['ArrowDown', 'ArrowUp'].includes(event.key) && results.value.length) {
      event.preventDefault()
      active.value = (active.value + (event.key === 'ArrowDown' ? 1 : -1) + results.value.length) % results.value.length
      void nextTick(() => document.getElementById(`cw-search-option-${active.value}`)?.scrollIntoView({ block: 'nearest' }))
      return
    }
    if (event.key === 'Enter') { event.preventDefault(); if (results.value[active.value]) go(results.value[active.value].route); return }
  }
  if (event.key !== 'Tab') return
  const elements = Array.from(dialog.value?.querySelectorAll<HTMLElement>('input, button, a[href]') || [])
  const focusable = elements.filter(element => element.tabIndex >= 0 && !element.hasAttribute('disabled'))
  const first = focusable[0]
  const last = focusable[focusable.length - 1]
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
        <input ref="input" v-model="query" aria-label="搜索资料库" type="search" placeholder="搜索资料库" role="combobox" aria-autocomplete="list" aria-controls="cw-search-options" :aria-expanded="true" :aria-activedescendant="results.length ? `cw-search-option-${active}` : undefined">
        <button class="cw-search-close" type="button" aria-label="关闭搜索" @click="emit('close')">×</button>
      </div>
      <div class="cw-search-dialog__results">
        <div id="cw-search-options" role="listbox" aria-label="搜索结果">
        <button v-for="(item, index) in results" :key="item.route" :id="`cw-search-option-${index}`" role="option" :aria-selected="active === index" tabindex="-1" @mousemove="active = index" @click="go(item.route)"><span>{{ item.category || item.type }}</span><strong><SearchHighlight :text="item.title" :query="query" /></strong><small><SearchHighlight :text="item.description || ''" :query="query" /></small></button>
        </div>
        <ContentStatus :loading="loading" :error="error" @retry="retry" />
        <p v-if="!loading && !error && !results.length">没有找到相关记录，试试更短的关键词，或查看完整搜索页。</p>
      </div>
      <button class="cw-search-dialog__all" @click="go(`/search?q=${encodeURIComponent(query)}`)">查看全部搜索结果 <span>→</span></button>
    </div>
  </div>
</template>
