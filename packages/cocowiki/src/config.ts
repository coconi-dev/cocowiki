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

export interface CocoWikiConfig {
  title: string
  description?: string
  lang?: string
  logo?: string
  favicon?: string
  base?: string
  navigation?: CocoWikiNavigationItem[]
  directories?: CocoWikiDirectories
  theme?: { entry?: string }
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
