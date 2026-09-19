import container from 'markdown-it-container'
import type { SearchRecord } from './content.ts'

function addSpoilerRule(md: any) {
  md.inline.ruler.before('text', 'cocowiki-spoiler', (state: any, silent: boolean) => {
    const start = state.pos
    if (state.src.slice(start, start + 2) !== '||') return false
    const end = state.src.indexOf('||', start + 2)
    if (end < 0) return false
    if (!silent) {
      const token = state.push('html_inline', '', 0)
      token.content = `<button class="cw-spoiler" type="button" aria-expanded="false" aria-label="剧透内容，点击显示"><span>${md.utils.escapeHtml(state.src.slice(start + 2, end))}</span></button>`
    }
    state.pos = end + 2
    return true
  })
}

function addWikiLinkRule(md: any, records: SearchRecord[], base: string) {
  const prefix = base === '/' ? '' : base.replace(/\/$/, '')
  const routes = new Map<string, string>()
  for (const record of records) {
    routes.set(record.title, record.route)
    for (const alias of record.aliases || []) routes.set(alias, record.route)
  }

  md.inline.ruler.before('link', 'cocowiki-wikilink', (state: any, silent: boolean) => {
    const start = state.pos
    if (state.src.slice(start, start + 2) !== '[[') return false
    const end = state.src.indexOf(']]', start + 2)
    if (end < 0) return false
    const name = state.src.slice(start + 2, end).trim()
    if (!name) return false
    if (!silent) {
      const route = routes.get(name) || `/search?q=${encodeURIComponent(name)}`
      const token = state.push('html_inline', '', 0)
      token.content = `<a class="cw-wikilink" href="${prefix}${route}">${md.utils.escapeHtml(name)}</a>`
    }
    state.pos = end + 2
    return true
  })
}

function addTableWrapper(md: any) {
  const open = md.renderer.rules.table_open || ((tokens: any[], index: number, options: any, _env: any, renderer: any) => renderer.renderToken(tokens, index, options))
  const close = md.renderer.rules.table_close || ((tokens: any[], index: number, options: any, _env: any, renderer: any) => renderer.renderToken(tokens, index, options))
  md.renderer.rules.table_open = (...args: any[]) => `<div class="cw-table-scroll">${open(...args)}`
  md.renderer.rules.table_close = (...args: any[]) => `${close(...args)}</div>`
}

const calloutPresets = {
  info: { title: '信息', icon: 'i' },
  tip: { title: '提示', icon: '✓' },
  warning: { title: '注意', icon: '!' },
  danger: { title: '警告', icon: '!' }
} as const

function addCalloutContainers(md: any) {
  for (const [name, preset] of Object.entries(calloutPresets)) {
    md.use(container, name, {
      render(tokens: Array<{ nesting: number; info: string }>, index: number) {
        if (tokens[index].nesting !== 1) return '</aside>\n'
        const customTitle = tokens[index].info.trim().slice(name.length).trim()
        const title = md.utils.escapeHtml(customTitle || preset.title)
        return `<aside class="cw-callout cw-callout--${name}"><span class="cw-callout__icon" aria-hidden="true">${preset.icon}</span><p class="cw-callout__title">${title}</p>\n`
      }
    })
  }

  md.use(container, 'details', {
    render(tokens: Array<{ nesting: number; info: string }>, index: number) {
      if (tokens[index].nesting !== 1) return '</details>\n'
      const customTitle = tokens[index].info.trim().slice('details'.length).trim()
      const title = md.utils.escapeHtml(customTitle || '详细信息')
      return `<details class="cw-callout cw-callout--details"><summary>${title}</summary>\n`
    }
  })
}

export function applyCocoWikiMarkdown(
  md: any,
  records: SearchRecord[],
  options: { spoiler?: boolean; wikiLink?: boolean; base?: string }
) {
  if (options.spoiler !== false) addSpoilerRule(md)
  if (options.wikiLink !== false) addWikiLinkRule(md, records, options.base || '/')
  addTableWrapper(md)
  addCalloutContainers(md)
}
