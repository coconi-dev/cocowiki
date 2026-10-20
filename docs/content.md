# 内容规则

## 页面身份与生成清单

每个实际 `.md` 或 `.page.vue` 是一个页面源。`.page.json` 仅为同名 Vue 页面补充元数据；没有 JSON 时按文件名生成页面，孤立 JSON 不生成路由与索引。删除 JSON 后回退默认元数据，删除 Vue 后同步移除生成页面与索引。

| 源路径（相对内容目录） | 规范 URL | 静态输出 |
| --- | --- | --- |
| `index.md` | `/` | `index.html` |
| `guide.md` | `/guide` | `guide.html` |
| `guide/index.md` | `/guide/` | `guide/index.html` |
| `atlas.page.vue` | `/atlas` | `atlas.html` |

目录页尾斜杠属于页面身份，不能在比较当前路由时移除。URL 的路径段统一编码，`base` 由 VitePress 的 `withBase()` 添加。实际路由冲突，以及不同页面的标题/别名冲突，均在扫描时报告涉及的源路径；修改名称以消除歧义。

`.cocowiki/{site,build,preview}/.vitepress/manifest.json` 保存生成文件列表以及源文件、生成路径和路由映射。每次成功更新会清理旧清单中已不存在的文件。升级前没有清单的运行目录会清理未再生成的旧内容文件。不要编辑 `.cocowiki/`；内容目录下的 `.vitepress/` 是保留路径。

## 相对引用

Markdown `<script>` 中的相对静态导入、动态 `import()` 和副作用导入按 Markdown **源文件**的位置解析。例如 `content/demo.md` 的 `../components/Chart.vue` 始终指向项目 `components/Chart.vue`。代码块示例不改写。

Markdown include 的相对路径同样按源文件解析：

```md
<!-- @include: ../snippets/introduction.md -->
```

include 的区域与行范围仍交给 VitePress 处理。使用 `@/` 的 include 相对运行内容根目录，适用于内容目录内的文件。可复用组件与静态数据也可以使用 `@components/Chart.vue`、`@data/items.json`，尤其适合包含脚本的 Markdown 片段。普通同目录图片等内容资源会随内容复制；跨出内容目录的资源建议放进 `public/` 后用站点绝对路径访问。

## 各功能的收录范围

框架先生成完整页面集合，再分别计算功能范围：

- 搜索：符合 `search.include/exclude`、单页 `search !== false`，并排除首页、搜索、归档、贡献者布局。Vue 正文不参与文本提取，使用元数据的描述等字段。
- 归档：`archive !== false`，排除首页、搜索与归档布局；不受搜索 glob 和 `search: false` 影响。
- 相邻导航：排除首页、搜索、归档、贡献者布局和 `search: false` 页面；不受搜索 glob 影响。按 `order`、标题、路由排序；`showPrevNext: false` 仅隐藏当前页入口。
- 贡献统计：完整页面集合，每页同名贡献者计一次，不受搜索或归档筛选影响。
- Wiki 内链：完整页面集合，按标题/别名定位，未找到时跳转搜索页。开发时更新名称会使引用页重新编译。

`search-index.json` 为兼容既有客户端保留文件名，实际携带的是完整公共内容快照。它不携带本机绝对源路径、生成路径或原始脚本。搜索本身由浏览器根据收录标志建立 MiniSearch 索引。

## 贡献登记

`data/contributors.json` 为“贡献者标识 → 简介对象”的字典，简介支持字符串字段 `name/initials/role/avatar/url/github`。Frontmatter 的 `contributors` 引用这些标识；不存在简介的标识仍可展示与计数。

功能组件可以登记内部条目：

```ts
import { onUnmounted } from 'vue'
import { registerContributorContributions } from 'cocowiki/theme'

const unregister = registerContributorContributions('my-atlas', {
  Alice: 4,
  Bob: 2
})
onUnmounted(unregister)
```

传入字符串数组时按出现次数统计；计数字典要求非负有限数值。`sourceId` 表示一份贡献来源，同 ID 的新登记替换旧登记，旧清理函数不会删除后来的登记。卸载或替换数据时调用清理函数；组件登记仅在其当前运行生命周期内有效，需要始终存在的统计应放在站点级常驻组件登记。

搜索、归档、贡献者和相邻导航共享响应式仓库。重复挂载合并首次请求，开发事件统一刷新；更新失败保留最后有效内容并展示错误和重试入口。较旧请求不会覆盖较新请求。
