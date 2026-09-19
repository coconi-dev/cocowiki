<script setup lang="ts">
import { useData, withBase } from 'vitepress'
import config from 'virtual:cocowiki-config'

defineProps<{ showLastUpdated?: boolean }>()

const { page } = useData()
</script>

<template>
  <footer class="cw-doc-footer">
    <a v-if="config.search?.enabled !== false" :href="withBase('/search')">返回搜索</a>
    <a :href="withBase('/archive')">浏览归档</a>
    <span v-if="showLastUpdated && page.lastUpdated">最后更新：{{ new Date(page.lastUpdated).toLocaleDateString('zh-CN') }}</span>
  </footer>
</template>
