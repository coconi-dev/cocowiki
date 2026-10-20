import type { CocoWikiPageMeta } from '../config'

/** Browser-facing projection. It contains no machine-local paths or raw scripts. */
export interface ContentRecord extends CocoWikiPageMeta {
  id: string
  route: string
  content: string
  excerpt: string
  searchable: boolean
  lastUpdated?: number
}

/** One parsed source page, shared by generation and VitePress adaptation. */
export interface ContentPage extends ContentRecord {
  sourcePath: string
  kind: 'markdown' | 'vue'
  generatedPath: string
  sourceContent: string
  frontmatter: Record<string, unknown>
}

/** @deprecated Use ContentRecord. */
export type SearchRecord = ContentRecord
