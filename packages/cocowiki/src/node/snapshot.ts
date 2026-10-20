import type { CocoWikiConfig } from '../config'
import type { ContentPage } from '../shared/content'
export interface Snapshot {
  pages: ContentPage[]
  config: CocoWikiConfig
  notify?: () => void
}
const key = Symbol.for('cocowiki.snapshots')
const scope = globalThis as typeof globalThis & { [key]?: Map<string, Snapshot> }
export const snapshots = scope[key] ||= new Map<string, Snapshot>()
