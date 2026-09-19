import { defineCocoWikiConfig } from 'cocowiki'

export default defineCocoWikiConfig({
  title: '__COCOWIKI_SITE_NAME__',
  description: '一个由 Markdown、Vue 和静态数据组成的轻量资料站示例。',
  lang: 'zh-CN',
  // 部署到子目录时可改为 '/my-wiki/'，根目录部署保持 '/'。
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
        { text: '组件图鉴', link: '/atlas' },
        { text: '归档索引', link: '/archive' },
        { text: '贡献者', link: '/contributors' }
      ]
    }
  ],
  home: {
    visual: {
      image: '/cocowiki-logo.png',
      labels: ['Markdown', 'Vue', 'Search', 'Static', 'Theme', 'Archive']
    }
  },
  search: { enabled: true },
  markdown: { spoiler: true, wikiLink: true },
  content: {
    outline: true,
    showPrevNext: true,
    showLastUpdated: true
  }
})
