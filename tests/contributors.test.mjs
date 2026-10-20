import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createRequire } from 'node:module'
import { mkdtemp, rm, symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const pkg = resolve(root, 'packages/cocowiki')
const { build } = createRequire(resolve(pkg, 'package.json'))('esbuild')

test('prototype-looking contributor names count normally', async () => {
  const temporary = await mkdtemp(resolve(tmpdir(), 'cocowiki-contributors-'))
  try {
    await symlink(resolve(pkg, 'node_modules'), resolve(temporary, 'node_modules'), 'dir')
    const outfile = resolve(temporary, 'contributors.mjs')
    await build({ entryPoints: [resolve(pkg, 'src/theme/contributors.ts')], bundle: true, platform: 'node', format: 'esm', packages: 'external', outfile })
    const api = await import(pathToFileURL(outfile).href)
    const unregister = api.registerContributorContributions('fixture', ['__proto__', 'constructor', 'toString', '__proto__'])
    const counts = api.useContributorContributionSources().get('fixture')
    assert.equal(counts.__proto__, 2)
    assert.equal(counts.constructor, 1)
    assert.equal(counts.toString, 1)
    unregister()
    assert.equal(api.useContributorContributionSources().has('fixture'), false)
  } finally {
    await rm(temporary, { recursive: true, force: true })
  }
})
