#!/usr/bin/env node
import fg from 'fast-glob'
import { existsSync, watch as watchFiles } from 'node:fs'
import { copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadConfigFromFile } from 'vite'
import { build, createServer, serve } from 'vitepress'

const VERSION = JSON.parse(await readFile(fileURLToPath(new URL('../package.json', import.meta.url)), 'utf8')).version
const COLOR = { reset: '\x1b[0m', cyan: '\x1b[36m', green: '\x1b[32m', red: '\x1b[31m', violet: '\x1b[38;5;141m' }
const brand = `${COLOR.violet}[cocowiki]${COLOR.reset}`
const command = process.argv[2] || 'dev'
const projectRoot = process.cwd()
const configFile = resolve(projectRoot, 'cocowiki.config.ts')

function fail(message) {
  console.error(`\n${brand} ${COLOR.red}${message}${COLOR.reset}\n`)
  process.exit(1)
}

function pathForImport(fromDirectory, target) {
  const path = relative(fromDirectory, target).split(sep).join('/')
  return path.startsWith('.') ? path : `./${path}`
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

async function prepareRuntime(config) {
  const paths = resolvePaths(config)
  if (!existsSync(paths.contentDir)) fail(`内容目录不存在：${paths.contentDir}`)

  await rm(paths.runtimeRoot, { recursive: true, force: true })
  const configDirectory = resolve(paths.runtimeRoot, '.vitepress')
  const themeDirectory = resolve(configDirectory, 'theme')
  await mkdir(themeDirectory, { recursive: true })

  const files = await fg('**/*', { cwd: paths.contentDir, onlyFiles: true, dot: true, ignore: ['**/*.page.json'] })
  for (const file of files) {
    const source = resolve(paths.contentDir, file)
    if (file.endsWith('.page.vue')) {
      const routeFile = resolve(paths.runtimeRoot, file.replace(/\.page\.vue$/, '.md'))
      const metadataFile = source.replace(/\.page\.vue$/, '.page.json')
      const metadata = existsSync(metadataFile) ? JSON.parse(await readFile(metadataFile, 'utf8')) : {}
      const title = metadata.title || file.split('/').pop().replace(/\.page\.vue$/, '')
      const componentImport = pathForImport(dirname(routeFile), source)
      const frontmatter = { ...metadata, layout: 'special', title }
      const frontmatterLines = Object.entries(frontmatter).map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
      await mkdir(dirname(routeFile), { recursive: true })
      await writeFile(routeFile, `---\n${frontmatterLines.join('\n')}\n---\n\n<script setup lang="ts">\nimport CocoPage from ${JSON.stringify(componentImport)}\n</script>\n\n<CocoPage />\n`)
      continue
    }
    const destination = resolve(paths.runtimeRoot, file)
    await mkdir(dirname(destination), { recursive: true })
    await copyFile(source, destination)
  }

  const configImport = pathForImport(configDirectory, configFile)
  await writeFile(resolve(configDirectory, 'config.mts'), `import userConfig from ${JSON.stringify(configImport)}\nimport { createVitePressConfig } from 'cocowiki/runtime'\nexport default createVitePressConfig(userConfig, ${JSON.stringify(projectRoot)})\n`)

  const selectedTheme = config.theme?.entry
    ? pathForImport(themeDirectory, resolve(projectRoot, config.theme.entry))
    : 'cocowiki/theme'
  const componentsPattern = `${pathForImport(themeDirectory, paths.componentsDir)}/**/*.vue`
  await writeFile(resolve(themeDirectory, 'index.ts'), `import { defineAsyncComponent } from 'vue'\nimport baseTheme from ${JSON.stringify(selectedTheme)}\nconst modules = import.meta.glob(${JSON.stringify(componentsPattern)})\nexport default {\n  ...baseTheme,\n  enhanceApp(context) {\n    baseTheme.enhanceApp?.(context)\n    for (const [path, loader] of Object.entries(modules)) {\n      const name = path.split('/').pop()?.replace(/\\.vue$/, '')\n      if (name) context.app.component(name, defineAsyncComponent(loader))\n    }\n  }\n}\n`)

  return paths.runtimeRoot
}

if (!new Set(['dev', 'build', 'preview']).has(command)) {
  fail(`未知命令“${command}”，可用命令为 dev、build、preview。`)
}

try {
  const config = await readProjectConfig()
  const runtimeRoot = await prepareRuntime(config)
  const options = parseOptions(process.argv.slice(3))

  if (command === 'build') {
    console.log(`\n${brand} ${COLOR.cyan}v${VERSION} · 正在生成静态站点${COLOR.reset}`)
    await build(runtimeRoot)
    console.log(`\n${brand} ${COLOR.green}构建完成：${resolve(projectRoot, config.directories?.out || 'dist')}${COLOR.reset}\n`)
  } else if (command === 'preview') {
    console.log(`\n${brand} ${COLOR.cyan}v${VERSION} · 静态预览${COLOR.reset}`)
    await serve({ root: runtimeRoot, port: options.port, host: options.host })
  } else {
    const server = await createServer(runtimeRoot, options)
    await server.listen()
    let refreshTimer
    let refreshing = false
    let refreshQueued = false
    const refreshRuntime = async () => {
      if (refreshing) {
        refreshQueued = true
        return
      }
      refreshing = true
      try {
        await prepareRuntime(config)
      } finally {
        refreshing = false
        if (refreshQueued) {
          refreshQueued = false
          void refreshRuntime()
        }
      }
    }
    const contentWatcher = watchFiles(resolvePaths(config).contentDir, { recursive: true }, () => {
      clearTimeout(refreshTimer)
      refreshTimer = setTimeout(() => void refreshRuntime(), 80)
    })
    const serverUrl = server.resolvedUrls?.local[0] || `http://localhost:${options.port || 5173}/`
    const url = previewUrl(serverUrl, config.base)
    console.log(`\n${brand} ${COLOR.cyan}v${VERSION}${COLOR.reset}\n\n  ${COLOR.green}本地预览：${url}${COLOR.reset}\n`)
    const close = async () => { contentWatcher.close(); await server.close(); process.exit(0) }
    process.on('SIGINT', close)
    process.on('SIGTERM', close)
  }
} catch (error) {
  console.error(`\n${brand} ${COLOR.red}${error instanceof Error ? error.message : error}${COLOR.reset}\n`)
  process.exit(1)
}
