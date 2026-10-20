<script setup lang="ts">
import { computed } from 'vue'
import { useData } from 'vitepress'
import { pageStatuses, type PageStatus } from '../../shared/status'
import PageMaintenance from './PageMaintenance.vue'
withDefaults(defineProps<{ standalone?: boolean }>(), { standalone: false })
const { frontmatter } = useData()
const definition = computed(() => Object.hasOwn(pageStatuses, frontmatter.value.status || '') ? pageStatuses[frontmatter.value.status as PageStatus] : undefined)
const needsNotice = computed(() => ['draft', 'outdated'].includes(frontmatter.value.status))
</script>
<template>
  <div v-if="(standalone && (definition || frontmatter.maintenance)) || (definition && needsNotice)" class="cw-page-status">
  <div v-if="standalone" class="cw-standalone-status">
    <span v-if="definition" class="cw-status-chip">{{ definition.label }}</span>
    <PageMaintenance />
  </div>
  <aside v-if="definition && needsNotice" :class="['cw-entry-status', `is-${frontmatter.status}`]" role="note" aria-label="阅读提示">
    <strong>{{ definition.label }}</strong><p>{{ definition.message }}</p>
  </aside>
  </div>
</template>
