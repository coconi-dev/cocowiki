---
title: 欢迎使用 CoCoWiki
description: 把散落的故事，慢慢收进这里。
type: guide
category: 使用指南
tags:
  - CoCoWiki
  - Markdown
  - Vue
contributors:
  - 皙折
---

# 欢迎使用 CoCoWiki

**CoCoWiki 是一个基于 VitePress 深度封装的轻量静态 Wiki 框架。**

它面向小型 Wiki、世界观资料站、设定集和资料归档站。你主要负责写 Markdown、Vue 组件和静态数据，CoCoWiki 负责路由、主题、搜索、归档与静态构建。

CoCoWiki 不要求内容拥有完整目录或固定阅读顺序，因此尤其适合碎片内容较多、词条类型复杂的资料库。访问者不必沿着目录逐页阅读，而是通过全站搜索直接找到需要的内容。

## 三种页面形式

| 页面形式 | 适合内容 |
| --- | --- |
| 普通 Markdown | 人物、地点、概念、说明文档 |
| Markdown + Vue | 在文章中嵌入图表、列表或交互组件 |
| 纯 Vue 页面 | 图鉴、时间线、关系图和复杂筛选页面 |

当前页面是普通 Markdown 页面；Markdown 中也可以直接使用 `components/` 中自动注册的 Vue 组件。[[组件图鉴]] 则是一张从 `.page.vue` 生成的纯 Vue 页面。

## 内容与 Frontmatter

页面元信息写在 Markdown 顶部的 Frontmatter 中。标题、描述、分类、标签、别名和贡献者会自动用于内容页、搜索、归档和贡献统计。

```md
---
title: 示例词条
description: 用一句话介绍当前内容
category: 世界观
tags: [设定, 示例]
aliases: [另一个名字]
contributors: [Mueo]
---

# 示例词条

正文从这里开始。
```

## 搜索与归档

搜索索引在构建期从 Frontmatter 与正文生成，可以检索标题、描述、别名、标签和正文，不需要服务器。归档页默认汇总全部内容页面，并按照分类展示。

## Markdown 扩展

标准 Markdown 可以照常使用，此外还提供少量适合 Wiki 的扩展：

- 使用双方括号创建站内链接，例如 `[[组件图鉴]]`。
- 使用双竖线隐藏剧透内容。
- 使用 `info`、`tip`、`warning`、`danger` 和 `details` 容器强调不同信息。

||这是一段可点击显示的剧透，用来验证桌面端与移动端交互。||

:::tip 搜索优先
面对无需按顺序阅读的碎片化资料，先搜索关键词通常比展开多级目录更直接。
:::

:::warning 构建期优先
能在构建期完成的索引、路由和页面生成，不会被放到运行时重复处理。
:::

## 主题与静态部署

默认主题支持 Light、Dark 和 System 三种模式，包含响应式导航、移动端布局、内容目录以及可配置的前后页导航。Markdown 页默认显示右侧目录，可以通过 `content.outline` 全局设置，也可以在单页 Frontmatter 中用 `outline: false` 关闭；纯 Vue 页面不会自动生成目录。

构建结果是纯 HTML、CSS、JavaScript 和静态资源，可部署到 GitHub Pages、Cloudflare Pages、Vercel、Netlify 或 Nginx。

## 开始使用

```bash
pnpm create cocowiki my-wiki
cd my-wiki
pnpm install
pnpm dev
```

之后只需要在 `content/` 中写 Markdown、在 `components/` 中添加 Vue 组件，或在 `data/` 中维护 JSON / TypeScript 数据。
