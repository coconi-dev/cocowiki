import { readFile, realpath } from 'node:fs/promises'
import { dirname, extname, resolve } from 'node:path'
import matter from 'gray-matter'
import MarkdownIt from 'markdown-it'
import type { SourceDocument, SourceLocation, SourceSpan } from '../shared/document'
import { ContentError } from './validation'

// VitePress expands include comments before Markdown parsing, even in code blocks.
// Mask examples until our Markdown hook runs, after that upstream preprocessing.
export const includeExampleMarker = '@cocowiki-example-include:'
const exampleParser = new MarkdownIt({ html: true })
// Observe the same exact-length backtick pairs consumed by Markdown-it.
exampleParser.inline.ruler.before('backticks', 'include-example-range', (state, silent) => {
  const start = state.pos
  if (silent || state.src[start] !== '`' || !state.env.codeRanges) return false
  let end = start
  while (state.src[end] === '`') end++
  const length = end - start
  let next = end
  while ((next = state.src.indexOf('`', next)) >= 0) {
    let close = next
    while (state.src[close] === '`') close++
    if (close - next === length) { state.env.codeRanges.push([state.env.offset + start, state.env.offset + close]); break }
    next = close
  }
  return false
})
function includeExampleRanges(source: string) {
  if (!source.includes('@include:')) return []
  const ranges: number[][] = []
  for (const token of exampleParser.parse(source, {})) {
    if (!token.map) continue
    const start = lineOffset(source, token.map[0] + 1), end = lineOffset(source, token.map[1] + 1)
    if (['fence', 'code_block'].includes(token.type)) ranges.push([start, end])
    else if (token.type === 'inline') exampleParser.inline.parse(source.slice(start, end), exampleParser, { codeRanges: ranges, offset: start }, [])
  }
  ranges.sort((a, b) => a[0] - b[0])
  return ranges
}
export function protectIncludeExamples(source: string) {
  for (const [start, end] of includeExampleRanges(source).reverse()) source = source.slice(0, start) + source.slice(start, end).replaceAll('@include:', includeExampleMarker) + source.slice(end)
  return source
}

export function sourceLocation(document: SourceDocument, offset: number): SourceLocation {
  const span = document.spans.find(span => offset >= span.start && offset < span.end) || document.spans.at(-1)
  return span ? { file: span.file, line: span.line + document.source.slice(span.start, offset).split('\n').length - 1 } : { file: '', line: 1 }
}
export function lineOffset(source: string, line: number) {
  let offset = 0
  for (let n = 1; n < line; n++) { const next = source.indexOf('\n', offset); if (next < 0) return source.length; offset = next + 1 }
  return offset
}
/** Expand once for analysis and rendering. Spans retain original source lines. */
export async function expandDocument(source: string, file: string, contentRoot: string, firstLine = 1, observe: (file: string) => void = () => {}): Promise<SourceDocument> {
  const dependencies = new Set<string>()
  async function expand(text: string, current: string, line: number, stack: string[]): Promise<{ source: string; spans: SourceSpan[] }> {
    const examples = includeExampleRanges(text)
    const output = { source: '', spans: [] as SourceSpan[] }
    function append(part: string, location: SourceLocation) {
      if (!part) return
      const start = output.source.length
      output.source += part
      output.spans.push({ ...location, start, end: output.source.length })
    }
    let cursor = 0
    for (const match of text.matchAll(/<!--\s*@include:\s*(.*?)\s*-->/g)) {
      if (examples.some(([start, end]) => match.index! >= start && match.index! < end)) continue
      append(text.slice(cursor, match.index), { file: current, line: line + text.slice(0, cursor).split('\n').length - 1 })
      const atLine = line + text.slice(0, match.index).split('\n').length - 1
      const target = match[1].trim()
      const parts = target.match(/^(.*?)(?:#([\w-]+))?(?:\{(\d*),(\d*)\})?$/)!
      if (!parts[1]) throw new ContentError(current, 'include', '缺少 include 路径', atLine)
      const include = parts[1].startsWith('@') ? resolve(contentRoot, parts[1].replace(/^@\/?/, '')) : resolve(dirname(current), parts[1])
      dependencies.add(include); observe(include)
      let identity: string, body: string
      try { identity = await realpath(include); body = await readFile(include, 'utf8') }
      catch { throw new ContentError(current, 'include', `无法读取 ${target}`, atLine) }
      if (stack.includes(identity) || stack.length >= 64) throw new ContentError(current, 'include', `循环或过深的 include：${[...stack, identity].join(' → ')}`, atLine)
      let start = 0, lines = body.split(/\r?\n/)
      if (parts[2]) {
        const region = parts[2]
        const marker = (value: string) => value.trim().match(/^(?:\/\/\s*#?|\/\*\s*#|#pragma\s+|<!--\s*#?|#\s*|::#)((?:end\s*)?region)\s+([\w*-]+)(?:\s*\*\/|\s*-->)?$/i)
        const first = lines.findIndex(value => { const m = marker(value); return m?.[1].toLowerCase() === 'region' && m[2] === region })
        const last = lines.findIndex((value, index) => { const m = marker(value); return index > first && /^end/i.test(m?.[1] || '') && m?.[2] === region })
        if (first < 0 || last < 0) throw new ContentError(current, 'include', `未找到完整区域 #${region}：${include}`, atLine)
        start = first + 1; lines = lines.slice(start, last)
      }
      if (parts[3] !== undefined) {
        const from = parts[3] ? Number(parts[3]) - 1 : 0, to = parts[4] ? Number(parts[4]) : lines.length
        if (from < 0 || to < from + 1 || to > lines.length) throw new ContentError(current, 'include', `无效行范围：${target}`, atLine)
        lines = lines.slice(from, to); start += from
      } else if (!parts[2] && extname(include) === '.md') {
        const content = matter(body).content
        start = body.split('\n').length - content.split('\n').length
        lines = content.split(/\r?\n/)
      }
      const nested = await expand(lines.join('\n'), include, start + 1, [...stack, identity])
      const offset = output.source.length
      output.source += nested.source
      output.spans.push(...nested.spans.map(span => ({ ...span, start: span.start + offset, end: span.end + offset })))
      cursor = match.index! + match[0].length
    }
    append(text.slice(cursor), { file: current, line: line + text.slice(0, cursor).split('\n').length - 1 })
    return output
  }
  const identity = await realpath(file)
  return { ...await expand(source, file, firstLine, [identity]), dependencies: [...dependencies] }
}
