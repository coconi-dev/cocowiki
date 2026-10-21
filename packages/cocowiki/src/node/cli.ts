import { existsSync } from 'node:fs'
import { resolve, relative } from 'node:path'
import { loadConfigFromFile } from 'vite'
import { build, serve } from 'vitepress'
import { DevSession } from './dev/session'
import { checkContent } from './check'
import { scanContent } from './content'
import { ContentError, validateConfig } from './validation'
import { prepareRuntime, preflightRuntime, releaseRuntime } from './runtime'
import { resolveProjectPaths, runtimePath, type RuntimeMode } from './project'

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
  const command = (args[0] || 'dev') as RuntimeMode | 'check'
  if (!['dev', 'build', 'preview', 'check'].includes(command)) throw new Error(`未知命令“${command}”，可用命令为 dev、build、preview、check。`)
  const json = command === 'check' && args.includes('--json')
  const options = parseOptions(command === 'check' ? args.slice(1).filter(arg => arg !== '--json') : args.slice(1))
  const configFile = resolve(projectRoot, 'cocowiki.config.ts')
  const mode: RuntimeMode = command === 'check' ? 'build' : command
  const root = runtimePath(projectRoot, mode)
  async function readConfig() {
    if (!existsSync(configFile)) throw new Error('未找到 cocowiki.config.ts。')
    const loaded = await loadConfigFromFile({ command: command === 'build' ? 'build' : 'serve', mode: command === 'build' ? 'production' : 'development' }, configFile, projectRoot)
    return validateConfig(loaded?.config, projectRoot)
  }
  if (command === 'check') {
    let issues
    try { issues = await checkContent(await readConfig(), projectRoot) } catch (error) {
      if (!json) throw error
      console.log(JSON.stringify({ issues: [{ code: 'invalid-content', file: relative(projectRoot, error instanceof ContentError ? error.file : configFile), line: error instanceof ContentError ? error.line : 1, target: error instanceof ContentError ? error.field : '', message: error instanceof Error ? error.message : String(error) }] }, null, 2))
      process.exitCode = 1
      return
    }
    if (json) console.log(JSON.stringify({ issues }, null, 2))
    else {
      for (const issue of issues) log.info(`${issue.file}:${issue.line} [${issue.code}] ${issue.message}：${issue.target}`)
      log.info(issues.length ? `发现 ${issues.length} 个内容问题` : '内容检查通过')
    }
    if (issues.length) process.exitCode = 1
    return
  }
  if (command !== 'dev') {
    const config = await readConfig()
    try {
      const paths = resolveProjectPaths(projectRoot, config)
      const pages = await scanContent(paths.contentDir, config.search, config.markdown)
      await preflightRuntime(projectRoot, config, mode, pages)
      await prepareRuntime(projectRoot, config, mode, pages)
      if (command === 'build') { await build(root); log.info(`✓ 构建完成：${paths.outDir}`) }
      else await serve({ root, ...options })
    } finally { releaseRuntime(root) }
    return
  }

  const session = new DevSession(projectRoot, options, log)
  const stop = () => { void session.close().then(() => process.exit(0)).catch(error => { log.error(error); process.exit(1) }) }
  // Keep handlers installed while closing: upstream signal-exit checks listener
  // counts during emission, and repeated terminal signals must share one close.
  process.on('SIGINT', stop)
  process.on('SIGTERM', stop)
  try { if (await session.start()) return session } catch (error) { await session.close(); throw error }
  finally {
    if (session.state === 'stopped' || session.state === 'starting') { process.removeListener('SIGINT', stop); process.removeListener('SIGTERM', stop) }
  }
}

export { acquireDevInstance } from './dev-instance'
export { DevSession } from './dev/session'
