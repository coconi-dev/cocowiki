#!/usr/bin/env node
import fg from 'fast-glob'
import { acquireDevInstance } from './dev-instance.mjs'
import { existsSync } from 'node:fs'
import { copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { basename, dirname, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadConfigFromFile } from 'vite'
import { build, createServer, disposeMdItInstance, serve } from 'vitepress'

const VERSION = JSON.parse(await readFile(fileURLToPath(new URL('../package.json', import.meta.url)), 'utf8')).version
const COLOR = { reset: '\x1b[0m', dim: '\x1b[2m', cyan: '\x1b[36m', green: '\x1b[32m', yellow: '\x1b[33m', red: '\x1b[31m', violet: '\x1b[38;5;141m' }
const supportsColor = Boolean(process.stdout.isTTY && !process.env.NO_COLOR)
const paint = (color, text) => supportsColor ? `${color}${text}${COLOR.reset}` : text
const brand = paint(COLOR.violet, '[cocowiki]')
const command = process.argv[2] || 'dev'
const projectRoot = process.cwd()
const configFile = resolve(projectRoot, 'cocowiki.config.ts')
const THEME_COMPONENT_NAMES = new Set([
  'Header', 'Home', 'Search', 'Archive', 'Contributors', 'PageMeta',
  'PageOutline', 'ContentSidebar', 'PageNavigation', 'PageFooter',
  'SearchOverlay', 'Loading', 'NotFound'
])

const log = {
  info(message) { console.log(`${brand} ${paint(COLOR.cyan, message)}`) },
  success(message) { console.log(`${brand} ${paint(COLOR.green, `✓ ${message}`)}`) },
  warn(message) { console.warn(`${brand} ${paint(COLOR.yellow, `⚠ ${message}`)}`) },
  error(message) { console.error(`${brand} ${paint(COLOR.red, `✗ ${message}`)}`) }
}

function fail(message) {
  log.error(message)
  process.exit(1)
}

function pathForImport(fromDirectory, target) {
  const path = relative(fromDirectory, target).split(sep).join('/')
  return path.startsWith('.') ? path : `./${path}`
}

function isInside(parent, filename) {
  const path = relative(parent, filename)
  return path !== '' && !path.startsWith('..') && !path.startsWith(`..${sep}`)
}

function componentName(filename) {
  const stem = basename(filename, '.vue')
  return stem.split(/[-_.\s]+/).filter(Boolean).map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join('')
}

async function writeIfChanged(filename, content) {
  try {
    if (await readFile(filename, 'utf8') === content) return false
  } catch {}
  await mkdir(dirname(filename), { recursive: true })
  await writeFile(filename, content)
  return true
}

function parseOptions(args) {
  const options = {}
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index]
    if (argument === '--host') {
      const value = args[index + 1]
      options.host = value && !value.startsWith('-') ? (index += 1, value) : true
    }
    if (argument === '--port') options.port = Number(args[index += 1])
  }
  return options
}

function previewUrl(serverUrl, requestedBase = '/') {
  const url = new URL(serverUrl)
  const path = requestedBase.replace(/^\/+|\/+$/g, '')
  url.pathname = path ? `/${path}/` : '/'
  return url.href
}

async function readProjectConfig() {
  if (!existsSync(configFile)) throw new Error('未找到 cocowiki.config.ts。')
  const loaded = await loadConfigFromFile({ command: command === 'build' ? 'build' : 'serve', mode: command === 'build' ? 'production' : 'development' }, configFile, projectRoot)
  if (!loaded?.config?.title) throw new Error('配置文件必须提供 title。')
  return loaded.config
}

function resolvePaths(config) {
  const directories = config.directories || {}
  return {
    // Builds and previews must never rewrite a running dev server's sources.
    runtimeRoot: resolve(projectRoot, `.cocowiki/${command === 'dev' ? 'site' : command}`),
    contentDir: resolve(projectRoot, directories.content || 'content'),
    componentsDir: resolve(projectRoot, directories.components || 'components')
  }
}

async function writeVuePage(source, routeFile) {
  const metadataFile = source.replace(/\.page\.vue$/, '.page.json')
  const metadata = existsSync(metadataFile) ? JSON.parse(await readFile(metadataFile, 'utf8')) : {}
  const title = metadata.title || basename(source, '.page.vue')
  const componentImport = pathForImport(dirname(routeFile), source)
  const frontmatter = { ...metadata, layout: 'special', title }
  const frontmatterLines = Object.entries(frontmatter).map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
  await writeIfChanged(routeFile, `---\n${frontmatterLines.join('\n')}\n---\n\n<script setup lang="ts">\nimport CocoPage from ${JSON.stringify(componentImport)}\n</script>\n\n<CocoPage />\n`)
}

async function syncContentFile(paths, changedFile) {
  const path = relative(paths.contentDir, changedFile)
  if (!path || path.startsWith('..')) return

  if (path.endsWith('.page.json')) {
    const source = changedFile.replace(/\.page\.json$/, '.page.vue')
    const routeFile = resolve(paths.runtimeRoot, path.replace(/\.page\.json$/, '.md'))
    if (existsSync(source)) await writeVuePage(source, routeFile)
    return
  }

  if (path.endsWith('.page.vue')) {
    const routeFile = resolve(paths.runtimeRoot, path.replace(/\.page\.vue$/, '.md'))
    if (existsSync(changedFile)) await writeVuePage(changedFile, routeFile)
    else await rm(routeFile, { force: true })
    return
  }

  const destination = resolve(paths.runtimeRoot, path)
  if (existsSync(changedFile)) {
    await mkdir(dirname(destination), { recursive: true })
    await copyFile(changedFile, destination)
  } else {
    await rm(destination, { force: true })
  }
}

async function prepareRuntime(config, { clean = true, syncContent = true } = {}) {
  const paths = resolvePaths(config)
  if (!existsSync(paths.contentDir)) fail(`内容目录不存在：${paths.contentDir}`)

  if (clean) await rm(paths.runtimeRoot, { recursive: true, force: true })
  const configDirectory = resolve(paths.runtimeRoot, '.vitepress')
  const themeDirectory = resolve(configDirectory, 'theme')
  await mkdir(themeDirectory, { recursive: true })

  if (syncContent) {
    const files = await fg('**/*', { cwd: paths.contentDir, onlyFiles: true, dot: true, ignore: ['**/*.page.json'] })
    for (const file of files) {
      const source = resolve(paths.contentDir, file)
      if (file.endsWith('.page.vue')) await writeVuePage(source, resolve(paths.runtimeRoot, file.replace(/\.page\.vue$/, '.md')))
      else {
        const destination = resolve(paths.runtimeRoot, file)
        await mkdir(dirname(destination), { recursive: true })
        await copyFile(source, destination)
      }
    }
  }

  const configImport = pathForImport(configDirectory, configFile)
  await writeIfChanged(resolve(configDirectory, 'config.mts'), `import userConfig from ${JSON.stringify(configImport)}\nimport { createVitePressConfig } from 'cocowiki/runtime'\nexport default createVitePressConfig(userConfig, ${JSON.stringify(projectRoot)}, ${JSON.stringify(paths.runtimeRoot)})\n`)

  const selectedTheme = config.theme?.entry
    ? pathForImport(themeDirectory, resolve(projectRoot, config.theme.entry))
    : 'cocowiki/theme'
  const configuredStyles = config.theme?.styles
  const themeStyles = (Array.isArray(configuredStyles) ? configuredStyles : configuredStyles ? [configuredStyles] : [])
    .map((style) => `import ${JSON.stringify(pathForImport(themeDirectory, resolve(projectRoot, style)))}`)
  const componentEntries = Object.entries(config.theme?.components || {})
  const invalidComponents = componentEntries.filter(([name]) => !THEME_COMPONENT_NAMES.has(name))
  if (invalidComponents.length) {
    fail(`未知主题组件：${invalidComponents.map(([name]) => name).join('、')}。`)
  }
  const globalComponentFiles = existsSync(paths.componentsDir)
    ? await fg('**/*.vue', { cwd: paths.componentsDir, onlyFiles: true })
    : []
  const componentNames = new Map()
  for (const file of globalComponentFiles) {
    const name = componentName(file)
    if (!name) fail(`无法从组件文件名生成全局名称：${file}`)
    const duplicate = componentNames.get(name)
    if (duplicate) fail(`全局组件名称冲突：${duplicate} 与 ${file} 都会注册为 ${name}。`)
    componentNames.set(name, file)
  }
  const overrideDeclarations = componentEntries.map(([name, entry], index) => {
    const source = pathForImport(themeDirectory, resolve(projectRoot, entry))
    return `const ThemeComponent${index} = defineAsyncComponent(() => import(${JSON.stringify(source)}))`
  })
  const overrides = componentEntries.map(([name], index) => `${JSON.stringify(name)}: ThemeComponent${index}`).join(', ')
  const componentsPattern = `${pathForImport(themeDirectory, paths.componentsDir)}/**/*.vue`
  await writeIfChanged(resolve(themeDirectory, 'index.ts'), `import { defineAsyncComponent } from 'vue'\nimport baseTheme from ${JSON.stringify(selectedTheme)}\nimport { cocoWikiThemeComponentsKey } from 'cocowiki/theme/customization'\n${themeStyles.join('\n')}\nconst modules = import.meta.glob(${JSON.stringify(componentsPattern)})\n${overrideDeclarations.join('\n')}\nconst themeComponentOverrides = { ${overrides} }\nfunction componentName(path) {\n  const stem = path.split('/').pop()?.replace(/\\.vue$/, '') || ''\n  return stem.split(/[-_.\\s]+/).filter(Boolean).map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join('')\n}\nexport default {\n  ...baseTheme,\n  enhanceApp(context) {\n    baseTheme.enhanceApp?.(context)\n    context.app.provide(cocoWikiThemeComponentsKey, themeComponentOverrides)\n    for (const [path, loader] of Object.entries(modules)) {\n      const name = componentName(path)\n      if (name) context.app.component(name, defineAsyncComponent(loader))\n    }\n  }\n}\n`)

  return paths.runtimeRoot
}

if (!new Set(['dev', 'build', 'preview']).has(command)) {
  fail(`未知命令“${command}”，可用命令为 dev、build、preview。`)
}

try {
  const instance = command === 'dev' ? await acquireDevInstance(projectRoot) : undefined
  if (instance?.kind === 'existing') {
    log.info(`开发服务已在运行：${instance.url}（PID ${instance.pid}）`)
    process.exit(0)
  }
  if (instance?.kind === 'owner') {
    process.env.COCOWIKI_DEV_INSTANCE = instance.token
    process.once('exit', () => instance.release())
  }
  let config = await readProjectConfig()
  const runtimeRoot = await prepareRuntime(config)
  const options = parseOptions(process.argv.slice(3))

  if (command === 'build') {
    console.log('')
    log.info(`CoCoWiki v${VERSION} · 正在生成静态站点`)
    await build(runtimeRoot)
    log.success(`构建完成：${resolve(projectRoot, config.directories?.out || 'dist')}`)
    console.log('')
  } else if (command === 'preview') {
    console.log('')
    log.info(`CoCoWiki v${VERSION} · 静态预览`)
    await serve({ root: runtimeRoot, port: options.port, host: options.host })
  } else {
    let server
    let stopSession = async () => {}
    let restartPromise
    let stopping = false

    async function startDevServer(projectConfig, root) {
      // VitePress disposes its Markdown renderer on config changes. Its
      // recreation callback must replace the whole server, not call Vite's
      // restart(), which would retain the old VitePress plugin closures.
      let disposed = false
      const activeServer = await createServer(root, { ...options, strictPort: true }, () => {
        // Late events from a closed session must not restart its replacement.
        if (disposed) return Promise.resolve()
        return restartDevServer()
      })
      server = activeServer
      const paths = resolvePaths(projectConfig)
      const changedFiles = new Set()
      let componentsChanged = false
      let refreshTimer
      let refreshPromise

      const scheduleRefresh = () => {
        clearTimeout(refreshTimer)
        refreshTimer = setTimeout(() => void refreshRuntime(), 80)
      }
      const refreshRuntime = async () => {
        if (disposed || refreshPromise) return
        refreshPromise = (async () => {
          if (componentsChanged) {
            componentsChanged = false
            await prepareRuntime(projectConfig, { clean: false, syncContent: false })
          }
          const files = [...changedFiles]
          changedFiles.clear()
          await Promise.all(files.map((file) => syncContentFile(paths, file)))
        })()
        try {
          await refreshPromise
        } catch (error) {
          log.error(error instanceof Error ? error.message : String(error))
        } finally {
          refreshPromise = undefined
          if (!disposed && (componentsChanged || changedFiles.size)) scheduleRefresh()
        }
      }

      const onProjectChange = (event, file) => {
        if (disposed) return
        if (file === configFile) {
          // The VitePress config dependency watcher also requests a restart.
          // Both paths share one promise and the old session cancels its timer.
          clearTimeout(refreshTimer)
          refreshTimer = setTimeout(() => {
            void restartDevServer().catch((error) => log.error(error instanceof Error ? error.message : String(error)))
          }, 80)
          return
        }
        if (isInside(paths.componentsDir, file)) {
          if (event !== 'add' && event !== 'unlink') return
          componentsChanged = true
        } else if (isInside(paths.contentDir, file)) {
          if (!['add', 'change', 'unlink'].includes(event)) return
          changedFiles.add(file)
        } else return
        scheduleRefresh()
      }
      activeServer.watcher.add([paths.contentDir, paths.componentsDir, configFile])
      activeServer.watcher.on('all', onProjectChange)
      stopSession = async () => {
        disposed = true
        clearTimeout(refreshTimer)
        activeServer.watcher.off('all', onProjectChange)
        // Drain pending writes before deleting or rebuilding runtime files.
        await refreshPromise?.catch(() => {})
        await activeServer.close()
      }
      await activeServer.listen()
      const address = activeServer.httpServer?.address()
      const port = typeof address === 'object' && address ? address.port : options.port || 5173
      const localUrl = activeServer.resolvedUrls?.local[0] || `http://localhost:${port}/`
      instance.update('ready', previewUrl(localUrl, projectConfig.base))
    }

    function restartDevServer() {
      if (stopping) return Promise.resolve()
      if (!restartPromise) {
        restartPromise = (async () => {
          const nextConfig = await readProjectConfig()
          if (!existsSync(resolvePaths(nextConfig).contentDir)) throw new Error('配置的内容目录不存在。')
          const directoriesChanged = resolvePaths(config).contentDir !== resolvePaths(nextConfig).contentDir
          instance.update('restarting')
          await stopSession()
          disposeMdItInstance()
          config = nextConfig
          // Preserve generated config/theme files on ordinary restarts. Deleting
          // them produces redundant watcher events and can trigger a loop.
          const nextRoot = await prepareRuntime(config, { clean: directoriesChanged })
          await startDevServer(config, nextRoot)
          log.success('配置已更新，开发服务已重建')
        })().finally(() => { restartPromise = undefined })
      }
      return restartPromise
    }

    await startDevServer(config, runtimeRoot)
    const serverUrl = server.resolvedUrls?.local[0] || `http://localhost:${options.port || 5173}/`
    const url = previewUrl(serverUrl, config.base)
    console.log('')
    log.info(`CoCoWiki v${VERSION}`)
    log.success(`本地预览：${url}`)
    console.log('')
    const close = async () => {
      stopping = true
      instance.update('stopping')
      await restartPromise?.catch(() => {})
      await stopSession()
      disposeMdItInstance()
      process.exit(0)
    }
    process.on('SIGINT', close)
    process.on('SIGTERM', close)
  }
} catch (error) {
  console.log('')
  log.error(error instanceof Error ? error.message : String(error))
  console.log('')
  process.exit(1)
}
