#!/usr/bin/env node
import fg from 'fast-glob'
import { existsSync } from 'node:fs'
import { copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { basename, dirname, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadConfigFromFile } from 'vite'
import { build, createServer, serve } from 'vitepress'

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
  if (!existsSync(configFile)) fail('未找到 cocowiki.config.ts。')
  const loaded = await loadConfigFromFile({ command: command === 'build' ? 'build' : 'serve', mode: command === 'build' ? 'production' : 'development' }, configFile, projectRoot)
  if (!loaded?.config?.title) fail('配置文件必须提供 title。')
  return loaded.config
}

function resolvePaths(config) {
  const directories = config.directories || {}
  return {
    runtimeRoot: resolve(projectRoot, '.cocowiki/site'),
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
  await writeIfChanged(resolve(configDirectory, 'config.mts'), `import userConfig from ${JSON.stringify(configImport)}\nimport { createVitePressConfig } from 'cocowiki/runtime'\nexport default createVitePressConfig(userConfig, ${JSON.stringify(projectRoot)})\n`)

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
    const server = await createServer(runtimeRoot, options)
    await server.listen()
    let refreshTimer
    let refreshing = false
    let refreshQueued = false
    const changedFiles = new Set()
    let configChanged = false
    let componentsChanged = false

    const watchProjectPaths = () => {
      const paths = resolvePaths(config)
      server.watcher.add([paths.contentDir, paths.componentsDir, configFile])
      return paths
    }
    let watchedPaths = watchProjectPaths()

    const refreshRuntime = async () => {
      if (refreshing) {
        refreshQueued = true
        return
      }
      refreshing = true
      try {
        if (configChanged) {
          configChanged = false
          const nextConfig = await readProjectConfig()
          const nextPaths = resolvePaths(nextConfig)
          const directoriesChanged = nextPaths.contentDir !== watchedPaths.contentDir || nextPaths.componentsDir !== watchedPaths.componentsDir
          config = nextConfig
          await prepareRuntime(config, { clean: directoriesChanged, syncContent: directoriesChanged })
          watchedPaths = watchProjectPaths()
          if (directoriesChanged) changedFiles.clear()
          log.info('配置已更新')
        }
        if (componentsChanged) {
          componentsChanged = false
          await prepareRuntime(config, { clean: false, syncContent: false })
        }
        const files = [...changedFiles]
        changedFiles.clear()
        await Promise.all(files.map((file) => syncContentFile(watchedPaths, file)))
      } catch (error) {
        log.error(error instanceof Error ? error.message : String(error))
      } finally {
        refreshing = false
        if (refreshQueued) {
          refreshQueued = false
          void refreshRuntime()
        }
      }
    }

    server.watcher.on('all', (event, file) => {
      if (file === configFile) configChanged = true
      else if (isInside(watchedPaths.componentsDir, file)) {
        // Existing components are already part of Vite's module graph. Only a
        // changed file list requires regenerating the global registration entry.
        if (event === 'add' || event === 'unlink') componentsChanged = true
        else return
      } else if (isInside(watchedPaths.contentDir, file)) {
        if (event === 'add' || event === 'change' || event === 'unlink') changedFiles.add(file)
        else return
      }
      else return
      clearTimeout(refreshTimer)
      refreshTimer = setTimeout(() => void refreshRuntime(), 80)
    })
    const serverUrl = server.resolvedUrls?.local[0] || `http://localhost:${options.port || 5173}/`
    const url = previewUrl(serverUrl, config.base)
    console.log('')
    log.info(`CoCoWiki v${VERSION}`)
    log.success(`本地预览：${url}`)
    console.log('')
    const close = async () => { await server.close(); process.exit(0) }
    process.on('SIGINT', close)
    process.on('SIGTERM', close)
  }
} catch (error) {
  console.log('')
  log.error(error instanceof Error ? error.message : String(error))
  console.log('')
  process.exit(1)
}
