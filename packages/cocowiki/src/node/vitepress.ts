import { createHash } from 'node:crypto'
import { existsSync, realpathSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { basename, resolve } from 'node:path'
import { defineConfig, type UserConfig } from 'vitepress'
import { createLogger, type Plugin } from 'vite'
import type { CocoWikiConfig } from '../config.ts'
import { scanContent, publicRecords, type ContentPage } from './content.ts'
import { applyCocoWikiMarkdown } from './markdown.ts'
import { snapshots } from './snapshot'
import { validateConfig, validateContributors } from './validation'
import { normalizeBase } from '../shared/routes'
import { resolveProjectPaths } from './project.ts'

const CONFIG_ID = 'virtual:cocowiki-config'
const CONTRIBUTORS_ID = 'virtual:cocowiki-contributors'
const ANSI = { reset: '\x1b[0m', dim: '\x1b[2m', cyan: '\x1b[36m', yellow: '\x1b[33m', red: '\x1b[31m' }

function createCocoWikiLogger() {
  const logger = createLogger()
  const label = '[cocowiki]'
  const supportsColor = Boolean(process.stdout.isTTY && !process.env.NO_COLOR)
  const paint = (text: string, color: string) => supportsColor ? `${color}${text}${ANSI.reset}` : text
  const branded = (message: string) => {
    const normalized = message.replace(/\[(?:vitepress|vite)\]/gi, label)
    return normalized.includes(label) ? normalized : `${label} ${normalized}`
  }
  const optionsWithoutViteLabel = (options?: any) => options ? { ...options, timestamp: false } : options
  const timestamp = (options?: any) => options?.timestamp
    ? paint(`${new Date().toLocaleTimeString('en-GB', { hour12: false })} `, ANSI.dim)
    : ''
  const format = (message: string, color: string, options?: any) => `${timestamp(options)}${paint(branded(message), color)}`
  const warned = new Set<string>()
  return {
    ...logger,
    info: (message: string, options?: any) => logger.info(format(message, ANSI.cyan, options), optionsWithoutViteLabel(options)),
    warn: (message: string, options?: any) => logger.warn(format(message, ANSI.yellow, options), optionsWithoutViteLabel(options)),
    warnOnce: (message: string, options?: any) => {
      if (warned.has(message)) return
      warned.add(message)
      logger.warn(format(message, ANSI.yellow, options), optionsWithoutViteLabel(options))
    },
    error: (message: string, options?: any) => logger.error(format(message, ANSI.red, options), optionsWithoutViteLabel(options))
  }
}

function contentPlugin(
  config: CocoWikiConfig,
  dataDir: string,
  initialRecords: ContentPage[],
  projectRoot: string,
  runtimeRoot: string
): Plugin {
  const records = initialRecords
  const resolvedConfigId = `\0${CONFIG_ID}`
  const resolvedContributorsId = `\0${CONTRIBUTORS_ID}`
  const contributorsFile = resolve(dataDir, 'contributors.json')
  const projectId = createHash('sha256').update(realpathSync(projectRoot)).digest('hex')
  let cleanup = () => {}


  return {
    name: 'cocowiki-content-index',
    resolveId(id) {
      if (id === CONFIG_ID) return resolvedConfigId
      if (id === CONTRIBUTORS_ID) return resolvedContributorsId
    },
    async load(id) {
      if (id === resolvedConfigId) return `export default ${JSON.stringify(config)}`
      if (id === resolvedContributorsId) {
        const contributors = validateContributors(existsSync(contributorsFile) ? JSON.parse(await readFile(contributorsFile, 'utf8')) : {}, contributorsFile)
        return `export default JSON.parse(${JSON.stringify(JSON.stringify(contributors))})`
      }
    },
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        if (request.url?.split('?')[0]?.endsWith('/__cocowiki/status')) {
          response.setHeader('Content-Type', 'application/json; charset=utf-8')
          response.setHeader('Cache-Control', 'no-store')
          response.end(JSON.stringify({ pid: process.pid, projectId, token: process.env.COCOWIKI_DEV_INSTANCE }))
          return
        }
        if (!request.url?.split('?')[0]?.endsWith('/search-index.json')) return next()
        response.statusCode = 200
        response.setHeader('Content-Type', 'application/json; charset=utf-8')
        response.setHeader('Cache-Control', 'no-store')
        response.end(JSON.stringify(publicRecords(records)))
      })
      const snapshot = snapshots.get(runtimeRoot)
      if (snapshot) {
        snapshot.notify = () => {
          records.splice(0, records.length, ...snapshot.pages)
          // All Markdown modules may contain a link to any changed title/alias.
          for (const module of server.moduleGraph.idToModuleMap.values()) {
            if (module.file?.endsWith('.md')) server.moduleGraph.invalidateModule(module)
          }
          const module = server.moduleGraph.getModuleById(resolvedContributorsId)
          if (module) server.moduleGraph.invalidateModule(module)
          server.ws.send({ type: 'custom', event: 'cocowiki:content-updated' })
        }
        cleanup = () => { snapshot.notify = undefined }
      }
    },
    closeBundle() { cleanup() },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'search-index.json', source: JSON.stringify(publicRecords(records)) })
    }
  }
}

export async function createVitePressConfig(
  config: CocoWikiConfig,
  projectRoot: string,
  runtimeRoot?: string
): Promise<UserConfig> {
  validateConfig(config, projectRoot)
  const paths = resolveProjectPaths(projectRoot, config, runtimeRoot)
  if (!existsSync(paths.contentDir)) throw new Error(`内容目录不存在：${paths.contentDir}`)
  const records = [...(snapshots.get(paths.runtimeRoot)?.pages || await scanContent(paths.contentDir, config.search))]
  const base = normalizeBase(config.base)
  const favicon = config.favicon || config.logo || '/favicon.svg'
  const faviconType = favicon.endsWith('.svg') ? 'image/svg+xml' : favicon.endsWith('.ico') ? 'image/x-icon' : 'image/png'
  const customLogger = createCocoWikiLogger()

  return defineConfig({
    title: config.title,
    description: config.description,
    lang: config.lang || 'zh-CN',
    base,
    srcDir: paths.runtimeRoot,
    cleanUrls: true,
    outDir: paths.outDir,
    cacheDir: resolve(projectRoot, '.cocowiki/cache', basename(paths.runtimeRoot)),
    lastUpdated: false,
    transformPageData(pageData) {
      const record = records.find(record => record.generatedPath === pageData.relativePath)
      return { lastUpdated: record?.lastUpdated }
    },
    head: [
      ['link', { rel: 'icon', type: faviconType, href: `${base}${favicon.replace(/^\//, '')}` }],
      ['meta', { name: 'theme-color', content: '#ffffff', media: '(prefers-color-scheme: light)' }],
      ['meta', { name: 'theme-color', content: '#0f1013', media: '(prefers-color-scheme: dark)' }]
    ],
    vite: {
      customLogger,
      publicDir: paths.publicDir,
      // A cold dependency crawl must not leave pending transforms blocking a
      // complete server replacement after a config change.
      optimizeDeps: { include: ['cocowiki > minisearch'], holdUntilCrawlEnd: false },
      plugins: [contentPlugin(config, paths.dataDir, records, projectRoot, paths.runtimeRoot)],
      server: { fs: { allow: [projectRoot, resolve(import.meta.dirname, '../..')] } },
      resolve: {
        alias: {
          '@components': paths.componentsDir,
          '@data': paths.dataDir
        }
      }
    },
    markdown: {
      lineNumbers: false,
      config(md) {
        applyCocoWikiMarkdown(md, records, { ...config.markdown, base })
      }
    }
  })
}

export function runtimeConfig(runtimeRoot: string) {
  const snapshot = snapshots.get(runtimeRoot)
  if (!snapshot) throw new Error(`运行目录尚未初始化：${runtimeRoot}`)
  return createVitePressConfig(snapshot.config, resolve(runtimeRoot, '../..'), runtimeRoot)
}
