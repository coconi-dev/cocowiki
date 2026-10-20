# 配置与主题扩展

项目入口是 `cocowiki.config.ts`，使用 `defineCocoWikiConfig()` 提供编辑器类型提示。CLI 在开发、构建与预览前执行运行时校验；错误包含配置/内容文件路径及字段名。配置错误不会终止已经启动的开发会话。

## 站点配置

| 字段 | 默认值 | 含义 |
| --- | --- | --- |
| `title` | 必填 | 非空站点名称 |
| `description` | 未设置 | 站点描述，首页标题文案的回退值 |
| `lang` | `zh-CN` | 文档语言 |
| `base` | `/` | 部署路径，自动补齐首尾 `/` |
| `logo` | 未设置 | 导航图标；缺省显示站点首字 |
| `favicon` | `logo`，再回退 `/favicon.svg` | 图标资源；使用回退值时需提供相应文件 |
| `navigation` | 无导航项 | `{ text, link?, items? }[]`；默认导航展示一层下拉菜单 |
| `directories.content` | `content` | Markdown、Vue 页面与内容资源 |
| `directories.components` | `components` | 按文件名自动注册 Vue 组件 |
| `directories.data` | `data` | 静态数据及 `contributors.json` |
| `directories.public` | `public` | 原样发布的公共资源 |
| `directories.out` | `dist` | 静态输出目录 |
| `search.enabled` | `true` | 控制首页、导航、快捷键等搜索入口；不会删除内容索引 |
| `search.include` | 全部 `.md`、`.page.vue`、`.page.json` | 仅决定搜索收录，glob 相对内容目录 |
| `search.exclude` | `[]` | 仅从搜索范围排除匹配文件 |
| `markdown.spoiler` | `true` | `\|\|剧透\|\|` 按钮 |
| `markdown.wikiLink` | `true` | `[[标题或别名]]` 内链 |
| `content.outline` | 未设置，最终默认开启 | 是否展示右侧目录 |
| `content.sidebar` | `outline` | `none`、`light`（站点导航）或 `outline` |
| `content.showPrevNext` | `false` | 是否显示相邻页面导航 |
| `content.showLastUpdated` | `true` | 是否显示日期；无日期时不显示 |

输入目录不能互相重叠，且不能与 `.cocowiki/` 或输出目录重叠。输出目录不能包含项目根目录。

### 首页配置

`home` 支持 `name`、`text`、`tagline`、`eyebrow`、`note`、`search.placeholder`、`visual.image`、`visual.labels` 和 `actions`。

`actions` 是 `{ text, link, theme?: 'brand' | 'alt' }[]`。`brand` 使用强调字重，`alt` 使用普通入口样式。`visual.image` 展示居中图片，`visual.labels` 展示图片下的文字标签。图片为空时仍可单独展示标签。

首页 Frontmatter 的 `hero` 覆盖配置 `home`，采用**浅合并**：例如设置 `hero.search` 会替换整个 `home.search`。首页主文案依次取 `hero/home.text`、站点描述、站点名称。

### 内容元数据

| 字段 | 类型/默认值 | 含义 |
| --- | --- | --- |
| `title` | 字符串 | Markdown 缺省取首个一级标题，再取文件名；Vue 缺省取文件名 |
| `layout` | `doc` | 默认主题识别 `home/search/archive/contributors/doc`；Vue 固定为 `special` |
| `description/type/category/image` | 字符串 | 描述、类型、分类和图片 |
| `tags/aliases/contributors` | 字符串数组，默认 `[]` | 标签、内链别名和贡献者标识 |
| `search` | `true` | 是否参加全文搜索；为兼容现有规则，`false` 也排除相邻导航 |
| `archive` | `true` | 是否参加归档，不影响搜索或贡献统计 |
| `updated` | 有效日期字符串 | 覆盖源文件 Git 提交时间；建议 `YYYY-MM-DD` 或带时区 ISO 字符串 |
| `order` | 有限数值 | 阅读顺序；缺省或无效数值排在最后，兼容旧版本行为 |
| `outline/sidebar/showPrevNext/showLastUpdated` | 同站点配置 | 单页覆盖 |

`outline` 和 `sidebar` 的优先级：先分别取单页值，再取站点值；得到 `outline: true` 时使用右侧目录，`outline: false` 时仅保留显式的 `light` 导航，否则隐藏侧栏。未设置 `outline` 时使用 `sidebar`，缺省为 `outline`。纯 Vue 页面不使用文档侧栏、页脚和相邻导航。

最后更新时间来自实际源文件的 Git 历史。Vue 页取 `.page.vue` 与现存 `.page.json` 中较新的提交时间。`updated` 优先于 Git；两者都没有时不显示日期。未提交的编辑不会自动变成最后提交时间以外的新日期。

## 主题扩展契约

- `theme.entry`：项目根目录相对路径，默认 `cocowiki/theme`。完整 VitePress 主题入口；自定义主题应自行提供 `Layout`。
- `theme.styles`：一个样式路径或路径数组，在默认主题样式后导入。
- `theme.components`：下表中的组件名到项目文件路径的映射；组件异步加载。未知名称与缺失文件在预检查时报告。
- `components/**/*.vue`：按文件名转换 PascalCase 全局注册；目录不参与命名，同名冲突会报错。
- `@components` 与 `@data`：分别指向配置后的组件、数据目录。

| 覆盖名称 | Props | 事件 | 用途 |
| --- | --- | --- | --- |
| `Header` | 无 | `open-search` | 顶部导航与搜索入口 |
| `Home` | 无 | 无 | 首页 |
| `Search` | 无 | 无 | 完整搜索页 |
| `Archive` | 无 | 无 | 归档页 |
| `Contributors` | 无 | 无 | 贡献者页 |
| `PageMeta` | 无 | 无 | 普通文档标题与元信息 |
| `PageOutline` | `headers?: {level,title,slug}[]` | 无 | 内容目录；默认组件在挂载后提取实际 h2/h3 |
| `ContentSidebar` | 无 | 无 | 左侧站点导航 |
| `PageNavigation` | 无 | 无 | 相邻文档链接 |
| `PageFooter` | `showLastUpdated?: boolean` | 无 | 文档页脚 |
| `SearchOverlay` | 无 | `close` | 搜索弹层；实现者负责焦点、键盘与滚动恢复 |
| `Loading` | 无 | 无 | 异步路由加载状态 |
| `NotFound` | 无 | 无 | 404 页面 |

这些覆盖点没有命名插槽。组件可通过 VitePress 的 `useData()`、`useRoute()` 读取页面状态。Vue 功能页由路由组件本身渲染，不通过普通文档壳包裹。

`cocowiki/theme/components` 导出默认组件，适合在覆盖组件中复用；`cocowiki/theme` 导出 `CocoWikiLayout`、贡献登记函数和组件注入 key。
