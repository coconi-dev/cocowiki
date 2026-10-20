<script setup lang="ts">
import { computed } from 'vue'
import { withBase } from 'vitepress'
import contributors from 'virtual:cocowiki-contributors'
import { useContentStore } from '../content'
import ContentStatus from './ContentStatus.vue'
import { useContributorContributionSources } from '../contributors'

interface ContributorProfile {
  name?: string
  initials?: string
  role?: string
  avatar?: string
  url?: string
  github?: string
}

const { records, loading, error, retry } = useContentStore()
const sources = useContributorContributionSources()
const profiles = Object.assign(Object.create(null), contributors) as Record<string, ContributorProfile>

const entries = computed(() => {
  const counts: Record<string, number> = Object.create(null)
  for (const record of records.value) {
    for (const name of new Set(record.contributors || [])) counts[name] = (counts[name] || 0) + 1
  }
  for (const source of sources.values()) {
    for (const [name, count] of Object.entries(source)) counts[name] = (counts[name] || 0) + count
  }

  return [...new Set([...Object.keys(profiles), ...Object.keys(counts)])]
    .map((key) => ({ key, count: counts[key] || 0, ...profiles[key], name: profiles[key]?.name || key }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'zh-CN'))
})

const total = computed(() => entries.value.reduce((sum, person) => sum + person.count, 0))

function profileUrl(person: ContributorProfile) {
  if (person.url) return person.url
  if (!person.github) return undefined
  return person.github.startsWith('http') ? person.github : `https://github.com/${person.github}`
}


</script>

<template>
  <div class="cw-contributor-page">
    <header>
      <div><h1>贡献者</h1><p>感谢每一位参与编写、整理与维护的伙伴。</p></div>
      <strong>{{ entries.length }} 位贡献者<span aria-hidden="true"> · </span>{{ total }} 次贡献</strong>
    </header>
    <ContentStatus :loading="loading" :error="error" @retry="retry" />
    <section class="cw-contributor-grid" aria-label="贡献者名单">
      <component
        :is="profileUrl(person) ? 'a' : 'article'"
        v-for="person in entries"
        :key="person.key"
        class="cw-contributor-card"
        :href="profileUrl(person)"
        :target="profileUrl(person) ? '_blank' : undefined"
        :rel="profileUrl(person) ? 'noreferrer' : undefined"
      >
        <img v-if="person.avatar" :src="withBase(person.avatar)" alt="">
        <span v-else>{{ person.initials || person.name.slice(0, 2).toUpperCase() }}</span>
        <div class="cw-contributor-card__profile"><h2>{{ person.name }}</h2><p v-if="person.role">{{ person.role }}</p></div>
        <b>{{ person.count }}<small>次</small></b>
      </component>
    </section>
  </div>
</template>
