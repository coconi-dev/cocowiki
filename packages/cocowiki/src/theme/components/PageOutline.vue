<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useData } from 'vitepress'

interface OutlineHeading { level: number; title: string; slug: string }
const props = withDefaults(defineProps<{ headers?: OutlineHeading[]; variant?: 'desktop' | 'inline' }>(), { variant: 'desktop' })
const headings = ref<OutlineHeading[]>(props.headers || [])
const { site } = useData()
const active = ref('')
const expanded = ref(false)
let elements: HTMLElement[] = []
let frame = 0
let disposed = false
let stop: (() => void) | undefined
function updateActive() {
  frame = 0
  const visible = elements.filter(element => element.getClientRects().length)
  const threshold = Math.max(typeof site.value.scrollOffset === 'number' ? site.value.scrollOffset : 0, document.querySelector('.cw-header')?.getBoundingClientRect().bottom || 0) + 8
  active.value = (visible.filter(element => element.getBoundingClientRect().top <= threshold).at(-1) || visible[0])?.id || ''
}
function scheduleActive() { if (!frame) frame = requestAnimationFrame(updateActive) }
async function refresh() {
  await nextTick()
  if (disposed) return
  elements = Array.from(document.querySelectorAll<HTMLElement>('.cw-prose h2[id], .cw-prose h3[id]'))
  headings.value = elements.map(heading => {
    const title = heading.cloneNode(true) as HTMLElement
    title.querySelector('.header-anchor')?.remove()
    return { level: Number(heading.tagName.slice(1)), title: title.textContent?.trim() || heading.id, slug: heading.id }
  })
  scheduleActive()
}
onMounted(() => {
  void refresh()
  stop = watch(() => props.headers, refresh, { deep: true, flush: 'post' })
  window.addEventListener('scroll', scheduleActive, { passive: true })
  window.addEventListener('resize', scheduleActive)
  window.addEventListener('hashchange', scheduleActive)
})
onUnmounted(() => {
  disposed = true
  stop?.()
  cancelAnimationFrame(frame)
  window.removeEventListener('scroll', scheduleActive)
  window.removeEventListener('resize', scheduleActive)
  window.removeEventListener('hashchange', scheduleActive)
})
</script>

<template>
  <details v-if="headings.length && variant === 'inline'" class="cw-inline-outline" :open="expanded" @toggle="expanded = ($event.target as HTMLDetailsElement).open">
    <summary>本页目录 <span>{{ headings.length }} 个章节</span></summary>
    <nav aria-label="本页目录">
      <a v-for="heading in headings" :key="heading.slug" :class="`level-${heading.level}`" :href="`#${encodeURIComponent(heading.slug)}`" :aria-current="active === heading.slug ? 'location' : undefined">{{ heading.title }}</a>
    </nav>
  </details>
  <aside v-else-if="headings.length" class="cw-outline" aria-label="本页目录">
    <p>本页目录</p>
    <a v-for="heading in headings" :key="heading.slug" :class="`level-${heading.level}`" :href="`#${encodeURIComponent(heading.slug)}`" :aria-current="active === heading.slug ? 'location' : undefined">{{ heading.title }}</a>
  </aside>
</template>
