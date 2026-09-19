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
      <div><p class="cw-kicker">VUE PAGE EXAMPLE</p><h1>组件图鉴</h1><p>这是一个由静态 JSON 驱动的纯 Vue 页面，用来验证搜索、筛选与排序。</p></div>
      <strong>{{ filtered.length }} <small>项</small></strong>
    </header>

    <section class="atlas-toolbar" aria-label="图鉴筛选">
      <label class="atlas-search"><span>⌕</span><input v-model="query" type="search" placeholder="搜索组件"></label>
      <label><span>状态</span><select v-model="rarity"><option value="all">全部</option><option v-for="name in rarities" :key="name" :value="name">{{ rarityLabel[name] }}</option></select></label>
      <label><span>层级</span><select v-model="category"><option value="all">全部</option><option v-for="name in categories" :key="name" :value="name">{{ categoryLabel[name] }}</option></select></label>
      <label><span>排序</span><select v-model="sort"><option value="rarity">状态</option><option value="name">名称</option></select></label>
    </section>

    <section class="atlas-grid">
      <article v-for="(item, index) in filtered" :key="item.id" class="atlas-card">
        <span class="atlas-card__index">{{ String(index + 1).padStart(2, '0') }}</span>
        <div class="atlas-card__content">
          <div class="atlas-card__meta"><span>{{ categoryLabel[item.category] }}</span><b>{{ rarityLabel[item.rarity] }}</b></div>
          <h2>{{ item.name }}</h2>
          <p>{{ item.description }}</p>
          <footer><span>维护者</span><strong>{{ item.contributors.join(' · ') }}</strong></footer>
        </div>
      </article>
      <div v-if="!filtered.length" class="cw-empty"><strong>没有符合条件的项目</strong><p>调整关键词或筛选条件再试一次。</p></div>
    </section>

    <footer class="atlas-footer"><div><h2>页面维护者</h2><p>数据、逻辑和界面由三位机器人分别维护。</p></div><ContributorList :names="allContributors" /></footer>
  </div>
</template>

<style scoped>
.atlas-header { display: flex; align-items: end; justify-content: space-between; gap: 30px; padding: 6px 0 24px; border-bottom: 1px solid var(--cw-border); }
.atlas-header h1 { margin: 5px 0 3px; font-family: Georgia, "Noto Serif SC", serif; font-size: clamp(2rem, 5vw, 3rem); line-height: 1.2; }
.atlas-header p:last-child { max-width: 620px; margin: 0; color: var(--cw-muted); font-size: .9rem; }
.atlas-header > strong { color: var(--cw-accent); font-family: Georgia, serif; font-size: 2.3rem; }
.atlas-header > strong small { color: var(--cw-muted); font: 500 .7rem Inter, sans-serif; }
.atlas-toolbar { position: sticky; top: 56px; z-index: 15; display: grid; grid-template-columns: 1fr repeat(3, 135px); margin-bottom: 18px; border: 1px solid var(--cw-border); border-top: 0; background: var(--cw-header); backdrop-filter: blur(8px); }
.atlas-toolbar label { display: flex; align-items: center; min-height: 48px; padding: 0 13px; border-left: 1px solid var(--cw-border); }
.atlas-toolbar label > span { margin-right: auto; color: var(--cw-muted); font-size: .68rem; font-weight: 700; }
.atlas-toolbar select { max-width: 76px; color: var(--cw-text); border: 0; outline: 0; background: transparent; font-size: .76rem; }
.atlas-toolbar .atlas-search { border-left: 0; }
.atlas-search > span { color: var(--cw-accent) !important; font-size: 1.1rem !important; }
.atlas-search input { min-width: 0; flex: 1; color: var(--cw-text); border: 0; outline: 0; background: transparent; }
.atlas-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
.atlas-card { display: grid; grid-template-columns: 44px 1fr; min-width: 0; padding: 16px; border: 1px solid var(--cw-border); border-radius: var(--cw-radius); background: var(--cw-surface); }
.atlas-card:hover { border-color: var(--cw-accent); }
.atlas-card__index { color: var(--cw-muted); font: .72rem Georgia, serif; }
.atlas-card__meta { display: flex; justify-content: space-between; color: var(--cw-muted); font-size: .66rem; }
.atlas-card__meta b { color: var(--cw-gold); }
.atlas-card h2 { margin: 5px 0 3px; font-family: Georgia, "Noto Serif SC", serif; font-size: 1.06rem; }
.atlas-card p { min-height: 2.8em; margin: 0; color: var(--cw-muted); font-size: .78rem; line-height: 1.5; }
.atlas-card footer { display: flex; justify-content: space-between; margin-top: 12px; padding-top: 9px; border-top: 1px solid var(--cw-border); font-size: .66rem; }
.atlas-card footer span { color: var(--cw-muted); }
.atlas-footer { display: flex; align-items: center; justify-content: space-between; gap: 25px; margin-top: 34px; padding: 22px 0; border-top: 1px solid var(--cw-border); }
.atlas-footer h2 { margin: 0; font-family: Georgia, "Noto Serif SC", serif; font-size: 1rem; }
.atlas-footer p { margin: 2px 0 0; color: var(--cw-muted); font-size: .75rem; }
@media (max-width: 760px) { .atlas-toolbar { position: static; grid-template-columns: 1fr 1fr; border-top: 1px solid var(--cw-border); } .atlas-search { grid-column: 1 / -1; } .atlas-grid { grid-template-columns: 1fr; } }
@media (max-width: 560px) { .atlas-header { align-items: start; flex-direction: column; } .atlas-toolbar label { border-bottom: 1px solid var(--cw-border); } .atlas-footer { align-items: start; flex-direction: column; } }
</style>
