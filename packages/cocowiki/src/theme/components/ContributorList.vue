<script setup lang="ts">
import { computed } from 'vue'
import { useData, withBase } from 'vitepress'
import contributors from 'virtual:cocowiki-contributors'

interface Contributor {
  name: string
  initials?: string
  role?: string
  avatar?: string
  url?: string
  github?: string
}

const props = withDefaults(defineProps<{
  names?: string[]
  compact?: boolean
  label?: string
}>(), {
  names: undefined,
  compact: false,
  label: '本页记录者'
})

const { frontmatter } = useData()
const contributorMap = contributors as Record<string, Omit<Contributor, 'name'> & { name?: string }>
const selected = computed<Contributor[]>(() => (props.names || frontmatter.value.contributors || []).map((key: string) => ({
  ...(contributorMap[key] || {}),
  name: contributorMap[key]?.name || key,
  initials: contributorMap[key]?.initials || key.slice(0, 2).toUpperCase()
})))

function profileUrl(person: Contributor) {
  if (person.url) return person.url
  if (!person.github) return undefined
  return person.github.startsWith('http') ? person.github : `https://github.com/${person.github}`
}
</script>

<template>
  <div v-if="selected.length" :class="['cw-contributors', { compact }]">
    <span v-if="!compact" class="cw-contributors__label">{{ label }}</span>
    <component
      :is="profileUrl(person) ? 'a' : 'span'"
      v-for="person in selected"
      :key="person.name"
      class="cw-contributor"
      :href="profileUrl(person)"
      :target="profileUrl(person) ? '_blank' : undefined"
      :rel="profileUrl(person) ? 'noreferrer' : undefined"
    >
      <img v-if="person.avatar" class="cw-contributor-avatar" :src="withBase(person.avatar)" alt="">
      <span v-else class="cw-contributor-avatar cw-contributor-avatar--fallback">{{ person.initials }}</span>
      <span><strong>{{ person.name }}</strong><small v-if="!compact && person.role">{{ person.role }}</small></span>
    </component>
  </div>
</template>

<style scoped>
.cw-contributors { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; margin-top: 22px; }
.cw-contributors__label { width: 100%; color: var(--cw-muted); font-size: .68rem; font-weight: 750; letter-spacing: .1em; }
.cw-contributor { display: flex; align-items: center; gap: 9px; padding: 7px 11px 7px 7px; color: inherit; border: 1px solid var(--cw-border); border-radius: 999px; text-decoration: none; }
a.cw-contributor:hover { border-color: var(--cw-accent); }
.cw-contributor-avatar { width: 29px; height: 29px; object-fit: cover; border-radius: 50%; }
.cw-contributor-avatar--fallback { display: grid; place-items: center; color: white; background: var(--cw-accent); font-size: .62rem; font-weight: 800; }
strong, small { display: block; line-height: 1.25; }
strong { font-size: .76rem; }
small { color: var(--cw-muted); font-size: .62rem; }
.compact { display: inline-flex; margin-top: 22px; }
.compact .cw-contributor { padding: 3px 8px 3px 3px; border: 0; background: var(--cw-surface-soft); }
.compact .cw-contributor-avatar { width: 23px; height: 23px; }
</style>
