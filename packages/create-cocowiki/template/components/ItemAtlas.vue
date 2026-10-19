<script setup lang="ts">
import { computed, ref } from 'vue'
import items from '../data/items.json'

const query = ref('')
const rarity = ref('all')
const category = ref('all')
const sort = ref('rarity')
const rarityRank: Record<string, number> = { core: 3, stable: 2, extended: 1 }
const rarityLabel: Record<string, string> = { core: '核心', stable: '稳定', extended: '扩展' }
const categoryLabel: Record<string, string> = { data: '数据层', logic: '逻辑层', interface: '交互层' }
const rarities = ['core', 'stable', 'extended']
const categories = [...new Set(items.map((item) => item.category))]
const filtered = computed(() => items
  .filter((item) => !query.value || `${item.name} ${item.description}`.toLocaleLowerCase().includes(query.value.toLocaleLowerCase()))
  .filter((item) => rarity.value === 'all' || item.rarity === rarity.value)
  .filter((item) => category.value === 'all' || item.category === category.value)
  .sort((a, b) => sort.value === 'name' ? a.name.localeCompare(b.name, 'zh-CN') : rarityRank[b.rarity] - rarityRank[a.rarity]))
const allContributors = [...new Set(items.flatMap((item) => item.contributors))]
</script>

<template>
  <div class="atlas">
    <header class="atlas-header">
      <div><h1>组件图鉴</h1><p>浏览组件，找到适合你的内容呈现方式。</p></div>
      <strong>{{ filtered.length }} <small>项</small></strong>
    </header>

    <section class="atlas-toolbar" aria-label="图鉴筛选">
      <label class="atlas-search"><svg class="cw-search-icon" aria-hidden="true" viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4"/></svg><span class="cw-sr-only">搜索组件</span><input v-model="query" type="search" placeholder="搜索组件"></label>
      <label><span>状态</span><select v-model="rarity"><option value="all">全部</option><option v-for="name in rarities" :key="name" :value="name">{{ rarityLabel[name] }}</option></select></label>
      <label><span>层级</span><select v-model="category"><option value="all">全部</option><option v-for="name in categories" :key="name" :value="name">{{ categoryLabel[name] }}</option></select></label>
      <label><span>排序</span><select v-model="sort"><option value="rarity">状态</option><option value="name">名称</option></select></label>
    </section>

    <section class="atlas-grid">
      <article v-for="item in filtered" :key="item.id" class="atlas-card">
        <div class="atlas-card__content">
          <div class="atlas-card__meta"><span>{{ categoryLabel[item.category] }}</span><b>{{ rarityLabel[item.rarity] }}</b></div>
          <h2>{{ item.name }}</h2>
          <p>{{ item.description }}</p>
          <footer><span>维护者</span><strong>{{ item.contributors.join(' · ') }}</strong></footer>
        </div>
      </article>
      <div v-if="!filtered.length" class="cw-empty"><strong>没有符合条件的项目</strong><p>调整关键词或筛选条件再试一次。</p></div>
    </section>

    <footer class="atlas-footer"><div><h2>页面维护者</h2><p>感谢参与数据、功能与界面维护的贡献者。</p></div><ContributorList :names="allContributors" /></footer>
  </div>
</template>

<style scoped>
.atlas-header { display: flex; align-items: end; justify-content: space-between; gap: 24px; margin-bottom: 36px; }
.atlas-header h1 { margin: 0 0 16px; font-size: clamp(36px, 5vw, 56px); font-weight: 700; letter-spacing: -.045em; line-height: 1.12; }
.atlas-header p { max-width: 620px; margin: 0; color: var(--cw-muted); font-size: 19px; }
.atlas-header > strong { color: var(--cw-muted); font-size: 17px; font-weight: 400; white-space: nowrap; }
.atlas-header > strong small { font-size: inherit; }
.atlas-toolbar { display: grid; grid-template-columns: minmax(0, 1fr) repeat(3, 150px); gap: 8px; margin-bottom: 32px; }
.atlas-toolbar label { display: flex; align-items: center; min-width: 0; min-height: 50px; gap: 12px; padding: 0 14px; border: 1px solid var(--cw-border-strong); border-radius: 12px; background: var(--cw-surface); }
.atlas-toolbar label:focus-within { outline: 3px solid color-mix(in srgb, var(--cw-accent) 30%, transparent); border-color: var(--cw-accent); }
.atlas-toolbar label > span { flex-shrink: 0; color: var(--cw-muted); font-size: 12px; }
.atlas-toolbar select { width: 100%; min-width: 0; min-height: 44px; color: var(--cw-text); border: 0; outline: 0; background: transparent; font-size: 14px; }
.atlas-search input { width: 100%; min-width: 0; min-height: 44px; color: var(--cw-text); border: 0; outline: 0; background: transparent; font-size: 14px; }
.atlas-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 20px; }
.atlas-card { min-width: 0; padding: 32px; border-radius: var(--cw-radius); background: var(--cw-surface); }
.atlas-card__meta { display: flex; align-items: center; justify-content: space-between; gap: 12px; color: var(--cw-muted); font-size: 12px; }
.atlas-card__meta b { color: var(--cw-muted); font-weight: 400; }
.atlas-card h2 { margin: 16px 0 12px; font-size: 26px; font-weight: 600; letter-spacing: -.025em; }
.atlas-card p { min-height: 3em; margin: 0; color: var(--cw-muted); font-size: 15px; line-height: 1.6; }
.atlas-card footer { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 8px; margin-top: 32px; padding-top: 16px; border-top: 1px solid var(--cw-border); font-size: 12px; }
.atlas-card footer span { color: var(--cw-muted); }
.atlas-card footer strong { font-weight: 500; }
.atlas-footer { display: flex; align-items: center; justify-content: space-between; gap: 24px; margin-top: 64px; padding-top: 32px; border-top: 1px solid var(--cw-border-strong); }
.atlas-footer h2 { margin: 0 0 8px; font-size: 24px; font-weight: 600; letter-spacing: -.025em; }
.atlas-footer p { margin: 0; color: var(--cw-muted); font-size: 14px; }
.atlas-grid > .cw-empty { grid-column: 1 / -1; }
@media (max-width: 850px) { .atlas-toolbar { grid-template-columns: repeat(3, minmax(0, 1fr)); } .atlas-search { grid-column: 1 / -1; } }
@media (max-width: 600px) {
  .atlas-header { align-items: start; flex-direction: column; }
  .atlas-header p { font-size: 17px; }
  .atlas-toolbar { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .atlas-toolbar label { gap: 8px; padding: 0 10px; }
  .atlas-toolbar label:last-child { grid-column: 1 / -1; }
  .atlas-grid { grid-template-columns: minmax(0, 1fr); gap: 12px; }
  .atlas-card { padding: 24px; }
  .atlas-footer { align-items: start; flex-direction: column; }
}
</style>
