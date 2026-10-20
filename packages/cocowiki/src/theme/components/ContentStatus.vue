<script setup lang="ts">
defineProps<{ loading: boolean; error?: Error }>()
defineEmits<{ retry: [] }>()
</script>
<template>
  <div v-if="loading" class="cw-empty" role="status">正在加载资料…</div>
  <div v-else-if="error" class="cw-empty" role="alert"><p>{{ error.message }}</p><button type="button" @click="$emit('retry')">重新加载</button></div>
</template>
