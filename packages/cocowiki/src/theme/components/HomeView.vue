<script setup lang="ts">
import { computed, ref } from 'vue'
import { useData, useRouter, withBase } from 'vitepress'
import config from 'virtual:cocowiki-config'

interface HomeAction {
  text: string
  link: string
  theme?: 'brand' | 'alt'
}

const { frontmatter } = useData()
const router = useRouter()
const query = ref('')
const hero = computed(() => ({ ...(config.home || {}), ...(frontmatter.value.hero || {}) }))
const actions = computed<HomeAction[]>(() => hero.value.actions || [])
const visualImage = computed(() => hero.value.visual?.image || config.logo)
const visualLabels = computed<string[]>(() => hero.value.visual?.labels || ['Markdown', 'Vue', 'Search'])

function search() {
  const value = query.value.trim()
  if (value) router.go(withBase(`/search?q=${encodeURIComponent(value)}`))
}
</script>

<template>
  <div class="cw-home">
    <section class="cw-hero">
      <div class="cw-hero__content">
        <p v-if="hero.eyebrow" class="cw-hero__eyebrow">
          <span></span>{{ hero.eyebrow }}
        </p>
        <h1>
          <span class="cw-hero__name">{{ hero.name || config.title }}</span>
          <span>{{ hero.text || config.description }}</span>
        </h1>
        <p v-if="hero.tagline" class="cw-hero__tagline">{{ hero.tagline }}</p>

        <form v-if="config.search?.enabled !== false" class="cw-home-search" @submit.prevent="search">
          <svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4"/></svg>
          <label class="cw-sr-only" for="home-search">搜索整个资料库</label>
          <input id="home-search" v-model="query" type="search" :placeholder="hero.search?.placeholder || '搜索整个资料库…'" autocomplete="off">
          <kbd>/</kbd>
          <button type="submit">搜索</button>
        </form>

        <div v-if="actions.length" class="cw-hero__actions">
          <a v-for="action in actions" :key="action.link" :class="`is-${action.theme || 'alt'}`" :href="withBase(action.link)">
            {{ action.text }}
            <svg v-if="action.theme === 'brand'" aria-hidden="true" viewBox="0 0 20 20"><path d="m7 4 6 6-6 6"/></svg>
          </a>
        </div>
      </div>

      <div class="cw-hero__visual" aria-hidden="true">
        <div class="cw-orbit cw-orbit--outer"></div>
        <div class="cw-orbit cw-orbit--inner"></div>
        <div class="cw-hero__core">
          <img v-if="visualImage" :src="withBase(visualImage)" alt="">
          <template v-else><span>C</span><small>WIKI</small></template>
        </div>
        <span v-for="(label, index) in visualLabels.slice(0, 6)" :key="`${label}-${index}`" :class="['cw-node', `cw-node--${index + 1}`]">{{ label }}</span>
        <i class="cw-dot cw-dot--one"></i>
        <i class="cw-dot cw-dot--two"></i>
      </div>
    </section>

    <footer v-if="hero.note" class="cw-home-note">
      <span></span><p>{{ hero.note }}</p>
    </footer>
  </div>
</template>
