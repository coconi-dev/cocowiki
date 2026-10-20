export interface SourceLocation { file: string; line: number }
export interface SourceSpan extends SourceLocation { start: number; end: number }
export interface SourceDocument { source: string; spans: SourceSpan[]; dependencies: string[] }
export interface DocumentReference { target: string; line: number; file?: string; image?: boolean }
export interface DocumentAnalysis {
  text: string
  wiki: DocumentReference[]
  links: DocumentReference[]
  headings: Array<{ level: number; title: string; line: number; file?: string }>
}
