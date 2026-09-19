import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { defineConfig, type UserConfig } from 'vitepress'
import { createLogger, type Plugin } from 'vite'
import type { CocoWikiConfig } from '../config.ts'
import { scanContent, type SearchRecord } from './content.ts'
import { applyCocoWikiMarkdown } from './markdown.ts'
import { resolveProjectPaths } from './project.ts'

const CONFIG_ID = 'virtual:cocowiki-config'
const CONTRIBUTORS_ID = 'virtual:cocowiki-contributors'
const ANSI = { reset: '\x1b[0m', cyan: '\x1b[36m', yellow: '\x1b[33m', red: '\x1b[31m', violet: '\x1b[38;5;141m' }

function createCocoWikiLogger() {
  const logger = createLogger()
  const label = '[cocowiki]'
  const format = (message: string, color: string) => {
    const branded = message.replace(/\[(?:vitepress|vite)\]/gi, label)
    return `${color}${branded === message ? `${label} ${message}` : branded}${ANSI.reset}`
  }
  const optionsWithoutViteLabel = (options?: any) => options ? { ...options, timestamp: false } : options
  const timestamp = (options?: any) => options?.timestamp
    ? `${new Date().toLocaleTimeString('en-GB', { hour12: false })} `
    : ''
  return {
    ...logger,
    info: (message: string, options?: any) => logger.info(`${timestamp(options)}${format(message, ANSI.cyan)}`, optionsWithoutViteLabel(options)),
    warn: (message: string, options?: any) => logger.warn(`${timestamp(options)}${format(message, ANSI.yellow)}`, optionsWithoutViteLabel(options)),
    warnOnce: (message: string, options?: any) => logger.warnOnce(`${timestamp(options)}${format(message, ANSI.yellow)}`, optionsWithoutViteLabel(options)),
    error: (message: string, options?: any) => logger.error(`${timestamp(options)}${format(message, ANSI.red)}`, optionsWithoutViteLabel(options))
  }
}

function contentPlugin(
  config: CocoWikiConfig,
  contentDir: string,
  dataDir: string,
  initialRecords: SearchRecord[]
): Plugin {
  const records = initialRecords
  const resolvedConfigId = `\0${CONFIG_ID}`
  const resolvedContributorsId = `\0${CONTRIBUTORS_ID}`
  const contributorsFile = resolve(dataDir, 'contributors.json')

  async function refresh() {
    const nextRecords = await scanContent(contentDir, config.search)
    records.splice(0, records.length, ...nextRecords)
  }

  return {
    name: 'cocowiki-content-index',
    resolveId(id) {
      if (id === CONFIG_ID) return resolvedConfigId
      if (id === CONTRIBUTORS_ID) return resolvedContributorsId
    },
    async load(id) {
      if (id === resolvedConfigId) return `export default ${JSON.stringify(config)}`
      if (id === resolvedContributorsId) {
        const contributors = existsSync(contributorsFile) ? JSON.parse(await readFile(contributorsFile, 'utf8')) : {}
        return `export default ${JSON.stringify(contributors)}`
      }
    },
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        if (!request.url?.split('?')[0]?.endsWith('/search-index.json')) return next()
        response.statusCode = 200
        response.setHeader('Content-Type', 'application/json; charset=utf-8')
        response.end(JSON.stringify(records))
      })
      server.watcher.add(contributorsFile)
      const refreshContributors = (file: string) => {
        if (file !== contributorsFile) return
        const module = server.moduleGraph.getModuleById(resolvedContributorsId)
        if (module) server.moduleGraph.invalidateModule(module)
        server.ws.send({ type: 'full-reload' })
      }
      server.watcher.on('add', refreshContributors)
      server.watcher.on('change', refreshContributors)
      server.watcher.on('unlink', refreshContributors)
    },
    async buildStart() {
      await refresh()
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'search-index.json', source: JSON.stringify(records) })
    }
  }
}

export async function createVitePressConfig(
  config: CocoWikiConfig,
  projectRoot: string
): Promise<UserConfig> {
  const paths = resolveProjectPaths(projectRoot, config)
  const records = await scanContent(paths.contentDir, config.search)
  const requestedBase = config.base || '/'
  const base = `/${requestedBase.replace(/^\/+|\/+$/g, '')}${requestedBase === '/' ? '' : '/'}`
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
    cacheDir: resolve(projectRoot, '.cocowiki/cache'),
    lastUpdated: true,
    head: [
      ['link', { rel: 'icon', type: faviconType, href: `${base}${favicon.replace(/^\//, '')}` }],
      ['meta', { name: 'theme-color', content: '#ffffff', media: '(prefers-color-scheme: light)' }],
      ['meta', { name: 'theme-color', content: '#0f1013', media: '(prefers-color-scheme: dark)' }]
    ],
    vite: {
      customLogger,
      publicDir: paths.publicDir,
      plugins: [contentPlugin(config, paths.contentDir, paths.dataDir, records)],
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
