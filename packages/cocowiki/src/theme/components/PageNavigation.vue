<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, withBase } from 'vitepress'
import { useContentStore } from '../content'
import { canonicalRoute } from '../../shared/routes'
import { navigationRecords } from '../pageNavigation'

const route = useRoute()
const { records: content } = useContentStore()
const records = computed(() => navigationRecords([...content.value]))
const currentIndex = computed(() => records.value.findIndex(record => canonicalRoute(withBase(record.route)) === canonicalRoute(route.path)))
const previous = computed(() => currentIndex.value > 0 ? records.value[currentIndex.value - 1] : undefined)
const next = computed(() => currentIndex.value >= 0 && currentIndex.value < records.value.length - 1 ? records.value[currentIndex.value + 1] : undefined)

</script>

<template>
  <nav v-if="previous || next" class="cw-page-navigation" aria-label="相邻页面">
    <a v-if="previous" :href="withBase(previous.route)"><small>上一篇</small><strong>← {{ previous.title }}</strong></a>
    <span v-else></span>
    <a v-if="next" :href="withBase(next.route)"><small>下一篇</small><strong>{{ next.title }} →</strong></a>
  </nav>
</template>
