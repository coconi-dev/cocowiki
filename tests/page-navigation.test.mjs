import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { createRequire } from 'node:module'
import { mkdtemp, mkdir, writeFile, symlink, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const repository = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const packageRoot = resolve(repository, 'packages/cocowiki')
const { build } = createRequire(resolve(packageRoot, 'package.json'))('esbuild')
let fixture, scanContent, navigationRecords

before(async () => {
  fixture = await mkdtemp(resolve(tmpdir(), 'cocowiki-navigation-'))
  await symlink(resolve(packageRoot, 'node_modules'), resolve(fixture, 'node_modules'), 'dir')
  const outfile = resolve(fixture, 'runtime.mjs')
  await build({
    stdin: {
      contents: `export { scanContent } from './src/node/content.ts'; export { navigationRecords } from './src/theme/pageNavigation.ts'`,
      resolveDir: packageRoot
    },
    bundle: true, platform: 'node', format: 'esm', packages: 'external', outfile
  })
  ;({ scanContent, navigationRecords } = await import(pathToFileURL(outfile).href))
})
after(async () => { if (fixture) await rm(fixture, { recursive: true, force: true }) })

const record = (route, order, extra = {}) => ({ route, title: route, order, ...extra })

test('reading sequence uses numeric ascending order, including zero, negatives and fractions', () => {
  const source = [record('/ten', 10), record('/two', 2), record('/zero', 0), record('/negative', -2), record('/fraction', .5)]
  assert.deepEqual(navigationRecords(source).map(r => r.route), ['/negative', '/zero', '/fraction', '/two', '/ten'])
  assert.equal(source[0].route, '/ten', 'sorting must not mutate the shared content index')
})

test('missing and invalid orders follow ordered pages; ties have a deterministic title/path fallback', () => {
  const source = [
    record('/z', undefined, { title: 'Same' }), record('/b', 2, { title: 'Same' }),
    record('/a', 2, { title: 'Same' }), record('/last', '1', { title: 'Zulu' }),
    record('/infinite', Infinity, { title: 'Beta' }), record('/nan', NaN, { title: 'Alpha' })
  ]
  assert.deepEqual(navigationRecords(source).map(r => r.route), ['/a', '/b', '/nan', '/infinite', '/z', '/last'])
})

test('utility layouts and search-disabled pages stay out of the sequence', () => {
  const source = ['home', 'search', 'archive', 'contributors'].map(layout => record(`/${layout}`, -1, { layout }))
  source.push(record('/hidden', -2, { search: false }), record('/doc', 1, { showPrevNext: false }), record('/vue', 2, { type: 'special' }))
  assert.deepEqual(navigationRecords(source).map(r => r.route), ['/doc', '/vue'])
})

test('Markdown and Vue metadata retain valid order through scanning and serialization', async () => {
  const content = resolve(fixture, 'content')
  await mkdir(content)
  await writeFile(resolve(content, 'intro.md'), '---\ntitle: Z intro\norder: 1\n---\n# Intro\n')
  await writeFile(resolve(content, 'vue.page.json'), JSON.stringify({ title: 'A Vue', order: 2 }))
  await writeFile(resolve(content, 'invalid.md'), '---\ntitle: Invalid\norder: "0"\n---\n')
  const records = JSON.parse(JSON.stringify(await scanContent(content)))
  assert.equal(records.find(r => r.route === '/intro').order, 1)
  assert.equal(records.find(r => r.route === '/vue').order, 2)
  assert.equal(records.find(r => r.route === '/invalid').order, undefined)
  assert.deepEqual(navigationRecords(records).map(r => r.route), ['/intro', '/vue', '/invalid'])
  assert.equal(records[0].route, '/vue', 'content index keeps its title-based ordering')
  // Changing an order in content must produce the new neighboring-page sequence.
  await writeFile(resolve(content, 'vue.page.json'), JSON.stringify({ title: 'A Vue', order: -1 }))
  assert.deepEqual(navigationRecords(await scanContent(content)).map(r => r.route), ['/vue', '/intro', '/invalid'])
})
