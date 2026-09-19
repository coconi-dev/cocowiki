export interface CocoWikiNavigationItem {
  text: string
  link?: string
  items?: CocoWikiNavigationItem[]
}

export interface CocoWikiDirectories {
  content?: string
  components?: string
  data?: string
  public?: string
  out?: string
}

export interface CocoWikiThemeComponents {
  Header?: string
  Home?: string
  Search?: string
  Archive?: string
  Contributors?: string
  PageMeta?: string
  PageOutline?: string
  ContentSidebar?: string
  PageNavigation?: string
  PageFooter?: string
  SearchOverlay?: string
  Loading?: string
  NotFound?: string
}

export interface CocoWikiThemeConfig {
  /** A complete VitePress-compatible theme entry, relative to the project root. */
  entry?: string
  /** One or more style sheets, relative to the project root. */
  styles?: string | string[]
  /** Replace individual components while keeping the default CoCoWiki layout. */
  components?: CocoWikiThemeComponents
}

export interface CocoWikiConfig {
  title: string
  description?: string
  lang?: string
  logo?: string
  favicon?: string
  base?: string
  navigation?: CocoWikiNavigationItem[]
  directories?: CocoWikiDirectories
  theme?: CocoWikiThemeConfig
  search?: {
    enabled?: boolean
    include?: string[]
    exclude?: string[]
  }
  markdown?: { spoiler?: boolean; wikiLink?: boolean }
  content?: {
    outline?: boolean
    sidebar?: 'none' | 'light' | 'outline'
    showPrevNext?: boolean
    showLastUpdated?: boolean
  }
  home?: {
    name?: string
    text?: string
    tagline?: string
    eyebrow?: string
    note?: string
    search?: { placeholder?: string }
    visual?: {
      image?: string
      labels?: string[]
    }
    actions?: Array<{
      text: string
      link: string
      theme?: 'brand' | 'alt'
    }>
  }
}

export interface CocoWikiPageMeta {
  title: string
  layout?: string
  description?: string
  type?: string
  category?: string
  tags?: string[]
  aliases?: string[]
  contributors?: string[]
  image?: string
  updated?: string
  search?: boolean
  archive?: boolean
  outline?: boolean
  sidebar?: 'none' | 'light' | 'outline'
  showPrevNext?: boolean
  showLastUpdated?: boolean
}

export function defineCocoWikiConfig(config: CocoWikiConfig): CocoWikiConfig {
  return config
}
