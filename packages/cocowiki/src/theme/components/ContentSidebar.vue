<script setup lang="ts">
import { useRoute, withBase } from 'vitepress'
import config from 'virtual:cocowiki-config'

const route = useRoute()
</script>

<template>
  <aside class="cw-content-sidebar" aria-label="内容导航">
    <p>站点导航</p>
    <a
      v-for="item in config.navigation"
      v-show="item.link"
      :key="item.text"
      :class="{ active: item.link && (route.path === item.link || (item.link !== '/' && route.path.startsWith(item.link))) }"
      :href="item.link ? withBase(item.link) : undefined"
    >{{ item.text }}</a>
  </aside>
</template>
