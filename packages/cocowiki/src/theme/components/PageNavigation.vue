<script setup lang="ts">
import { computed, onMounted, onUnmounted, shallowRef } from 'vue'
import { useRoute, withBase } from 'vitepress'
import type { SearchRecord } from '../../node/content'
import { loadContentRecords } from '../content'
import { navigationRecords } from '../pageNavigation'

const route = useRoute()
const records = shallowRef<SearchRecord[]>([])
const currentIndex = computed(() => records.value.findIndex((record) => withBase(record.route) === route.path.replace(/\.html$/, '').replace(/\/$/, '') || (route.path === '/' && record.route === '/')))
const previous = computed(() => currentIndex.value > 0 ? records.value[currentIndex.value - 1] : undefined)
const next = computed(() => currentIndex.value >= 0 && currentIndex.value < records.value.length - 1 ? records.value[currentIndex.value + 1] : undefined)

let active = false
let loadVersion = 0
async function refreshNavigation() {
  const version = ++loadVersion
  try {
    const content = await loadContentRecords()
    if (active && version === loadVersion) records.value = navigationRecords(content)
  } catch {
    // Navigation is optional; do not leave stale links after a failed refresh.
    if (active && version === loadVersion) records.value = []
  }
}
onMounted(() => {
  active = true
  void refreshNavigation()
  import.meta.hot?.on('cocowiki:content-updated', refreshNavigation)
})
onUnmounted(() => {
  active = false
  import.meta.hot?.off('cocowiki:content-updated', refreshNavigation)
})
</script>

<template>
  <nav v-if="previous || next" class="cw-page-navigation" aria-label="相邻页面">
    <a v-if="previous" :href="withBase(previous.route)"><small>上一篇</small><strong>← {{ previous.title }}</strong></a>
    <span v-else></span>
    <a v-if="next" :href="withBase(next.route)"><small>下一篇</small><strong>{{ next.title }} →</strong></a>
  </nav>
</template>
