<script setup lang="ts">
import { computed, defineAsyncComponent, inject, onMounted, onUnmounted, ref } from 'vue'
import { useData, useRoute } from 'vitepress'
import config from 'virtual:cocowiki-config'
import DefaultSiteHeader from './components/SiteHeader.vue'
import DefaultHomeView from './components/HomeView.vue'
import DefaultPageMeta from './components/PageMeta.vue'
import DefaultPageOutline from './components/PageOutline.vue'
import DefaultContentSidebar from './components/ContentSidebar.vue'
import DefaultPageNavigation from './components/PageNavigation.vue'
import DefaultPageFooter from './components/PageFooter.vue'
import DefaultLoadingView from './components/LoadingView.vue'
import DefaultNotFoundView from './components/NotFoundView.vue'
import { cocoWikiThemeComponentsKey } from './customization'

const DefaultSearchView = defineAsyncComponent(() => import('./components/SearchView.vue'))
const DefaultArchiveView = defineAsyncComponent(() => import('./components/ArchiveView.vue'))
const DefaultContributorsView = defineAsyncComponent(() => import('./components/ContributorsView.vue'))
const DefaultSearchOverlay = defineAsyncComponent(() => import('./components/SearchOverlay.vue'))

const overrides = inject(cocoWikiThemeComponentsKey, {})
const SiteHeader = overrides.Header || DefaultSiteHeader
const HomeView = overrides.Home || DefaultHomeView
const SearchView = overrides.Search || DefaultSearchView
const ArchiveView = overrides.Archive || DefaultArchiveView
const ContributorsView = overrides.Contributors || DefaultContributorsView
const PageMeta = overrides.PageMeta || DefaultPageMeta
const PageOutline = overrides.PageOutline || DefaultPageOutline
const ContentSidebar = overrides.ContentSidebar || DefaultContentSidebar
const PageNavigation = overrides.PageNavigation || DefaultPageNavigation
const PageFooter = overrides.PageFooter || DefaultPageFooter
const SearchOverlay = overrides.SearchOverlay || DefaultSearchOverlay
const LoadingView = overrides.Loading || DefaultLoadingView
const NotFoundView = overrides.NotFound || DefaultNotFoundView

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
    <main :key="route.path" class="cw-main">
      <Suspense :timeout="0">
        <template #default>
          <div class="cw-route-view">
            <NotFoundView v-if="page.isNotFound" />
            <HomeView v-else-if="layout === 'home'" />
            <SearchView v-else-if="layout === 'search'" />
            <ArchiveView v-else-if="layout === 'archive'" />
            <ContributorsView v-else-if="layout === 'contributors'" />
            <component :is="route.component" v-else-if="layout === 'special'" class="cw-special-content" v-bind="site.contentProps" />
            <div v-else :class="['cw-doc-shell', `is-${sidebar}`]">
              <ContentSidebar v-if="sidebar === 'light'" />
              <article class="cw-doc">
                <PageMeta />
                <component :is="route.component" class="cw-prose" v-bind="site.contentProps" />
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
    <SearchOverlay v-if="searchOpen" @close="searchOpen = false" />
  </div>
</template>
