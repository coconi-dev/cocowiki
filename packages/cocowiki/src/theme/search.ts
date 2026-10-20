import MiniSearch from 'minisearch'
import type { ContentRecord } from '../shared/content'

export function tokenize(text: string) {
  const normalized = text.toLocaleLowerCase().normalize('NFKC').trim()
  const tokens: string[] = []
  for (const word of normalized.match(/\p{Script=Han}+|[a-z0-9]+/gu) || []) {
    if (/\p{Script=Han}/u.test(word)) {
      const characters = [...word]
      tokens.push(...characters, ...characters.slice(0, -1).map((char, i) => char + characters[i + 1]))
    } else tokens.push(word)
  }
  return [...new Set(tokens)]
}

export function createSearch(records: ContentRecord[]) {
  const search = new MiniSearch({
    fields: ['title', 'aliases', 'tags', 'contributors', 'description', 'content'],
    storeFields: ['route', 'title', 'type', 'category', 'description', 'content', 'aliases', 'contributorNames', 'status'],
    searchOptions: {
      boost: { title: 4, aliases: 3, contributors: 2.5, tags: 2, description: 1.5 },
      prefix: true,
      fuzzy: 0.16
    },
    tokenize
  })

  search.addAll(records.map((record) => ({
    ...record,
    aliases: record.aliases?.join(' '),
    tags: record.tags?.join(' '),
    contributorNames: record.contributors,
    contributors: record.contributors?.join(' ')
  })))

  return search
}

export function searchTerms(query: string) {
  return [...new Set(query.normalize('NFKC').toLocaleLowerCase().match(/\p{Script=Han}+|[a-z0-9]+/gu) || [])]
}
export function searchDocuments(index: ReturnType<typeof createSearch>, query: string) {
  if (!searchTerms(query).length) return []
  return index.search(query, {
    combineWith: 'AND',
    prefix: term => /^[a-z0-9]+$/.test(term) && term.length >= 2,
    fuzzy: term => /^[a-z0-9]+$/.test(term) && term.length >= 4 ? 0.16 : false
  })
}
export function highlightParts(text: string, query: string): Array<{ text: string; match: boolean }> {
  const terms = searchTerms(query).sort((a, b) => b.length - a.length)
  if (!terms.length) return [{ text, match: false }]
  const pattern = new RegExp(terms.map(term => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'giu')
  const parts: Array<{ text: string; match: boolean }> = []
  let end = 0
  for (const match of text.matchAll(pattern)) {
    if (match.index! > end) parts.push({ text: text.slice(end, match.index), match: false })
    parts.push({ text: match[0], match: true })
    end = match.index! + match[0].length
  }
  if (end < text.length) parts.push({ text: text.slice(end), match: false })
  return parts
}
export function searchSnippet(item: { title: string; description?: string; content?: string; aliases?: string | string[]; contributors?: string[]; contributorNames?: string[] }, query: string) {
  const terms = searchTerms(query)
  const names = item.contributorNames || item.contributors || []
  const sources = [item.content || '', item.description || '', Array.isArray(item.aliases) ? item.aliases.join('、') : item.aliases || '', names.length ? `贡献者：${names.join('、')}` : '']
  let best = sources[0] || sources[1], bestScore = -1, bestStart = 0
  for (const source of sources) for (const term of terms.length ? terms : ['']) {
    const position = source.toLocaleLowerCase().indexOf(term)
    if (position < 0) continue
    const start = Math.max(0, position - 35)
    const window = source.slice(start, start + 160).toLocaleLowerCase()
    const score = terms.filter(term => window.includes(term)).length
    if (score > bestScore) { best = source; bestScore = score; bestStart = start }
  }
  return `${bestStart ? '…' : ''}${best.slice(bestStart, bestStart + 160)}${bestStart + 160 < best.length ? '…' : ''}`
}
export function suggestQueries(records: readonly ContentRecord[], query: string) {
  const terms = searchTerms(query)
  return records.map(page => ({ title: page.title, score: terms.filter(term => [page.title, ...(page.aliases || []), ...(page.tags || [])].join(' ').toLocaleLowerCase().includes(term)).length }))
    .filter(page => page.score > 0 && page.title !== query).sort((a, b) => b.score - a.score).slice(0, 3).map(page => page.title)
}
