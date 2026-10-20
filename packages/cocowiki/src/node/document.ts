import MarkdownIt from 'markdown-it'

export interface DocumentReference { target: string; line: number; image?: boolean }
export interface DocumentAnalysis {
  text: string
  wiki: DocumentReference[]
  links: DocumentReference[]
  headings: Array<{ level: number; title: string; line: number }>
}
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
    if (block.type !== 'inline') continue
    const line = (block.map?.[0] || 0) + 1
    let hidden: string | undefined
    const visible: string[] = []
    for (const child of block.children || []) {
      if (child.type === 'html_inline') {
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
        result.links.push({ target: child.attrGet('href') || '', line })
      } else if (child.type === 'image') {
        result.links.push({ target: child.attrGet('src') || '', line, image: true })
      } else if (['text', 'code_inline', 'softbreak', 'hardbreak'].includes(child.type)) visible.push(child.content || ' ')
    }
    const title = visible.join('').trim()
    text.push(title)
    if (tokens[i - 1]?.type === 'heading_open') result.headings.push({ level: Number(tokens[i - 1].tag.slice(1)), title, line })
  }
  result.text = text.join(' ').replace(/\s+/g, ' ').trim()
  return result
}
