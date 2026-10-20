<script setup lang="ts">
import { computed } from 'vue'
import { useData } from 'vitepress'
import profiles from 'virtual:cocowiki-contributors'
const { frontmatter } = useData()
const maintenance = computed(() => frontmatter.value.maintenance || {})
const owner = computed(() => Object.hasOwn(profiles, maintenance.value.owner || '') ? profiles[maintenance.value.owner]?.name || maintenance.value.owner : maintenance.value.owner)
</script>
<template>
  <div v-if="maintenance.note || owner || maintenance.reviewed" class="cw-maintenance" aria-label="维护信息">
    <span v-if="owner">维护者：{{ owner }}</span>
    <span v-if="maintenance.reviewed">最近核对：<time :datetime="maintenance.reviewed">{{ maintenance.reviewed.slice(0, 10) }}</time></span>
    <p v-if="maintenance.note">{{ maintenance.note }}</p>
  </div>
</template>
