<script setup lang="ts">
import { withBase } from 'vitepress'
</script>

<template>
  <section class="cw-not-found">
    <div class="cw-not-found__number" aria-hidden="true">404</div>
    <p class="cw-kicker">LOST PAGE</p>
    <h1>这一页没有留下来。</h1>
    <p>也许它被风吹散了，也许从未写下。</p>
    <nav aria-label="离开未找到页面">
      <a class="is-primary" :href="withBase('/')">返回首页</a>
      <a :href="withBase('/archive')">浏览归档</a>
    </nav>
  </section>
</template>
