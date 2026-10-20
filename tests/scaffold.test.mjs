import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createRequire } from 'node:module'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { execFileSync } from 'node:child_process'
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const pkg = resolve(root, 'packages/cocowiki')
const { build } = createRequire(resolve(pkg, 'package.json'))('esbuild')

test('scaffolding quotes apostrophes, newlines and YAML-sensitive names', async () => {
  const temporary = await mkdtemp(resolve(tmpdir(), 'cocowiki-scaffold-'))
  try {
    const name = "Alice's Wiki\n: #你好"
    const target = resolve(temporary, name)
    execFileSync(process.execPath, [resolve(root, 'packages/create-cocowiki/bin/create-cocowiki.mjs'), target])
    const config = await readFile(resolve(target, 'cocowiki.config.ts'), 'utf8')
    assert.ok(config.includes(`title: ${JSON.stringify(name)}`))
    const matter = createRequire(resolve(pkg, 'package.json'))('gray-matter')
    const page = matter(await readFile(resolve(target, 'content/index.md'), 'utf8'))
    assert.equal(page.data.title, name)
    assert.equal(page.data.hero.name, name)
    const out = resolve(temporary, 'scaffold.mjs')
    await build({ stdin: { contents: config.replace("import { defineCocoWikiConfig } from 'cocowiki'", 'const defineCocoWikiConfig = x => x'), resolveDir: target, loader: 'ts' }, outfile: out, format: 'esm' })
    assert.equal((await import(pathToFileURL(out).href)).default.title, name)
  } finally {
    await rm(temporary, { recursive: true, force: true })
  }
})
