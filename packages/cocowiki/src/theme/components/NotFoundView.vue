<script setup lang="ts">
import { withBase } from 'vitepress'
</script>

<template>
  <section class="cw-not-found">
    <div class="cw-not-found__number" aria-hidden="true">404</div>
    <h1>找不到这个页面。</h1>
    <p>页面可能已移动，或链接地址有误。</p>
    <nav aria-label="离开未找到页面">
      <a class="is-primary" :href="withBase('/')">返回首页</a>
      <a :href="withBase('/archive')">浏览归档</a>
    </nav>
  </section>
</template>
