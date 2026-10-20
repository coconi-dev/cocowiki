import { watch, existsSync } from 'node:fs'
import { resolve, relative, dirname } from 'node:path'
import { loadConfigFromFile } from 'vite'
import { build, createServer, disposeMdItInstance, serve } from 'vitepress'
import { acquireDevInstance } from './dev-instance'
import { scanContent } from './content'
import { validateConfig } from './validation'
import { prepareRuntime, preflightRuntime } from './runtime'
import { snapshots } from './snapshot'
import { resolveProjectPaths, runtimePath, type RuntimeMode } from './project'
import { normalizeBase } from '../shared/routes'
import type { CocoWikiConfig } from '../config'

const log = {
  info: (message: string) => console.log(`[cocowiki] ${message}`),
  error: (error: unknown) => console.error(`[cocowiki] ${error instanceof Error ? error.message : String(error)}`)
}
function parseOptions(args: string[]) {
  const options: { host?: string | boolean; port?: number } = {}
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--host') options.host = args[i + 1] && !args[i + 1].startsWith('-') ? args[++i] : true
    else if (args[i] === '--port') {
      options.port = Number(args[++i])
      if (!Number.isInteger(options.port) || options.port < 1 || options.port > 65535) throw new Error('--port 必须是 1–65535 的整数')
    } else throw new Error(`未知参数：${args[i]}`)
  }
  return options
}

export async function run(args = process.argv.slice(2), projectRoot = process.cwd()) {
  const command = (args[0] || 'dev') as RuntimeMode
  if (!['dev', 'build', 'preview'].includes(command)) throw new Error(`未知命令“${command}”，可用命令为 dev、build、preview。`)
  const options = parseOptions(args.slice(1))
  const configFile = resolve(projectRoot, 'cocowiki.config.ts')
  const root = runtimePath(projectRoot, command)
  const instance = command === 'dev' ? await acquireDevInstance(projectRoot) : undefined
  if (instance?.kind === 'existing') {
    log.info(`开发服务已在运行：${instance.url}（PID ${instance.pid}）`)
    return
  }
  const owner = instance?.kind === 'owner' ? instance : undefined
  if (owner) {
    process.env.COCOWIKI_DEV_INSTANCE = owner.token
    process.once('exit', () => owner.release())
  }
  let configDependencies = new Set([configFile])
  async function readConfig() {
    if (!existsSync(configFile)) throw new Error('未找到 cocowiki.config.ts。')
    const loaded = await loadConfigFromFile({ command: command === 'build' ? 'build' : 'serve', mode: command === 'build' ? 'production' : 'development' }, configFile, projectRoot)
    if (loaded) configDependencies = new Set([configFile, ...loaded.dependencies.map(file => resolve(file))])
    return validateConfig(loaded?.config, projectRoot)
  }
  async function preflight(config: CocoWikiConfig) {
    const pages = await scanContent(resolveProjectPaths(projectRoot, config).contentDir, config.search)
    await preflightRuntime(projectRoot, config, command)
    return pages
  }
  if (command !== 'dev') {
    const config = await readConfig()
    await prepareRuntime(projectRoot, config, command, await preflight(config))
    if (command === 'build') { await build(root); log.info(`✓ 构建完成：${resolveProjectPaths(projectRoot, config).outDir}`) }
    else await serve({ root, ...options })
    return
  }

  let config: CocoWikiConfig | undefined
  let server: Awaited<ReturnType<typeof createServer>> | undefined
  let state: 'starting' | 'running' | 'restarting' | 'failed' | 'stopping' = 'starting'
  let queue = Promise.resolve()
  let timer: ReturnType<typeof setTimeout> | undefined
  let configPending = true
  let revision = 0
  let configurationFailed = false
  const externalWatchers: ReturnType<typeof watch>[] = []
  function watchExternal(next: CocoWikiConfig) {
    externalWatchers.splice(0).forEach(watcher => watcher.close())
    const paths = resolveProjectPaths(projectRoot, next)
    for (const directory of new Set([paths.contentDir, paths.componentsDir, paths.dataDir])) {
      if (!relative(projectRoot, directory).startsWith('..') || !existsSync(directory)) continue
      externalWatchers.push(watch(directory, { recursive: true }, (_event, name) => schedule(configurationFailed || (name !== null && resolve(directory, name.toString()) === resolve(paths.dataDir, 'contributors.json')))))
    }
    for (const file of configDependencies) {
      if (relative(projectRoot, file).startsWith('..') && existsSync(dirname(file))) externalWatchers.push(watch(dirname(file), (_event, name) => {
        if (name && resolve(dirname(file), name.toString()) === file) schedule(true)
      }))
    }
  }

  async function start(nextConfig: CocoWikiConfig) {
    const active = await createServer(root, { ...options, strictPort: true })
    try { await active.listen() } catch (error) { await active.close(); throw error }
    server = active
    const local = active.resolvedUrls?.local[0] || `http://localhost:${options.port || 5173}/`
    const url = new URL(local)
    url.pathname = normalizeBase(nextConfig.base)
    owner!.update('ready', url.href)
    state = 'running'
    log.info(`✓ 本地预览：${url.href}`)
  }
  const isStopping = () => state === 'stopping'
  async function update() {
    if (state === 'stopping') return
    const replace = configPending || !server
    configPending = false
    const version = revision
    const previous = config
    try {
      const next = replace ? await readConfig() : config!
      const pages = await preflight(next)
      if (replace) configurationFailed = false
      if (isStopping()) return
      if (version !== revision) { configPending ||= replace; return }
      if (!replace) {
        await prepareRuntime(projectRoot, next, command, pages)
        snapshots.get(root)?.notify?.()
        return
      }
      state = 'restarting'
      owner!.update('restarting')
      await server?.close()
      server = undefined
      disposeMdItInstance()
      try {
        await prepareRuntime(projectRoot, next, command, pages)
        await start(next)
        config = next
        watchExternal(next)
        if (previous) log.info('✓ 配置已更新，开发服务已重建')
      } catch (error) {
        log.error(error)
        configurationFailed = true
        // An upstream startup failure must not end the independent watcher.
        if (previous) {
          await prepareRuntime(projectRoot, previous, command, await preflight(previous))
          await start(previous)
        } else throw error
      }
    } catch (error) {
      log.error(error)
      if (replace) configurationFailed = true
      if (!server) {
        state = 'failed'; owner!.update('failed')
        if (!previous && /already in use|EADDRINUSE/.test(String(error))) {
          watcher.close(); owner!.release(); throw error
        }
      }
    }
  }
  function schedule(configuration: boolean) {
    if (state === 'stopping') return
    revision++
    configPending ||= configuration
    clearTimeout(timer)
    timer = setTimeout(() => {
      queue = queue.then(update).catch(log.error)
    }, 80)
  }
  // This watcher belongs to the command, never to a replaceable Vite session.
  const watcher = watch(projectRoot, { recursive: true }, (_event, filename) => {
    if (!filename) return
    const path = filename.toString().replace(/\\/g, '/')
    if (path.startsWith('.cocowiki/') || path.startsWith('node_modules/') || path.startsWith('.git/')) return
    if (configDependencies.has(resolve(projectRoot, path))) { schedule(true); return }
    if (/\.timestamp-/.test(path)) return
    if (!config) { if (/\.(vue|css|ts|js|json|md)$/.test(path)) schedule(true); return }
    const paths = resolveProjectPaths(projectRoot, config)
    const file = resolve(projectRoot, path)
    if (!relative(paths.outDir, file).startsWith('..')) return
    const inside = (directory: string) => { const rel = relative(directory, file); return rel && !rel.startsWith('..') }
    if ([paths.contentDir, paths.componentsDir, paths.dataDir].some(inside)) schedule(file === resolve(paths.dataDir, 'contributors.json'))
    // A repaired missing theme file also retries the latest failed config.
    if (state === 'failed' || /\.(?:vue|css|ts|js|json|md)$/.test(path)) {
      if (!server || configurationFailed) schedule(true)
    }
  })
  async function close() {
    if (state === 'stopping') return
    state = 'stopping'
    clearTimeout(timer)
    watcher.close()
    externalWatchers.splice(0).forEach(watcher => watcher.close())
    owner!.update('stopping')
    await queue
    await server?.close()
    disposeMdItInstance()
    owner!.release()
    process.exit(0)
  }
  process.on('SIGINT', () => void close())
  process.on('SIGTERM', () => void close())
  queue = update()
  await queue
  // Invalid configurations remain repairable without relaunching the command.
  if (!server) log.info('等待修复配置或内容文件。')
}

export { acquireDevInstance } from './dev-instance'
