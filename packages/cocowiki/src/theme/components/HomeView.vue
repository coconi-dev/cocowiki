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
// Smooth cubic contours are generated once; only their parent layers animate.
const ribbons = Array.from({ length: 16 }, (_, index) => {
  const spread = index * 5
  return `M ${810 + spread * .25} ${532 + spread * .35}
    C ${1080 + spread} ${190 - spread}, ${1650 + spread} ${250 + spread}, ${1460 + spread * .3} ${520 + spread}
    C ${1300 - spread} ${755 + spread}, ${1030 - spread * .2} ${650 + spread}, ${810 + spread * .25} ${532 + spread * .35}
    C ${510 - spread} ${350 - spread * .4}, ${110 - spread} ${570 - spread}, ${240 - spread * .5} ${760 - spread * .2}
    C ${390 + spread} ${965 + spread}, ${650 + spread * .2} ${730 + spread}, ${810 + spread * .25} ${532 + spread * .35} Z`
})
const waves = Array.from({ length: 10 }, (_, index) => {
  const offset = index * 14
  return `M -180 ${130 + offset} C 100 ${-60 + offset}, 330 ${100 + offset * .6}, 410 ${260 + offset * .5} S 580 ${535 + offset * .7}, 820 ${480 + offset}`
})
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
    <div class="cw-home-flow" aria-hidden="true">
      <svg viewBox="0 0 1440 900" fill="none" preserveAspectRatio="xMidYMid slice" focusable="false">
        <g class="cw-home-flow__waves">
          <path v-for="(path, index) in waves" :key="index" :d="path"/>
        </g>
        <g class="cw-home-flow__ribbon">
          <path v-for="(path, index) in ribbons" :key="index" :d="path"/>
        </g>
      </svg>
    </div>
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
        <a v-for="action in actions" :key="action.link" :href="withBase(action.link)" :class="`is-${action.theme || 'alt'}`">
          {{ action.text }}<span aria-hidden="true">›</span>
        </a>
      </nav>
    </section>

    <div class="cw-home-art" :class="{ 'has-visual': hero.visual?.image }">
      <img v-if="hero.visual?.image" :src="withBase(hero.visual.image)" alt="">
      <div v-if="hero.visual?.labels?.length" class="cw-home-visual-labels"><span v-for="label in hero.visual.labels" :key="label">{{ label }}</span></div>
    </div>
    <footer v-if="hero.note" class="cw-home-note"><p>{{ hero.note }}</p></footer>
  </div>
</template>
