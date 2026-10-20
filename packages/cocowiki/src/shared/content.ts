import type { DocumentAnalysis } from '../node/document'
import type { CocoWikiPageMeta } from '../config'

/** Browser-facing projection. It contains no machine-local paths or raw scripts. */
export interface PageSummary extends CocoWikiPageMeta {
  id: string
  route: string
  searchable: boolean
  lastUpdated?: number
  references?: string[]
  backlinks?: string[]
  relatedLinks?: string[]
}

export interface ContentRecord extends PageSummary { content: string; excerpt: string }
export interface ContentDirectory { version: string; records: PageSummary[]; searchUrl: string }
export interface SearchPayload { version: string; records: ContentRecord[] }
export function isSearchable(record: PageSummary) {
  return record.searchable !== false && record.search !== false && !['home', 'search', 'archive', 'contributors'].includes(record.layout || '')
}

/** One parsed source page, shared by generation and VitePress adaptation. */
export interface ContentPage extends ContentRecord {
  sourcePath: string
  kind: 'markdown' | 'vue'
  generatedPath: string
  analysis?: DocumentAnalysis
  sourceContent: string
  frontmatter: Record<string, unknown>
}

/** @deprecated Use ContentRecord. */
export type SearchRecord = ContentRecord
