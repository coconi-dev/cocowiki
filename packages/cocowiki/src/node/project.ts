import { resolve } from 'node:path'
import type { CocoWikiConfig } from '../config.ts'

export interface CocoWikiProjectPaths {
  projectRoot: string
  runtimeRoot: string
  contentDir: string
  componentsDir: string
  dataDir: string
  publicDir: string
  outDir: string
}

export function resolveProjectPaths(projectRoot: string, config: CocoWikiConfig): CocoWikiProjectPaths {
  const directories = config.directories || {}
  return {
    projectRoot,
    runtimeRoot: resolve(projectRoot, '.cocowiki/site'),
    contentDir: resolve(projectRoot, directories.content || 'content'),
    componentsDir: resolve(projectRoot, directories.components || 'components'),
    dataDir: resolve(projectRoot, directories.data || 'data'),
    publicDir: resolve(projectRoot, directories.public || 'public'),
    outDir: resolve(projectRoot, directories.out || 'dist')
  }
}
