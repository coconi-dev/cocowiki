<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { useData, withBase } from 'vitepress'
import config from 'virtual:cocowiki-config'

defineEmits<{ openSearch: [] }>()
const { isDark } = useData()
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

onMounted(() => {
  systemTheme = matchMedia('(prefers-color-scheme: dark)')
  systemTheme.addEventListener('change', handleSystemTheme)
  const saved = localStorage.getItem('cw-theme')
  applyTheme(saved === 'light' || saved === 'dark' || saved === 'system' ? saved : 'system')
})
onUnmounted(() => systemTheme?.removeEventListener('change', handleSystemTheme))
</script>

<template>
  <header class="cw-header">
    <div class="cw-header__inner">
      <a class="cw-brand" :href="withBase('/')" aria-label="返回首页">
        <img v-if="config.logo" class="cw-brand__logo" :src="withBase(config.logo)" alt="">
        <span v-else class="cw-brand__mark"><i></i><b>C</b></span>
        <span>
          <strong>{{ config.title }}</strong>
          <small>KNOWLEDGE BASE</small>
        </span>
      </a>
      <nav :class="['cw-nav', { 'is-open': menuOpen }]" aria-label="主导航">
        <div
          v-for="item in config.navigation"
          :key="item.text"
          :class="['cw-nav-item', { 'has-children': item.items?.length, 'is-open': openDropdown === item.text }]"
        >
          <a v-if="!item.items?.length && item.link" :href="withBase(item.link)" @click="closeNavigation">{{ item.text }}</a>
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
            <a v-if="item.link" :href="withBase(item.link)" @click="closeNavigation">查看全部</a>
            <a v-for="child in item.items" :key="child.text" :href="child.link ? withBase(child.link) : undefined" @click="closeNavigation">
              <span>{{ child.text }}</span>
            </a>
          </div>
        </div>
      </nav>
      <div class="cw-header__actions">
        <button v-if="config.search?.enabled !== false" class="cw-search-trigger" type="button" @click="$emit('openSearch')">
          <svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4"/></svg>
          <span>搜索</span><kbd>⌘ K</kbd>
        </button>
        <button class="cw-icon-button" type="button" :aria-label="`主题：${theme}`" @click="cycleTheme">
          <svg v-if="theme === 'system'" aria-hidden="true" viewBox="0 0 24 24"><circle cx="12" cy="12" r="7"/><path d="M12 5v14"/></svg>
          <svg v-else-if="theme === 'dark'" aria-hidden="true" viewBox="0 0 24 24"><path d="M19 15.2A7.5 7.5 0 0 1 8.8 5 7.5 7.5 0 1 0 19 15.2Z"/></svg>
          <svg v-else aria-hidden="true" viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>
        </button>
        <button class="cw-menu-button" type="button" :aria-expanded="menuOpen" aria-label="展开导航" @click="menuOpen = !menuOpen">
          <span></span><span></span>
        </button>
      </div>
    </div>
  </header>
</template>
