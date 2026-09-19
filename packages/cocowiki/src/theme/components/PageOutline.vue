<script setup lang="ts">
import { nextTick, onMounted, ref } from 'vue'

interface OutlineHeading {
  level: number
  title: string
  slug: string
}

const props = defineProps<{ headers?: OutlineHeading[] }>()
const headings = ref<OutlineHeading[]>(props.headers || [])

onMounted(async () => {
  await nextTick()
  headings.value = Array.from(document.querySelectorAll<HTMLElement>('.cw-prose h2[id], .cw-prose h3[id]')).map((heading) => {
    const title = heading.cloneNode(true) as HTMLElement
    title.querySelector('.header-anchor')?.remove()
    return {
      level: Number(heading.tagName.slice(1)),
      title: title.textContent?.trim() || heading.id,
      slug: heading.id
    }
  })
})
</script>

<template>
  <aside v-if="headings.length" class="cw-outline" aria-label="本页目录">
    <p>本页目录</p>
    <a v-for="heading in headings" :key="heading.slug" :class="`level-${heading.level}`" :href="`#${heading.slug}`">
      {{ heading.title }}
    </a>
  </aside>
</template>
