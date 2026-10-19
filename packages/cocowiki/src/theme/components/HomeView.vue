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
const headline = computed(() => (hero.value.text || config.description || config.title).trim())

function search() {
  const value = query.value.trim()
  if (value) router.go(withBase(`/search?q=${encodeURIComponent(value)}`))
}

</script>

<template>
  <div class="cw-home">
    <section class="cw-home-hero" aria-labelledby="home-title">
      <p v-if="hero.eyebrow" class="cw-home-eyebrow">{{ hero.eyebrow }}</p>
      <h1 id="home-title">{{ hero.name || config.title }}</h1>
      <p class="cw-home-summary">{{ headline }}</p>
      <p v-if="hero.tagline" class="cw-home-description">{{ hero.tagline }}</p>

      <form v-if="config.search?.enabled !== false" class="cw-home-search" role="search" @submit.prevent="search">
        <svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4"/></svg>
        <label class="cw-sr-only" for="home-search">搜索整个资料库</label>
        <input id="home-search" v-model="query" type="search" :placeholder="hero.search?.placeholder || '搜索整个资料库…'" autocomplete="off">
        <button type="submit">搜索<svg aria-hidden="true" viewBox="0 0 24 24"><path d="m9 6 6 6-6 6"/></svg></button>
      </form>

      <nav v-if="actions.length" class="cw-home-actions" aria-label="首页入口">
        <a v-for="action in actions" :key="action.link" :href="withBase(action.link)">
          {{ action.text }}<span aria-hidden="true">›</span>
        </a>
      </nav>
    </section>

    <div class="cw-home-art" aria-hidden="true"></div>
    <footer v-if="hero.note" class="cw-home-note"><p>{{ hero.note }}</p></footer>
  </div>
</template>
