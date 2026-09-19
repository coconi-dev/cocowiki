<script setup lang="ts">
import { computed, defineAsyncComponent, onMounted, onUnmounted, ref } from 'vue'
import { useData, useRoute, withBase } from 'vitepress'
import config from 'virtual:cocowiki-config'
import SiteHeader from './components/SiteHeader.vue'
import HomeView from './components/HomeView.vue'
import PageMeta from './components/PageMeta.vue'
import PageOutline from './components/PageOutline.vue'
import ContentSidebar from './components/ContentSidebar.vue'
import PageNavigation from './components/PageNavigation.vue'

const SearchView = defineAsyncComponent(() => import('./components/SearchView.vue'))
const ArchiveView = defineAsyncComponent(() => import('./components/ArchiveView.vue'))
const ContributorsView = defineAsyncComponent(() => import('./components/ContributorsView.vue'))
const SearchOverlay = defineAsyncComponent(() => import('./components/SearchOverlay.vue'))

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
            <HomeView v-if="layout === 'home'" />
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
                <footer class="cw-doc-footer">
                  <a v-if="config.search?.enabled !== false" :href="withBase('/search')">返回搜索</a>
                  <a :href="withBase('/archive')">浏览归档</a>
                  <span v-if="showLastUpdated && page.lastUpdated">最后更新：{{ new Date(page.lastUpdated).toLocaleDateString('zh-CN') }}</span>
                </footer>
              </article>
              <PageOutline v-if="sidebar === 'outline'" :headers="page.headers" />
            </div>
          </div>
        </template>
        <template #fallback>
          <div class="cw-route-loading" role="status" aria-live="polite">
            <span aria-hidden="true"></span>
            <p>正在载入页面</p>
          </div>
        </template>
      </Suspense>
    </main>
    <SearchOverlay v-if="searchOpen" @close="searchOpen = false" />
  </div>
</template>
