declare module 'virtual:cocowiki-config' {
  import type { CocoWikiConfig } from './config'
  const config: CocoWikiConfig
  export default config
}

declare module 'virtual:cocowiki-contributors' {
  const contributors: Record<string, {
    name?: string
    initials?: string
    role?: string
    avatar?: string
    url?: string
    github?: string
  }>
  export default contributors
}
