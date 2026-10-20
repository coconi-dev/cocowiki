# 开发架构与发布

## 模块边界

- `src/shared/content.ts`：`ContentPage` 为完整源模型，`ContentRecord` 为浏览器投影；旧名称 `SearchRecord` 保留为类型别名。
- `src/shared/routes.ts`：base、规范路由、URL 编码与当前路由匹配。
- `src/node/validation.ts`：配置、元数据、贡献者信息校验；抛出带 `file/field` 的 `ContentError`，不终止进程。
- `src/node/content.ts`：扫描真实源页面，解析一次元数据，查询源 Git 时间，检查路由与标题/别名冲突，并派生搜索标志。
- `src/node/project.ts`：项目目录和 dev/build/preview 运行路径。
- `src/node/runtime.ts`：消费已解析页面、生成运行文件与主题入口、保存清单、清理残留。源码与元数据来自同一个页面快照。
- `src/node/cli.ts`：命令、独立文件监听、串行更新和服务状态。`bin/cocowiki.mjs` 只调用命令及报告未处理错误。
- `src/node/dev-instance.ts`：独占租约和 HTTP 实例身份验证，正常退出释放，崩溃后可恢复。
- `src/node/snapshot.ts`：同一进程中按运行目录保存已提交快照；通过全局 symbol 让分别打包的 CLI 与适配层共享数据，不是通用事件总线。
- `src/node/vitepress.ts`：VitePress 配置、虚拟模块、搜索快照端点、静态资源输出和开发通知。上游相关行为集中在这里。
- `src/theme/content.ts`：共享响应式内容仓库、加载/错误/版本状态、刷新与请求竞态控制。

## 更新与恢复

开发状态为 starting → running → restarting；无法启动时进入 failed；收到退出信号进入 stopping。

一次内容变更按顺序执行：合并受影响源页面 → 校验完整页面身份与执行预检查 → 暂存生成内容 → 写入运行目录并清理清单残留 → 提交快照 → 通知浏览器。命令中的 Promise 队列串行执行更新；扫描期间又发生变化时丢弃过期扫描的提交，保留受影响路径，等待最新一次更新。失败的路径也会保留，避免无关事件绕过尚未修复的内容错误。

配置变更先加载、校验并检查主题文件、组件名称、内容数据及 include，再关闭旧服务。预检查失败时旧服务继续运行；真正替换服务失败时尝试使用上一个配置恢复。配置监听属于 CLI，不随 Vite 会话关闭；即使恢复也失败，修复文件后仍可重新尝试。首次端口冲突明确报错退出；首次配置或内容错误保留监听等待修复。

VitePress 使用生成的稳定配置入口读取已提交的配置，不再单独监听用户配置并与 CLI 竞争重启。配置导入依赖在加载成功后、校验之前就由 CLI 建立监听；首次配置校验失败时，修复项目外的已加载依赖也能触发重试。构建和预览使用独立目录，不修改正在运行的开发站点。

Wiki 名称映射摘要写入生成 Markdown 的隐藏注释。名称映射变化时，即使引用页源文件未改变，VitePress 编译缓存也会获得新的 Markdown 源；只清空 Vite 模块缓存不能保证这件事。

## 增量成本与 Git 缓存

每个内容目录拥有会话级扫描器。普通页面与元数据编辑只检查对应页面的文件签名并重新解析改变的内容，其余页面对象复用；新增、删除、目录变更、历史变化或失败恢复时重新发现页面集合。完整路由、标题与别名冲突仍在合并后的全体页面上校验。

Git 提交时间按源文件和当前 HEAD 缓存，包括尚未提交文件的空结果。普通正文编辑只进行一次 `rev-parse HEAD`，不重新执行全部页面的 `git log`；组件和普通数据编辑直接复用已提交内容快照，不发起 Git 查询。冷启动、HEAD 改变或显式历史失效后重新查询日期，查询按八个页面一组限制并发。项目内 `.git/HEAD`、refs、packed-refs 和 shallow 变更会请求统一失效；其他场景也会在下一次内容扫描检查 HEAD。

运行目录复用未改变页面的渲染结果及未改变资源，避免重新解析全部 Markdown 和读取全部生成文件。目录盘点、全局身份校验和完整索引/清单序列化仍随页面数量增长；标题、别名或路由改变时，为更新跨页 Wiki 内链，会主动使全体 Markdown 的编译缓存失效。这里没有声称每次更新都是常数成本。

## 验证

安装依赖后从仓库根目录执行：

```sh
pnpm typecheck
pnpm test:content
pnpm test:navigation
pnpm test:dev
pnpm build
```

`test:dev` 会先构建框架发布产物，再在临时目录启动实际 CLI，验证配置失败恢复、实例复用、退出/崩溃恢复、源目录切换、开发与构建并行、别名重新编译、Vue 页面清理，以及含 base、相对导入/include 和目录页的实际静态输出。

浏览器仓库测试使用 Vue 挂载多个消费者，验证请求共享、响应式更新、失败状态和请求乱序保护。所有集成测试在临时目录写文件，不修改 playground 内容。端口测试需要允许监听本地回环端口。

## 发布流程

1. 同步更新根 `package.json`、`packages/cocowiki/package.json` 和 `packages/create-cocowiki/package.json` 的版本。
2. 同步 `packages/create-cocowiki/template/package.json` 中 `cocowiki` 的依赖范围。`playground` 继续使用 `workspace:*`，不用替换成发布版本。
3. 将面向用户的示例内容、配置、Vue 组件和数据同步到 `playground/` 与 `template/`。模板保留站点名称占位符；初始化器按 TypeScript 字符串和 YAML 标量分别转义。
4. 执行上面的验证命令，再分别在两个包目录执行 `pnpm pack` 检查 tarball。框架 `prepack` 必须产出 `dist/config.js`、`dist/node/vitepress.js`、`dist/node/cli.js`，同时发布主题源码；初始化器发布 bin 和完整 template。
5. 在临时目录用框架 tarball 安装并构建生成项目，确认入口 exports、CLI 和模板版本匹配。
6. 经发布者确认后，先发布 `cocowiki`，再发布依赖该版本的 `create-cocowiki`，最后添加对应 Git tag/release。

修改框架 Node 源码后需先执行框架 `build:package`，因为 workspace 也通过包 exports/bin 使用 dist。修改 Vue 主题源码通常由 Vite 直接读取。
