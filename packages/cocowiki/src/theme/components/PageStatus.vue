<script setup lang="ts">
import { computed } from 'vue'
import { useData } from 'vitepress'
import profiles from 'virtual:cocowiki-contributors'
import { pageStatuses, type PageStatus } from '../../shared/status'
const { frontmatter } = useData()
const definition = computed(() => Object.hasOwn(pageStatuses, frontmatter.value.status || '') ? pageStatuses[frontmatter.value.status as PageStatus] : undefined)
const maintenance = computed(() => frontmatter.value.maintenance || {})
const owner = computed(() => Object.hasOwn(profiles, maintenance.value.owner || '') ? profiles[maintenance.value.owner]?.name || maintenance.value.owner : maintenance.value.owner)
</script>
<template>
  <aside v-if="definition || maintenance.note || owner || maintenance.reviewed" :class="['cw-entry-status', `is-${frontmatter.status || 'none'}`]" role="note" aria-label="词条状态与维护信息">
    <strong>{{ definition?.label || '维护信息' }}</strong>
    <p v-if="definition">{{ definition.message }}</p>
    <p v-if="maintenance.note">{{ maintenance.note }}</p>
    <small v-if="owner">维护者：{{ owner }}</small><small v-if="maintenance.reviewed">最近核对：{{ maintenance.reviewed.slice(0, 10) }}</small>
  </aside>
</template>
<style scoped>
.cw-entry-status { margin-bottom: 24px; padding: 18px 22px; border: 1px solid var(--cw-border); border-left: 4px solid var(--cw-accent); border-radius: 10px; background: var(--cw-surface-soft); }
p { margin: 6px 0; } small { display: inline-block; margin-right: 18px; color: var(--cw-muted); }
.is-outdated { border-left-color: #b86b19; }.is-draft { border-left-color: var(--cw-muted); }
</style>
