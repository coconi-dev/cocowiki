<script setup lang="ts">
import { computed, onMounted, shallowRef } from 'vue'
import { withBase } from 'vitepress'
import contributors from 'virtual:cocowiki-contributors'
import type { SearchRecord } from '../../node/content'
import { loadContentRecords } from '../content'
import { useContributorContributionSources } from '../contributors'

interface ContributorProfile {
  name?: string
  initials?: string
  role?: string
  avatar?: string
  url?: string
  github?: string
}

const records = shallowRef<SearchRecord[]>([])
const sources = useContributorContributionSources()
const profiles = contributors as Record<string, ContributorProfile>

const entries = computed(() => {
  const counts: Record<string, number> = {}
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

onMounted(async () => { records.value = await loadContentRecords() })
</script>

<template>
  <div class="cw-contributor-page">
    <header>
      <div><p class="cw-kicker">CONTRIBUTORS · 共建者</p><h1>贡献者</h1><p>每次在页面 Frontmatter 中署名，都会计入一次贡献。</p></div>
      <strong>{{ total }} <small>次贡献</small></strong>
    </header>
    <section class="cw-contributor-grid">
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
        <div><h2>{{ person.name }}</h2><p>{{ person.role || '贡献者' }}</p></div>
        <b>{{ person.count }}<small>次</small></b>
      </component>
    </section>
  </div>
</template>
