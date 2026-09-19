<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, withBase } from 'vitepress'
import type { SearchRecord } from '../../node/content'
import { loadContentRecords } from '../content'

const route = useRoute()
const records = ref<SearchRecord[]>([])
const currentIndex = computed(() => records.value.findIndex((record) => record.route === route.path.replace(/\.html$/, '').replace(/\/$/, '') || (route.path === '/' && record.route === '/')))
const previous = computed(() => currentIndex.value > 0 ? records.value[currentIndex.value - 1] : undefined)
const next = computed(() => currentIndex.value >= 0 && currentIndex.value < records.value.length - 1 ? records.value[currentIndex.value + 1] : undefined)

onMounted(async () => { records.value = (await loadContentRecords()).filter((record) => record.search !== false) })
</script>

<template>
  <nav v-if="previous || next" class="cw-page-navigation" aria-label="相邻页面">
    <a v-if="previous" :href="withBase(previous.route)"><small>上一篇</small><strong>← {{ previous.title }}</strong></a>
    <span v-else></span>
    <a v-if="next" :href="withBase(next.route)"><small>下一篇</small><strong>{{ next.title }} →</strong></a>
  </nav>
</template>
