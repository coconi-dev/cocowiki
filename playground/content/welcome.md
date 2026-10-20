---
title: 欢迎使用 CoCoWiki
order: 1
related: [组件图鉴, 雾灯港]
status: stable
maintenance:
  owner: 皙折
  note: 本页示例已整理，新增能力时请同步更新。
  reviewed: '2026-10-20'
description: 了解内容编写、组件使用与站点配置。
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

## 先体验一组词条

只用三个短词条，看看内容如何连接：从 [[雾港]] 出发，认识向导 [[岑舟]] 和组织 [[巡灯会]]。“雾港”是“雾灯港”的别名，两种写法会进入同一页面。

| 想体验的能力 | 入口与操作 |
| --- | --- |
| 反向链接与手动关联 | 打开 [雾灯港](/harbor/)，查看底部“关联词条”和“引用此页” |
| 分类、标签与组合筛选 | 点击词条的分类或标签，或直接打开[地点 + 旅行](/archive?category=地点&tag=旅行) |
| 中文多词搜索与高亮 | 搜索[雾港 灯塔](/search?q=雾港%20灯塔)，观察标题高亮与命中片段 |
| 无结果提示 | 试试[一个不存在的关键词](/search?q=月球面包店)，再缩短关键词或返回归档 |
| 草稿、过时与待补充 | 查看 [岑舟](/cen-zhou)、[巡灯会](/lantern-watch) 和 [[组件图鉴]] 顶部的状态说明 |
| 集中查看待维护内容 | 打开[待完善词条](/archive?status=needs-attention)，还可以继续叠加分类、标签 |
| 贡献登记与统计 | 查看页首贡献者，并进入[贡献者页](/contributors) 查看参与的词条数量 |

## 三种页面形式

| 页面形式 | 适合内容 |
| --- | --- |
| 普通 Markdown | 人物、地点、概念、说明文档 |
| Markdown + Vue | 在文章中嵌入图表、列表或交互组件 |
| 纯 Vue 页面 | 图鉴、时间线、关系图和复杂筛选页面 |

当前页面是普通 Markdown 页面；Markdown 中也可以直接使用 `components/` 中自动注册的 Vue 组件。[[组件图鉴]] 则是一张从 `.page.vue` 生成的纯 Vue 页面。

### 在 Markdown 中嵌入 Vue

下面折叠区域复用与纯 Vue 页面相同的 `ItemAtlas` 组件。展开后尝试筛选，不需要离开文章。

:::details 展开交互组件示例
<ItemAtlas />
:::

## 内容与 Frontmatter

页面元信息写在 Markdown 顶部的 Frontmatter 中。标题、描述、分类、标签、别名和贡献者会自动用于内容页、搜索、归档和贡献统计。

```md
---
title: 示例词条
order: 10
description: 用一句话介绍当前内容
category: 世界观
tags: [设定, 示例]
aliases: [另一个名字]
contributors: [Mueo]
---

# 示例词条

正文从这里开始。
```

## 自定义阅读顺序

在 Markdown 顶部的 Frontmatter 设置 `order`，底部“上一篇 / 下一篇”会按数字从小到大排列，例如 `order: 1`、`order: 2`、`order: 10`。允许负数、零和小数。

未设置 `order` 的页面排在已设置页面之后；数值相同时按标题、路径排序。纯 Vue 页面可在同名 `.page.json` 中设置 `"order": 2`。该字段只控制相邻页面导航，不改变搜索和归档的排序。

首页、搜索、归档、贡献者布局以及 `search: false` 的页面不参与相邻页面导航；`showPrevNext: false` 可隐藏当前文档底部的导航，但不会将该文档移出阅读顺序。

## 搜索与归档

搜索索引在构建期从 Frontmatter 与正文生成，可以检索标题、描述、别名、标签、贡献者和正文，不需要服务器。归档页默认汇总全部内容页面，并按照分类展示。

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

## 内容质量检查

在项目目录运行：

```bash
pnpm check
# 需要机器可读的检查结果时：
pnpm exec cocowiki check --json
```

检查会报告无法解析的 Wiki 链接、失效的站内路径与锚点、缺失图片、未登记的贡献者或维护者。本示例保持检查通过；你可以临时把 `[[雾港]]` 改成不存在的标题，运行检查后再还原。浏览站点时，找不到的 Wiki 词条仍会跳转搜索。

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
