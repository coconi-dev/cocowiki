<script setup lang="ts">
import { computed, reactive, watch } from 'vue'
import { useRoute, withBase } from 'vitepress'
import { canonicalRoute } from '../../shared/routes'
import { useContentStore } from '../content'
const route = useRoute()
const expanded = reactive(new Set<string>())
const { records, error, retry, version } = useContentStore()
watch([() => route.path, version], () => expanded.clear())
const current = computed(() => records.value.find(page => canonicalRoute(withBase(page.route)) === canonicalRoute(route.path)))
const sections = computed(() => [
  { title: '关联词条', routes: current.value?.relatedLinks || [] },
  { title: '引用此页', routes: current.value?.backlinks || [] }
].map(section => ({ ...section, pages: section.routes.flatMap(route => records.value.find(page => page.route === route) || []) })).filter(section => section.pages.length))
</script>
<template>
  <aside v-if="sections.length || error" class="cw-page-relations" aria-label="词条关系">
    <p v-if="error" role="alert">词条关系加载失败。<button type="button" @click="retry">重试</button></p>
    <section v-for="section in sections" :key="section.title"><h2>{{ section.title }}</h2><ul><li v-for="page in section.pages.slice(0, expanded.has(section.title) ? undefined : 5)" :key="page.route"><a :href="withBase(page.route)">{{ page.title }}</a><p v-if="page.description">{{ page.description }}</p></li></ul><button v-if="section.pages.length > 5" type="button" :aria-expanded="expanded.has(section.title)" @click="expanded.has(section.title) ? expanded.delete(section.title) : expanded.add(section.title)">{{ expanded.has(section.title) ? '收起' : `展开全部 ${section.pages.length} 条` }}</button></section>
  </aside>
</template>
<style scoped>
.cw-page-relations { margin-top: var(--cw-space-8); padding-top: var(--cw-space-6); border-top: 1px solid var(--cw-border); }
h2 { font-size: 17px; } ul { padding-left: 20px; } a { color: var(--cw-accent); } p { margin: 2px 0 var(--cw-space-2); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; color: var(--cw-muted); font-size: var(--cw-font-small); }
button { min-height: var(--cw-control-height); border: 0; padding: 0; background: transparent; color: var(--cw-accent); font-size: var(--cw-font-small); }
</style>
