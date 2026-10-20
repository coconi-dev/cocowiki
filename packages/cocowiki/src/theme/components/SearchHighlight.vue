<script setup lang="ts">
import { computed } from 'vue'
import { highlightParts } from '../search'
const props = defineProps<{ text: string; query: string }>()
const parts = computed(() => highlightParts(props.text, props.query))
</script>
<template><span class="cw-search-highlight"><template v-for="(part, index) in parts" :key="index"><mark v-if="part.match">{{ part.text }}</mark><template v-else>{{ part.text }}</template></template></span></template>
<style scoped>mark { background: var(--cw-accent-soft); color: var(--cw-accent); border-radius: 2px; padding: 0 1px; }</style>
