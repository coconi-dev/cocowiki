import MarkdownIt from 'markdown-it'

import type { DocumentAnalysis } from '../shared/document'
export type { DocumentAnalysis, DocumentReference } from '../shared/document'

const parser = new MarkdownIt({ html: true })
// The same inline grammar as rendering: escaped text, code and fenced examples
// are handled by Markdown-it before this rule can produce a reference.
parser.inline.ruler.before('link', 'cocowiki-reference', (state, silent) => {
  const start = state.pos
  if (state.src.slice(start, start + 2) !== '[[') return false
  const end = state.src.indexOf(']]', start + 2)
  if (end < 0) return false
  const name = state.src.slice(start + 2, end).trim()
  if (!name) return false
  if (!silent) {
    const token = state.push('wiki_reference', '', 0)
    token.content = name
    token.meta = { offset: start }
  }
  state.pos = end + 2
  return true
})

export function analyzeDocument(source: string): DocumentAnalysis {
  const result: DocumentAnalysis = { text: '', wiki: [], links: [], headings: [] }
  const tokens = parser.parse(source, {})
  const text: string[] = []
  for (let i = 0; i < tokens.length; i++) {
    const block = tokens[i]
    if (block.type === 'html_block' && !/^\s*<(?:script|style)\b/i.test(block.content)) {
      const html = block.content.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>|<!--[\s\S]*?-->/gi, match => match.replace(/[^\n]/g, ' '))
      text.push(html.replace(/<[^>]*>/g, '').replace(/\{\{[\s\S]*?\}\}/g, ''))
      for (const match of html.matchAll(/<(a|img)\b[^>]*?\s(href|src)=["']([^"']+)["'][^>]*>/gi)) result.links.push({ target: match[3], line: (block.map?.[0] || 0) + 1 + block.content.slice(0, match.index).split('\n').length - 1, image: match[1].toLowerCase() === 'img' })
    }
    if (block.type !== 'inline') continue
    const line = (block.map?.[0] || 0) + 1
    let cursor = 0
    const referenceLine = (target: string) => { const offset = block.content.indexOf(target, cursor); if (offset < 0) return line; cursor = offset + target.length; return line + block.content.slice(0, offset).split('\n').length - 1 }
    let hidden: string | undefined
    const visible: string[] = []
    for (const child of block.children || []) {
      if (child.type === 'html_inline') {
        for (const match of child.content.matchAll(/<(a|img)\b[^>]*?\s(href|src)=["']([^"']+)["'][^>]*>/gi)) if (!hidden) result.links.push({ target: match[3], line, image: match[1].toLowerCase() === 'img' })
        const open = child.content.match(/^<(script|style)\b/i)
        if (open) hidden = open[1].toLowerCase()
        if (hidden && new RegExp(`^<\\/${hidden}\\s*>`, 'i').test(child.content)) hidden = undefined
        continue
      }
      if (hidden) continue
      if (child.type === 'wiki_reference') {
        result.wiki.push({ target: child.content, line: line + block.content.slice(0, child.meta.offset).split('\n').length - 1 })
        visible.push(child.content)
      } else if (child.type === 'link_open') {
        result.links.push({ target: child.attrGet('href') || '', line: referenceLine(child.attrGet('href') || '') })
      } else if (child.type === 'image') {
        result.links.push({ target: child.attrGet('src') || '', line: referenceLine(child.attrGet('src') || ''), image: true })
      } else if (['text', 'code_inline', 'softbreak', 'hardbreak'].includes(child.type)) visible.push(child.content || ' ')
    }
    const title = visible.join('').trim()
    text.push(title)
    if (tokens[i - 1]?.type === 'heading_open') result.headings.push({ level: Number(tokens[i - 1].tag.slice(1)), title, line })
  }
  result.text = text.join(' ').replace(/\s+/g, ' ').trim()
  return result
}
