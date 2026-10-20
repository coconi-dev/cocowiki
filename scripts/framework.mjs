import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
export const root = fileURLToPath(new URL('../', import.meta.url))
export const framework = resolve(root, 'packages/cocowiki')
export const { build, context } = createRequire(resolve(framework, 'package.json'))('esbuild')
export const buildOptions = { absWorkingDir: framework, entryPoints: ['src/config.ts', 'src/node/vitepress.ts', 'src/node/cli.ts'], bundle: true, platform: 'node', format: 'esm', packages: 'external', outdir: 'dist' }
export const bootstrap = () => build(buildOptions)
if (process.argv[1] === fileURLToPath(import.meta.url)) await bootstrap()
