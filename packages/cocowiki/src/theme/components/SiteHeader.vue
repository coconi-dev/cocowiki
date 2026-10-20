<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { useData, useRoute, withBase } from 'vitepress'
import { canonicalRoute } from '../../shared/routes'
import config from 'virtual:cocowiki-config'

defineEmits<{ openSearch: [] }>()
const { isDark } = useData()
const route = useRoute()

function isCurrent(link?: string) {
  return Boolean(link && canonicalRoute(route.path) === canonicalRoute(withBase(link)))
}
const header = ref<HTMLElement>()
const menuOpen = ref(false)
const openDropdown = ref<string>()
const theme = ref<'light' | 'dark' | 'system'>('system')
let systemTheme: MediaQueryList | undefined

function applyTheme(value: typeof theme.value) {
  theme.value = value
  localStorage.setItem('cw-theme', value)
  isDark.value = value === 'dark' || (value === 'system' && (systemTheme?.matches ?? false))
}

function handleSystemTheme(event: MediaQueryListEvent) {
  if (theme.value === 'system') isDark.value = event.matches
}

function cycleTheme() {
  const order = ['system', 'light', 'dark'] as const
  applyTheme(order[(order.indexOf(theme.value) + 1) % order.length])
}

function closeNavigation() {
  menuOpen.value = false
  openDropdown.value = undefined
}

watch(() => route.path, closeNavigation)

function onOutsideClick(event: MouseEvent) {
  if (!header.value?.contains(event.target as Node)) closeNavigation()
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') closeNavigation()
}

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
  document.addEventListener('click', onOutsideClick)
  systemTheme = matchMedia('(prefers-color-scheme: dark)')
  systemTheme.addEventListener('change', handleSystemTheme)
  const saved = localStorage.getItem('cw-theme')
  applyTheme(saved === 'light' || saved === 'dark' || saved === 'system' ? saved : 'system')
})
onUnmounted(() => {
  systemTheme?.removeEventListener('change', handleSystemTheme)
  window.removeEventListener('keydown', onKeydown)
  document.removeEventListener('click', onOutsideClick)
})
</script>

<template>
  <header ref="header" class="cw-header">
    <div class="cw-header__inner">
      <a class="cw-brand" :href="withBase('/')" aria-label="返回首页" @click="closeNavigation">
        <img v-if="config.logo" class="cw-brand__logo" :src="withBase(config.logo)" alt="">
        <span v-else class="cw-brand__mark">{{ config.title.slice(0, 1) }}</span>
        <span>
          <strong>{{ config.title }}</strong>
        </span>
      </a>
      <nav :class="['cw-nav', { 'is-open': menuOpen }]" aria-label="主导航">
        <div
          v-for="item in config.navigation"
          :key="item.text"
          :class="['cw-nav-item', { 'has-children': item.items?.length, 'is-open': openDropdown === item.text }]"
        >
          <a v-if="!item.items?.length && item.link" :href="withBase(item.link)" :aria-current="isCurrent(item.link) ? 'page' : undefined" @click="closeNavigation">{{ item.text }}</a>
          <button
            v-else
            type="button"
            :aria-expanded="openDropdown === item.text"
            @click="openDropdown = openDropdown === item.text ? undefined : item.text"
          >
            {{ item.text }}
            <svg aria-hidden="true" viewBox="0 0 12 12"><path d="m3 4.5 3 3 3-3" /></svg>
          </button>
          <div v-if="item.items?.length" class="cw-nav-dropdown">
            <a v-if="item.link" :href="withBase(item.link)" :aria-current="isCurrent(item.link) ? 'page' : undefined" @click="closeNavigation">查看全部</a>
            <a v-for="child in item.items" :key="child.text" :href="child.link ? withBase(child.link) : undefined" @click="closeNavigation">
              <span>{{ child.text }}</span>
            </a>
          </div>
        </div>
      </nav>
      <div class="cw-header__actions">
        <button v-if="config.search?.enabled !== false" class="cw-search-trigger" type="button" aria-label="搜索资料库" title="搜索（⌘ / Ctrl K）" @click="closeNavigation(); $emit('openSearch')">
          <svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4"/></svg>
        </button>
        <button class="cw-icon-button" type="button" :aria-label="`切换主题，当前为${theme === 'system' ? '跟随系统' : theme === 'dark' ? '深色' : '浅色'}`" @click="cycleTheme">
          <svg v-if="theme === 'system'" aria-hidden="true" viewBox="0 0 24 24"><circle cx="12" cy="12" r="7"/><path d="M12 5v14"/></svg>
          <svg v-else-if="theme === 'dark'" aria-hidden="true" viewBox="0 0 24 24"><path d="M19 15.2A7.5 7.5 0 0 1 8.8 5 7.5 7.5 0 1 0 19 15.2Z"/></svg>
          <svg v-else aria-hidden="true" viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>
        </button>
        <button class="cw-menu-button" type="button" :aria-expanded="menuOpen" :aria-label="menuOpen ? '关闭导航' : '展开导航'" @click="menuOpen = !menuOpen">
          <span></span><span></span>
        </button>
      </div>
    </div>
  </header>
</template>
