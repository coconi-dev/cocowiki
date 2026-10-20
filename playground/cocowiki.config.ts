import { defineCocoWikiConfig } from 'cocowiki'

export default defineCocoWikiConfig({
  title: 'CoCoWiki',
  description: '一个由 Markdown、Vue 和静态数据组成的轻量资料站示例。',
  lang: 'zh-CN',
  base: '/',
  logo: '/cocowiki-logo.png',
  favicon: '/favicon.png',
  navigation: [
    { text: '首页', link: '/' },
    { text: '欢迎使用 CoCoWiki', link: '/welcome' },
    {
      text: '探索',
      link: '/atlas',
      items: [
        { text: '雾灯港 · 地点', link: '/harbor/' },
        { text: '岑舟 · 人物', link: '/cen-zhou' },
        { text: '巡灯会 · 组织', link: '/lantern-watch' },
        { text: '组件图鉴', link: '/atlas' },
        { text: '归档索引', link: '/archive' },
        { text: '贡献者', link: '/contributors' }
      ]
    }
  ],
  search: { enabled: true },
  markdown: { spoiler: true, wikiLink: true },
  content: {
    outline: true,
    showPrevNext: true,
    showLastUpdated: true
  }
})
