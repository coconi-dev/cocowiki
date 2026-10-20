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
  label: '贡献者'
})

const { frontmatter } = useData()
const contributorMap = Object.assign(Object.create(null), contributors) as Record<string, Omit<Contributor, 'name'> & { name?: string }>
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
.cw-contributors { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; margin-top: 24px; }
.cw-contributors__label { width: 100%; color: var(--cw-muted); font-size: 13px; font-weight: 500; }
.cw-contributor { display: flex; align-items: center; gap: 10px; padding: 8px 14px 8px 8px; color: inherit; border-radius: 12px; background: var(--cw-surface-soft); text-decoration: none; }
a.cw-contributor:hover strong { color: var(--cw-accent); }
.cw-contributor-avatar { width: 36px; height: 36px; object-fit: cover; border-radius: 50%; }
.cw-contributor-avatar--fallback { display: grid; place-items: center; color: var(--cw-accent); background: var(--cw-accent-soft); font-size: 11px; font-weight: 600; }
strong, small { display: block; line-height: 1.4; }
strong { font-size: 13px; font-weight: 500; }
small { margin-top: 2px; color: var(--cw-muted); font-size: 11px; }
.compact { display: inline-flex; margin: 0; }
.compact .cw-contributor { gap: 6px; padding: 0; background: none; }
.compact .cw-contributor-avatar { width: 24px; height: 24px; }
</style>
