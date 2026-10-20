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

export function resolveProjectPaths(projectRoot: string, config: CocoWikiConfig, runtimeRoot = resolve(projectRoot, '.cocowiki/site')): CocoWikiProjectPaths {
  const directories = config.directories || {}
  return {
    projectRoot,
    runtimeRoot,
    contentDir: resolve(projectRoot, directories.content || 'content'),
    componentsDir: resolve(projectRoot, directories.components || 'components'),
    dataDir: resolve(projectRoot, directories.data || 'data'),
    publicDir: resolve(projectRoot, directories.public || 'public'),
    outDir: resolve(projectRoot, directories.out || 'dist')
  }
}

export type RuntimeMode = 'dev' | 'build' | 'preview'
export function runtimePath(projectRoot: string, mode: RuntimeMode) {
  return resolve(projectRoot, '.cocowiki', mode === 'dev' ? 'site' : mode)
}
