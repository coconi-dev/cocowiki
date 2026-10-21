<script setup lang="ts">
import type { Component } from 'vue'
import { themeComponentNames, type ThemeComponentName } from '../shared/extensions'
import { computed, defineAsyncComponent, inject, onMounted, onUnmounted, ref } from 'vue'
import { useData, useRoute } from 'vitepress'
import config from 'virtual:cocowiki-config'
import DefaultSiteHeader from './components/SiteHeader.vue'
import DefaultHomeView from './components/HomeView.vue'
import DefaultPageMeta from './components/PageMeta.vue'
import DefaultPageOutline from './components/PageOutline.vue'
import DefaultContentSidebar from './components/ContentSidebar.vue'
import DefaultPageNavigation from './components/PageNavigation.vue'
import DefaultPageStatus from './components/PageStatus.vue'
import DefaultPageRelations from './components/PageRelations.vue'
import DefaultPageFooter from './components/PageFooter.vue'
import DefaultLoadingView from './components/LoadingView.vue'
import DefaultNotFoundView from './components/NotFoundView.vue'
import { cocoWikiThemeComponentsKey } from './customization'

const DefaultSearchView = defineAsyncComponent(() => import('./components/SearchView.vue'))
const DefaultArchiveView = defineAsyncComponent(() => import('./components/ArchiveView.vue'))
const DefaultContributorsView = defineAsyncComponent(() => import('./components/ContributorsView.vue'))
const DefaultSearchOverlay = defineAsyncComponent(() => import('./components/SearchOverlay.vue'))

const overrides = inject(cocoWikiThemeComponentsKey, {})
const defaults = {
  Header: DefaultSiteHeader,
  Home: DefaultHomeView,
  Search: DefaultSearchView,
  Archive: DefaultArchiveView,
  Contributors: DefaultContributorsView,
  PageMeta: DefaultPageMeta,
  PageOutline: DefaultPageOutline,
  ContentSidebar: DefaultContentSidebar,
  PageNavigation: DefaultPageNavigation,
  PageStatus: DefaultPageStatus,
  PageRelations: DefaultPageRelations,
  PageFooter: DefaultPageFooter,
  SearchOverlay: DefaultSearchOverlay,
  Loading: DefaultLoadingView,
  NotFound: DefaultNotFoundView,
} satisfies Record<ThemeComponentName, Component>
const components = Object.fromEntries(themeComponentNames.map(name => [name, overrides[name] || defaults[name]])) as Record<ThemeComponentName, Component>
const { Header: SiteHeader, Home: HomeView, Search: SearchView, Archive: ArchiveView, Contributors: ContributorsView, PageMeta, PageOutline, ContentSidebar, PageNavigation, PageStatus, PageRelations, PageFooter, SearchOverlay, Loading: LoadingView, NotFound: NotFoundView } = components

const { frontmatter, page, site } = useData()
const route = useRoute()
const searchOpen = ref(false)
const layout = computed(() => frontmatter.value.layout || 'doc')
const sidebar = computed(() => {
  const legacy = frontmatter.value.sidebar || config.content?.sidebar
  const outline = frontmatter.value.outline ?? config.content?.outline
  if (outline === false) return legacy === 'light' ? 'light' : 'none'
  if (outline === true) return 'outline'
  return legacy || 'outline'
})
const showPrevNext = computed(() => frontmatter.value.showPrevNext ?? config.content?.showPrevNext ?? false)
const showLastUpdated = computed(() => frontmatter.value.showLastUpdated ?? config.content?.showLastUpdated ?? true)

function handleKeydown(event: KeyboardEvent) {
  if ((event.key === '/' && !['INPUT', 'TEXTAREA'].includes((event.target as HTMLElement)?.tagName)) ||
      ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k')) {
    if (config.search?.enabled !== false) {
      event.preventDefault()
      searchOpen.value = true
    }
  }
}

async function handleClick(event: MouseEvent) {
  const spoiler = (event.target as HTMLElement).closest<HTMLButtonElement>('.cw-spoiler')
  if (spoiler) {
    const revealed = spoiler.classList.toggle('is-revealed')
    spoiler.setAttribute('aria-expanded', String(revealed))
    spoiler.setAttribute('aria-label', revealed ? '剧透内容，点击隐藏' : '剧透内容，点击显示')
    return
  }
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button.copy')
  if (!button) return
  const code = button.parentElement?.querySelector('pre code')?.textContent
  if (!code) return
  await navigator.clipboard.writeText(code)
  button.classList.add('copied')
  window.setTimeout(() => button.classList.remove('copied'), 1800)
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
  document.addEventListener('click', handleClick)
})
onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
  document.removeEventListener('click', handleClick)
})
</script>

<template>
  <div class="cw-site">
    <SiteHeader @open-search="searchOpen = true" />
    <main :key="route.path" :class="['cw-main', `is-${layout}`]">
      <Suspense :timeout="0">
        <template #default>
          <div class="cw-route-view">
            <NotFoundView v-if="page.isNotFound" />
            <HomeView v-else-if="layout === 'home'" />
            <SearchView v-else-if="layout === 'search'" />
            <ArchiveView v-else-if="layout === 'archive'" />
            <ContributorsView v-else-if="layout === 'contributors'" />
            <div v-else-if="layout === 'special'"><PageStatus standalone class="cw-special-status" /><component :is="route.component" class="cw-special-content" v-bind="site.contentProps" /></div>
            <div v-else :class="['cw-doc-shell', `is-${sidebar}`]">
              <ContentSidebar v-if="sidebar === 'light'" />
              <article class="cw-doc">
                <PageMeta />
                <PageStatus />
                <PageOutline v-if="sidebar !== 'none' && (frontmatter.outline ?? config.content?.outline) !== false" variant="inline" :headers="page.headers" />
                <component :is="route.component" class="cw-prose" v-bind="site.contentProps" />
                <PageRelations />
                <PageNavigation v-if="showPrevNext" />
                <PageFooter :show-last-updated="showLastUpdated" />
              </article>
              <PageOutline v-if="sidebar === 'outline'" :headers="page.headers" />
            </div>
          </div>
        </template>
        <template #fallback>
          <LoadingView />
        </template>
      </Suspense>
    </main>
    <Transition name="cw-overlay">
      <SearchOverlay v-if="searchOpen" @close="searchOpen = false" />
    </Transition>
  </div>
</template>
