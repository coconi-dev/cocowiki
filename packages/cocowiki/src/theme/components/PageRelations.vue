<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, withBase } from 'vitepress'
import { canonicalRoute } from '../../shared/routes'
import { useContentStore } from '../content'
const route = useRoute()
const { records, loading, error, retry } = useContentStore()
const current = computed(() => records.value.find(page => canonicalRoute(withBase(page.route)) === canonicalRoute(route.path)))
const sections = computed(() => [
  { title: '关联词条', routes: current.value?.relatedLinks || [] },
  { title: '引用此页', routes: current.value?.backlinks || [] }
].map(section => ({ ...section, pages: section.routes.flatMap(route => records.value.find(page => page.route === route) || []) })).filter(section => section.pages.length))
</script>
<template>
  <aside v-if="sections.length || error" class="cw-page-relations" aria-label="词条关系">
    <p v-if="error" role="alert">词条关系加载失败。<button type="button" @click="retry">重试</button></p>
    <section v-for="section in sections" :key="section.title"><h2>{{ section.title }}</h2><ul><li v-for="page in section.pages" :key="page.route"><a :href="withBase(page.route)">{{ page.title }}</a><span v-if="page.description"> — {{ page.description }}</span></li></ul></section>
  </aside>
</template>
<style scoped>
.cw-page-relations { margin-top: 32px; padding-top: 24px; border-top: 1px solid var(--cw-border); }
h2 { font-size: 17px; } ul { padding-left: 20px; } a { color: var(--cw-accent); } span { color: var(--cw-muted); font-size: 14px; }
</style>
