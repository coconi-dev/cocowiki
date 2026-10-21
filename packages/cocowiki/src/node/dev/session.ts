import { watch, existsSync, statSync } from 'node:fs'
import { resolve, relative, dirname } from 'node:path'
import { loadConfigFromFile } from 'vite'
import { createServer, disposeMdItInstance } from 'vitepress'
import { acquireDevInstance } from '../dev-instance'
import { createContentScanner } from '../content'
import { validateConfig } from '../validation'
import { prepareRuntime, preflightRuntime, releaseRuntime } from '../runtime'
import { snapshots } from '../snapshot'
import { resolveProjectPaths, runtimePath } from '../project'
import { normalizeBase } from '../../shared/routes'
import type { CocoWikiConfig } from '../../config'
export type DevState = 'starting' | 'running' | 'restarting' | 'failed' | 'stopping' | 'stopped'
export interface DevOptions { host?: string | boolean; port?: number }
export interface DevChange { files?: ReadonlySet<string>; configuration?: boolean; history?: boolean }
export interface DevLogger { info(message: string): void; error(error: unknown): void }
type Owner = Extract<Awaited<ReturnType<typeof acquireDevInstance>>, { kind: 'owner' }>
type Controller = ReturnType<typeof createController>

/** One owned service, watcher set, queue and content cache. No process-exit policy. */
export class DevSession {
  private controller?: Controller
  private owner?: Owner
  private starting?: Promise<boolean>
  private closing?: Promise<void>
  private closed = false
  private stopping = false
  constructor(readonly projectRoot: string, private options: DevOptions = {}, private log: DevLogger = console) {}
  get state(): DevState { return this.closed ? 'stopped' : this.stopping ? 'stopping' : this.controller?.state || 'starting' }
  start(): Promise<boolean> {
    if (this.closed || this.stopping) return Promise.reject(new Error('开发会话已经关闭'))
    return this.starting ||= (async () => {
      const instance = await acquireDevInstance(this.projectRoot)
      if (instance.kind === 'existing') { this.log.info(`开发服务已在运行：${instance.url}（PID ${instance.pid}）`); return false }
      this.owner = instance
      if (this.closed || this.stopping) { instance.release(); return false }
      try {
        this.controller = createController(this.projectRoot, this.options, this.log, instance)
        await this.controller.start()
        return true
      } catch (error) { await this.close(); throw error }
    })()
  }
  async update(change: DevChange = {}) {
    if (!this.controller || this.closed) throw new Error('开发会话尚未启动或已经关闭')
    await this.controller.update(change)
  }
  close(): Promise<void> {
    this.stopping = true
    return this.closing ||= (async () => {
      try { await this.controller?.close() } finally { this.owner?.release(); this.closed = true }
    })()
  }
}

function createController(projectRoot: string, options: DevOptions, log: DevLogger, owner: Owner) {
  const mode = 'dev'
  const configFile = resolve(projectRoot, 'cocowiki.config.ts')
  const root = runtimePath(projectRoot, mode)
  let configDependencies = new Set([configFile])
  const configSignatures = new Map<string, string>()
  const configSignature = (file: string) => { try { const stat = statSync(file, { bigint: true }); return `${stat.ino}:${stat.size}:${stat.mtimeNs}:${stat.ctimeNs}` } catch { return 'missing' } }
  const configChanged = (file: string) => configSignatures.get(file) !== configSignature(file)
  const dependencyWatchers = new Map<string, ReturnType<typeof watch>>()
  function watchConfigDependencies() {
    const directories = new Set([...configDependencies]
      .filter(file => relative(projectRoot, file).startsWith('..'))
      .map(file => dirname(file)))
    for (const [directory, watcher] of dependencyWatchers) {
      if (!directories.has(directory)) { watcher.close(); dependencyWatchers.delete(directory) }
    }
    for (const directory of directories) {
      if (dependencyWatchers.has(directory) || !existsSync(directory)) continue
      dependencyWatchers.set(directory, watch(directory, (_event, name) => {
        if (name) { const file = resolve(directory, name.toString()); if (configDependencies.has(file) && configChanged(file)) schedule(true) }
      }))
    }
  }
  async function readConfig() {
    if (!existsSync(configFile)) throw new Error('未找到 cocowiki.config.ts。')
    const loaded = await loadConfigFromFile({ command: 'serve', mode: 'development' }, configFile, projectRoot)
    if (loaded) {
      configDependencies = new Set([configFile, ...loaded.dependencies.map(file => resolve(file))])
      for (const file of configDependencies) configSignatures.set(file, configSignature(file))
      // Register as soon as loading succeeds, before validation can reject it.
      watchConfigDependencies()
    }
    return validateConfig(loaded?.config, projectRoot)
  }
  const scanners = new Map<string, ReturnType<typeof createContentScanner>>()
  async function preflight(config: CocoWikiConfig, changes?: ReadonlySet<string>, historyChanged = false) {
    const paths = resolveProjectPaths(projectRoot, config)
    let scanner = scanners.get(paths.contentDir)
    if (!scanner) { scanner = createContentScanner(paths.contentDir); scanners.set(paths.contentDir, scanner) }
    if (historyChanged) scanner.invalidateGit()
    const current = snapshots.get(root)?.pages
    const contentChanges = changes && new Set([...changes].filter(file => !relative(paths.contentDir, file).startsWith('..') || scanner!.getDependencies().some(dependency => dependency === file || !relative(file, dependency).startsWith('..'))))
    let pages
    try {
      pages = current && contentChanges?.size === 0 && !historyChanged ? current : await scanner.scan(config.search, contentChanges, config.markdown?.wikiLink !== false)
    } finally { watchExternal(config) }
    const previous = new Map(current?.map(page => [page.sourcePath, page]))
    // Components/data do not require reading or reparsing every Markdown page.
    const validatePages = changes === undefined || historyChanged || [...(contentChanges || [])].some(file => !/\.(md|vue|json)$/.test(file))
      ? pages : pages.filter(page => previous.get(page.sourcePath) !== page)
    await preflightRuntime(projectRoot, config, mode, validatePages)
    return pages
  }
  let config: CocoWikiConfig | undefined
  let server: Awaited<ReturnType<typeof createServer>> | undefined
  let state: DevState = 'starting'
  let queue = Promise.resolve()
  let timer: ReturnType<typeof setTimeout> | undefined
  let configPending = true
  let revision = 0
  const pendingFiles = new Set<string>()
  let historyPending = false
  let configurationFailed = false
  const externalWatchers: ReturnType<typeof watch>[] = []
  function watchExternal(next: CocoWikiConfig) {
    externalWatchers.splice(0).forEach(watcher => watcher.close())
    const paths = resolveProjectPaths(projectRoot, next)
    for (const directory of new Set([paths.contentDir, paths.componentsDir, paths.dataDir, ...[...scanners.values()].flatMap(scanner => scanner.getDependencies().map(file => dirname(file)))])) {
      if (!relative(projectRoot, directory).startsWith('..') || !existsSync(directory)) continue
      externalWatchers.push(watch(directory, { recursive: true }, (_event, name) => {
        const file = name === null ? directory : resolve(directory, name.toString())
        schedule(configurationFailed || file === resolve(paths.dataDir, 'contributors.json'), file)
      }))
    }
  }

  async function start(nextConfig: CocoWikiConfig) {
    snapshots.get(root)!.devToken = owner.token
    const active = await createServer(root, { ...options, strictPort: true })
    try { await active.listen() } catch (error) { await active.close(); throw error }
    if (state === 'stopping') { await active.close(); return }
    server = active
    const local = active.resolvedUrls?.local[0] || `http://localhost:${options.port || 5173}/`
    const url = new URL(local)
    url.pathname = normalizeBase(nextConfig.base)
    owner.update('ready', url.href)
    state = 'running'
    log.info(`✓ 本地预览：${url.href}`)
  }
  const isStopping = () => state === 'stopping' || state === 'stopped'
  async function update() {
    if (isStopping()) return
    const replace = configPending || !server
    configPending = false
    const version = revision
    const changes = new Set(pendingFiles)
    pendingFiles.clear()
    const historyChanged = historyPending
    historyPending = false
    const previous = config
    try {
      const next = replace ? await readConfig() : config!
      const pages = await preflight(next, replace ? undefined : changes, historyChanged)
      if (replace) configurationFailed = false
      if (isStopping()) return
      if (version !== revision) {
        configPending ||= replace
        changes.forEach(file => pendingFiles.add(file))
        historyPending ||= historyChanged
        return
      }
      if (!replace) {
        await prepareRuntime(projectRoot, next, mode, pages, changes)
        snapshots.get(root)?.notify?.()
        return
      }
      state = 'restarting'
      owner.update('restarting')
      await server?.close()
      server = undefined
      disposeMdItInstance()
      try {
        await prepareRuntime(projectRoot, next, mode, pages)
        await start(next)
        config = next
        watchExternal(next)
        if (previous) log.info('✓ 配置已更新，开发服务已重建')
      } catch (error) {
        log.error(error)
        configurationFailed = true
        // An upstream startup failure must not end the independent watcher.
        if (previous) {
          await prepareRuntime(projectRoot, previous, mode, await preflight(previous))
          await start(previous)
        } else throw error
      }
    } catch (error) {
      changes.forEach(file => pendingFiles.add(file))
      historyPending ||= historyChanged
      log.error(error)
      if (replace) configurationFailed = true
      if (!server) {
        state = 'failed'; owner.update('failed')
        if (!previous && /already in use|EADDRINUSE/.test(String(error))) {
          watcher.close(); dependencyWatchers.forEach(watcher => watcher.close()); owner.release(); throw error
        }
      }
    }
  }
  function schedule(configuration: boolean, file?: string, historyChanged = false) {
    if (isStopping()) return
    if (file) pendingFiles.add(file)
    historyPending ||= historyChanged
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
    if (path === '.git/HEAD' || path === '.git/packed-refs' || path === '.git/shallow' || path.startsWith('.git/refs/')) { schedule(false, undefined, true); return }
    if (path.startsWith('.cocowiki/') || path.startsWith('node_modules/') || path.startsWith('.git/')) return
    if (configDependencies.has(resolve(projectRoot, path))) { if (configChanged(resolve(projectRoot, path))) schedule(true); return }
    if (/\.timestamp-/.test(path)) return
    if (!config) { if (/\.(vue|css|ts|js|json|md)$/.test(path)) schedule(true); return }
    const paths = resolveProjectPaths(projectRoot, config)
    const file = resolve(projectRoot, path)
    if (!relative(paths.outDir, file).startsWith('..')) return
    const inside = (directory: string) => { const rel = relative(directory, file); return !rel.startsWith('..') }
    if ([paths.contentDir, paths.componentsDir, paths.dataDir].some(inside) || [...scanners.values()].some(scanner => scanner.getDependencies().some(dependency => dependency === file || !relative(file, dependency).startsWith('..')))) schedule(file === resolve(paths.dataDir, 'contributors.json'), file)
    // A repaired missing theme file also retries the latest failed config.
    if (state === 'failed' || /\.(?:vue|css|ts|js|json|md)$/.test(path)) {
      if (!server || configurationFailed) schedule(true)
    }
  })
  async function close() {
    if (isStopping()) return
    state = 'stopping'
    clearTimeout(timer)
    watcher.close()
    dependencyWatchers.forEach(watcher => watcher.close())
    dependencyWatchers.clear()
    externalWatchers.splice(0).forEach(watcher => watcher.close())
    owner.update('stopping')
    try { await queue; await server?.close() } finally {
      disposeMdItInstance()
      scanners.clear()
      releaseRuntime(root)
      owner.release()
      state = 'stopped'
    }
  }
  return {
    get state() { return state },
    async start() {
      queue = update()
      await queue
      // File watchers can report the initial source batch while preflight is running.
      while (state === 'starting' && !server) { clearTimeout(timer); queue = queue.then(update); await queue }
      if (!server) log.info('等待修复配置或内容文件。')
    },
    async update(change: DevChange = {}) {
      if (state === 'stopping' || state === 'stopped') return
      change.files?.forEach(file => pendingFiles.add(resolve(file)))
      configPending ||= change.configuration || false
      historyPending ||= change.history || false
      revision++
      clearTimeout(timer)
      let requested: number
      do {
        requested = revision
        clearTimeout(timer)
        queue = queue.then(update)
        await queue
      } while (requested !== revision && !isStopping())
    },
    close
  }
}
