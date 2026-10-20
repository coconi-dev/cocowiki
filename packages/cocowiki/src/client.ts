/** Public browser API. Import from a VitePress/Vue application. */
export { useContentStore, useSearchStore, loadContentRecords, loadSearchContent, refreshContent } from './theme/content'
export { createSearch, searchDocuments, searchSnippet, highlightParts, tokenize, suggestQueries } from './theme/search'
export { browseRecords, browseUrl, readBrowseFilters, type BrowseFilters } from './theme/browse'
export { isSearchable, type PageSummary, type ContentRecord, type ContentDirectory, type SearchPayload } from './shared/content'
