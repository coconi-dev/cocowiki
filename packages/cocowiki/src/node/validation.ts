import { existsSync, statSync } from 'node:fs'
import { resolve, relative, isAbsolute } from 'node:path'
import type { CocoWikiConfig, CocoWikiPageMeta } from '../config'
import { resolveProjectPaths } from './project'

export class ContentError extends Error {
  constructor(public file: string, public field: string, message: string) {
    super(`${file} [${field}]: ${message}`)
    this.name = 'ContentError'
  }
}
export function object(value: unknown, file: string, field: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ContentError(file, field, '必须是对象')
  return value as Record<string, unknown>
}
export function validateMeta(value: unknown, file: string): Partial<CocoWikiPageMeta> {
  const meta = object(value, file, 'metadata')
  for (const key of ['title', 'layout', 'description', 'type', 'category', 'image']) {
    if (meta[key] !== undefined && typeof meta[key] !== 'string') throw new ContentError(file, key, '必须是字符串')
  }
  for (const key of ['tags', 'aliases', 'contributors']) {
    if (meta[key] !== undefined && (!Array.isArray(meta[key]) || !(meta[key] as unknown[]).every(v => typeof v === 'string'))) throw new ContentError(file, key, '必须是字符串数组')
  }
  for (const key of ['search', 'archive', 'outline', 'showPrevNext', 'showLastUpdated']) {
    if (meta[key] !== undefined && typeof meta[key] !== 'boolean') throw new ContentError(file, key, '必须是布尔值')
  }
  if (meta.sidebar !== undefined && !['none', 'light', 'outline'].includes(meta.sidebar as string)) throw new ContentError(file, 'sidebar', '必须是 none、light 或 outline')
  if (meta.updated !== undefined) {
    // YAML dates may be parsed as Date by gray-matter.
    if (meta.updated instanceof Date) meta.updated = meta.updated.toISOString()
    if (typeof meta.updated !== 'string' || !Number.isFinite(Date.parse(meta.updated))) throw new ContentError(file, 'updated', '必须是有效的日期字符串')
  }
  // Preserve the documented compatibility rule: invalid order values sort last.
  if (typeof meta.order !== 'number' || !Number.isFinite(meta.order)) delete meta.order
  return meta as Partial<CocoWikiPageMeta>
}
const componentNames = new Set(['Header', 'Home', 'Search', 'Archive', 'Contributors', 'PageMeta', 'PageOutline', 'ContentSidebar', 'PageNavigation', 'PageFooter', 'SearchOverlay', 'Loading', 'NotFound'])
function inside(parent: string, child: string) {
  const path = relative(parent, child)
  return !path || (!path.startsWith('..') && !isAbsolute(path))
}
export function validateConfig(input: unknown, root: string): CocoWikiConfig {
  const file = resolve(root, 'cocowiki.config.ts')
  const config = object(input, file, 'config')
  if (typeof config.title !== 'string' || !config.title.trim()) throw new ContentError(file, 'title', '配置文件必须提供 title。')
  for (const key of ['description', 'lang', 'logo', 'favicon', 'base']) if (config[key] !== undefined && typeof config[key] !== 'string') throw new ContentError(file, key, '必须是字符串')
  for (const name of ['directories', 'search', 'markdown', 'content', 'home', 'theme']) if (config[name] !== undefined) object(config[name], file, name)
  const c = config as unknown as CocoWikiConfig
  for (const [key, value] of Object.entries(c.directories || {})) if (typeof value !== 'string' || !value) throw new ContentError(file, `directories.${key}`, '必须是非空路径')
  for (const [key, value] of Object.entries(c.search || {})) {
    if (key === 'enabled' ? typeof value !== 'boolean' : !Array.isArray(value) || !value.every(v => typeof v === 'string')) throw new ContentError(file, `search.${key}`, '字段类型无效')
  }
  for (const [key, value] of Object.entries(c.markdown || {})) if (typeof value !== 'boolean') throw new ContentError(file, `markdown.${key}`, '必须是布尔值')
  validateMeta(c.content || {}, file)
  function navigation(items: unknown, field: string) {
    if (!Array.isArray(items)) throw new ContentError(file, field, '必须是数组')
    items.forEach((item, index) => {
      const entry = object(item, file, `${field}.${index}`)
      if (typeof entry.text !== 'string' || (entry.link !== undefined && typeof entry.link !== 'string')) throw new ContentError(file, `${field}.${index}`, 'text/link 必须是字符串')
      if (entry.items !== undefined) navigation(entry.items, `${field}.${index}.items`)
    })
  }
  if (c.navigation !== undefined) navigation(c.navigation, 'navigation')
  const home = c.home || {}
  for (const key of ['name', 'text', 'tagline', 'eyebrow', 'note'] as const) {
    if (home[key] !== undefined && typeof home[key] !== 'string') throw new ContentError(file, `home.${key}`, '必须是字符串')
  }
  if (home.search !== undefined) {
    const search = object(home.search, file, 'home.search')
    if (search.placeholder !== undefined && typeof search.placeholder !== 'string') throw new ContentError(file, 'home.search.placeholder', '必须是字符串')
  }
  if (home.visual !== undefined) {
    const visual = object(home.visual, file, 'home.visual')
    if (visual.image !== undefined && typeof visual.image !== 'string') throw new ContentError(file, 'home.visual.image', '必须是字符串')
    if (visual.labels !== undefined && (!Array.isArray(visual.labels) || !visual.labels.every(label => typeof label === 'string'))) throw new ContentError(file, 'home.visual.labels', '必须是字符串数组')
  }
  if (home.actions !== undefined) {
    if (!Array.isArray(home.actions)) throw new ContentError(file, 'home.actions', '必须是数组')
    home.actions.forEach((value, index) => {
      const action = object(value, file, `home.actions.${index}`)
      if (typeof action.text !== 'string' || typeof action.link !== 'string') throw new ContentError(file, `home.actions.${index}`, 'text/link 必须是字符串')
      if (action.theme !== undefined && !['brand', 'alt'].includes(action.theme as string)) throw new ContentError(file, `home.actions.${index}.theme`, '必须是 brand 或 alt')
    })
  }
  const paths = resolveProjectPaths(root, c)
  const inputs = [paths.contentDir, paths.componentsDir, paths.dataDir, paths.publicDir]
  const outputs = [resolve(root, '.cocowiki'), paths.outDir]
  for (let i = 0; i < inputs.length; i++) for (let j = i + 1; j < inputs.length; j++) {
    if (inside(inputs[i], inputs[j]) || inside(inputs[j], inputs[i])) throw new ContentError(file, 'directories', `输入目录重叠：${inputs[i]} / ${inputs[j]}`)
  }
  for (const output of outputs) {
    if (inside(output, root)) throw new ContentError(file, 'directories', `输出目录不能包含项目根目录：${output}`)
    for (const input of inputs) if (inside(input, output) || inside(output, input)) throw new ContentError(file, 'directories', `输入与输出目录重叠：${input} / ${output}`)
  }
  if (inside(outputs[0], outputs[1]) || inside(outputs[1], outputs[0])) throw new ContentError(file, 'directories.out', '不能与 .cocowiki 重叠')
  if (!existsSync(paths.contentDir) || !statSync(paths.contentDir).isDirectory()) throw new ContentError(file, 'directories.content', `内容目录不存在：${paths.contentDir}`)
  const theme = c.theme || {}
  if (theme.components !== undefined) object(theme.components, file, 'theme.components')
  const styles = theme.styles === undefined ? [] : Array.isArray(theme.styles) ? theme.styles : [theme.styles]
  for (const [name, path] of Object.entries(theme.components || {})) {
    if (!componentNames.has(name)) throw new ContentError(file, `theme.components.${name}`, '未知主题组件')
    checkFile(path, `theme.components.${name}`)
  }
  if (theme.entry !== undefined) checkFile(theme.entry, 'theme.entry')
  styles.forEach(path => checkFile(path, 'theme.styles'))
  function checkFile(path: unknown, field: string) {
    if (typeof path !== 'string' || !existsSync(resolve(root, path)) || !statSync(resolve(root, path)).isFile()) throw new ContentError(file, field, `文件不存在：${String(path)}`)
  }
  return c
}

export function validateContributors(value: unknown, file: string) {
  const entries = object(value, file, 'contributors')
  for (const [name, value] of Object.entries(entries)) {
    const profile = object(value, file, name)
    for (const key of ['name', 'initials', 'role', 'avatar', 'url', 'github']) {
      if (profile[key] !== undefined && typeof profile[key] !== 'string') throw new ContentError(file, `${name}.${key}`, '必须是字符串')
    }
  }
  return entries
}
