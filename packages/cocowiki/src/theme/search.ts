import MiniSearch from 'minisearch'
import type { SearchRecord } from '../node/content'

export function tokenize(text: string) {
  const normalized = text.toLocaleLowerCase().trim()
  const words = normalized.match(/[a-z0-9]+|[\u3400-\u9fff]/g) || []
  const chinese = [...normalized.replace(/[^\u3400-\u9fff]/g, '')]
  const pairs = chinese.slice(0, -1).map((char, index) => char + chinese[index + 1])
  return [...new Set([...words, ...pairs])]
}

export function createSearch(records: SearchRecord[]) {
  const search = new MiniSearch({
    fields: ['title', 'aliases', 'tags', 'contributors', 'description', 'content'],
    storeFields: ['route', 'title', 'type', 'category', 'description', 'content', 'aliases', 'contributorNames'],
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
