<script setup lang="ts">
import { computed } from 'vue'
import { useData } from 'vitepress'
import ContributorList from './ContributorList.vue'

const { frontmatter } = useData()
const typeLabel = computed(() => [frontmatter.value.category, frontmatter.value.type].filter(Boolean).join(' · '))
</script>

<template>
  <header class="cw-page-meta">
    <div v-if="typeLabel" class="cw-eyebrow"><span></span>{{ typeLabel }}</div>
    <h1>{{ frontmatter.title }}</h1>
    <p v-if="frontmatter.description" class="cw-page-description">{{ frontmatter.description }}</p>
    <div v-if="frontmatter.tags?.length" class="cw-tags">
      <span v-for="tag in frontmatter.tags" :key="tag">{{ tag }}</span>
    </div>
    <div v-if="frontmatter.contributors?.length" class="cw-meta-contributors">
      <span>贡献者</span>
      <ContributorList :names="frontmatter.contributors" compact />
    </div>
  </header>
</template>
