<script setup lang="ts">
import { computed } from 'vue'
import { useData, withBase } from 'vitepress'
import { browseUrl } from '../browse'
import ContributorList from './ContributorList.vue'

const { frontmatter } = useData()
const typeLabel = computed(() => [frontmatter.value.category, frontmatter.value.type].filter(Boolean).join(' · '))
</script>

<template>
  <header class="cw-page-meta">
    <div v-if="typeLabel" class="cw-eyebrow"><a :href="withBase(browseUrl({ category: frontmatter.category || frontmatter.type }))">{{ frontmatter.category || frontmatter.type }}</a><span v-if="frontmatter.category && frontmatter.type"> · {{ frontmatter.type }}</span></div>
    <h1>{{ frontmatter.title }}</h1>
    <p v-if="frontmatter.description" class="cw-page-description">{{ frontmatter.description }}</p>
    <div v-if="frontmatter.tags?.length" class="cw-tags">
      <a v-for="tag in frontmatter.tags" :key="tag" :href="withBase(browseUrl({ tags: [tag] }))">{{ tag }}</a>
    </div>
    <div v-if="frontmatter.contributors?.length" class="cw-meta-contributors">
      <span>贡献者</span>
      <ContributorList :names="frontmatter.contributors" compact />
    </div>
  </header>
</template>
