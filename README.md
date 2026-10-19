# CoCoWiki

CoCoWiki 是一个基于 VitePress 深度封装的轻量静态 Wiki 框架。

它面向世界观资料站、设定集和碎片化知识库，将搜索、归档、主题和静态构建收进一套简单约定中。

## 快速开始

```bash
pnpm create cocowiki my-wiki
cd my-wiki
pnpm install
pnpm dev
```

也可以使用 npm：

```bash
npm create cocowiki@latest my-wiki
cd my-wiki
npm install
npm run dev
```

## 核心能力

- 普通 Markdown、Markdown + Vue 和纯 Vue 专属页面
- 搜索标题、描述、别名、标签、正文和贡献者
- 构建期生成全文搜索索引，无需后端服务
- 自动汇总全部内容页面的归档索引
- 页面贡献者展示和贡献次数统计
- `components/` 下的 Vue 组件自动注册
- Wiki 内链、剧透和多种 Markdown 提示容器
- Light、Dark、System 三种主题模式
- 响应式导航、内容目录和移动端布局
- 纯静态构建以及自定义部署根目录

## 用户项目结构

```text
my-wiki/
├─ content/
├─ components/
├─ data/
├─ public/
├─ cocowiki.config.ts
└─ package.json
```

- `content/index.md`：首页。
- `content/**/*.md`：普通 Markdown 或 Markdown + Vue 页面。
- `content/**/*.page.vue`：纯 Vue 专属页面；同名 `.page.json` 提供页面元数据。
- `components/`：Markdown 与专属页面使用的 Vue 组件。
- `data/`：JSON 或 TypeScript 静态数据。
- `public/`：图片、字体和其他静态资源。

框架会在 `.cocowiki/` 中生成内部 VitePress 运行目录，用户不需要维护 `.vitepress/`。

## 自定义文档阅读顺序

在 Markdown Frontmatter 中添加 `order`，底部“上一篇 / 下一篇”会按数值从小到大排列：

```yaml
---
title: 快速开始
order: 1
---
```

下一篇可设置 `order: 2`，后续为 `3`、`10` 等，支持负数、零和小数。纯 Vue 页面在同名 `.page.json` 中设置 `"order": 2`。

未设置或不是有限数值的 `order` 排在最后；相同数值按标题、路径排序。此顺序只用于相邻页面导航，不改变搜索和归档排序。开发预览会随元数据修改更新。

首页、搜索、归档、贡献者布局和 `search: false` 页面不参与导航。`showPrevNext: false` 只隐藏当前页的导航，不会将页面移出阅读顺序。

## 配置部署根目录

站点默认部署在域名根目录。部署到 GitHub Pages 仓库路径、Nginx 子目录或其他带路径前缀的静态地址时，可以在 `cocowiki.config.ts` 中设置：

```ts
export default defineCocoWikiConfig({
  title: '我的资料站',
  base: '/my-wiki/'
})
```

`base` 会统一应用到导航、搜索索引、图片、图标、Wiki 内链和构建资源。根目录部署使用 `base: '/'`。

## 仓库结构

```text
cocowiki/
├─ packages/
│  ├─ cocowiki/          # 框架、CLI、构建适配与默认主题
│  └─ create-cocowiki/   # 项目初始化器与默认模板
├─ playground/           # 功能展示与集成验证站点
├─ package.json
└─ pnpm-workspace.yaml
```

源码仓库使用 pnpm workspace。安装依赖后，可在仓库根目录执行：

```bash
pnpm dev
pnpm build
pnpm preview
pnpm typecheck
pnpm check
pnpm test:dev
```

同一项目只运行一个开发服务；重复执行 `pnpm dev` 会确认已有实例并显示预览地址，正常退出。首次启动占用当前终端，使用 Ctrl+C 关闭后即可重新启动；端口被其他服务占用时不会自动切换端口。开发、构建和静态预览使用独立的内部运行目录，可在开发服务运行时执行构建。

## 页面与内容约定

Markdown 与 Markdown + Vue 页面默认显示右侧内容目录。

可以通过 `content.outline` 全局设置，也可以在单页 Frontmatter 中使用 `outline: true` 或 `outline: false` 覆盖

纯 Vue 页面不会自动生成目录。

归档页默认收录全部 Markdown 与纯 Vue 内容页。若某个页面不应出现在归档中，可以设置 `archive: false`。

页面贡献者通过 Frontmatter 声明：

```yaml
contributors:
  - Mueo
```

原生贡献者页会从全部页面汇总贡献次数。Vue 功能组件还可以从 `cocowiki/theme` 导入 `registerContributorContributions`，登记组件内部维护的内容。

## License

[MIT](./LICENSE) © Mueo
