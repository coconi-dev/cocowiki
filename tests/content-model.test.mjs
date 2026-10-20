import assert from 'node:assert/strict'
import { test, before, after } from 'node:test'
import { createRequire } from 'node:module'
import { mkdtemp, mkdir, writeFile, readFile, rm, symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { execFileSync } from 'node:child_process'
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const pkg = resolve(root, 'packages/cocowiki')
const { build } = createRequire(resolve(pkg, 'package.json'))('esbuild')
let temporary, api
before(async () => {
  temporary = await mkdtemp(resolve(tmpdir(), 'cocowiki-model-'))
  await symlink(resolve(pkg, 'node_modules'), resolve(temporary, 'node_modules'), 'dir')
  const out = resolve(temporary, 'model.mjs')
  await build({ stdin: { contents: `export * from './src/node/content'; export * from './src/node/validation'; export * from './src/node/runtime'; export * from './src/node/markdown'; export * from './src/shared/routes'; export * from './src/theme/search'; export * from './src/theme/archive';`, resolveDir: pkg }, bundle: true, platform: 'node', format: 'esm', packages: 'external', outfile: out })
  api = await import(pathToFileURL(out).href)
})
after(async () => { if (temporary) await rm(temporary, { recursive: true, force: true }) })
async function fixture() {
  const site = await mkdtemp(resolve(temporary, 'site-'))
  await mkdir(resolve(site, 'content'))
  return site
}
async function put(site, file, text) {
  await mkdir(dirname(resolve(site, file)), { recursive: true })
  await writeFile(resolve(site, file), text)
}

test('flat and directory pages retain separate IDs, encoded routes and navigation identity', async () => {
  const site = await fixture()
  await put(site, 'content/guide.md', '---\ntitle: Flat\n---\n')
  await put(site, 'content/guide/index.md', '---\ntitle: Directory\n---\n')
  await put(site, 'content/中文 空格.md', '---\ntitle: Encoded\n---\n')
  const pages = await api.scanContent(resolve(site, 'content'))
  assert.deepEqual(pages.map(p => p.route), ['/guide/', '/%E4%B8%AD%E6%96%87%20%E7%A9%BA%E6%A0%BC', '/guide'])
  assert.doesNotThrow(() => api.createSearch(pages))
  assert.equal(api.canonicalRoute('/wiki/guide/index.html'), '/wiki/guide/')
  assert.notEqual(api.canonicalRoute('/wiki/guide/'), api.canonicalRoute('/wiki/guide.html'))
})
test('Vue discovery follows source files and metadata removal falls back to filename', async () => {
  const site = await fixture(), content = resolve(site, 'content')
  await put(site, 'content/card.page.vue', '<template>Card</template>')
  await put(site, 'content/orphan.page.json', '{"title":"Orphan"}')
  let pages = await api.scanContent(content)
  assert.equal(pages.length, 1)
  assert.equal(pages[0].title, 'card')
  await put(site, 'content/card.page.json', '{"title":"Card metadata"}')
  pages = await api.scanContent(content)
  await api.prepareRuntime(site, { title: 'Test' }, 'dev', pages)
  assert.match(await readFile(resolve(site, '.cocowiki/site/card.md'), 'utf8'), /Card metadata/)
  await rm(resolve(content, 'card.page.json'))
  pages = await api.scanContent(content)
  await api.prepareRuntime(site, { title: 'Test' }, 'dev', pages)
  assert.match(await readFile(resolve(site, '.cocowiki/site/card.md'), 'utf8'), /"title": "card"/)
  await rm(resolve(content, 'card.page.vue'))
  await api.prepareRuntime(site, { title: 'Test' }, 'dev', await api.scanContent(content))
  await assert.rejects(readFile(resolve(site, '.cocowiki/site/card.md')), { code: 'ENOENT' })
})
test('search include/exclude never removes pages from the complete snapshot', async () => {
  const site = await fixture()
  await put(site, 'content/public.md', '---\ntitle: Public\n---\n')
  await put(site, 'content/private/hidden.md', '---\ntitle: Hidden\ncontributors: [Author]\n---\n')
  await put(site, 'content/private/vue.page.vue', '<template>Vue</template>')
  const pages = await api.scanContent(resolve(site, 'content'), { include: ['public.md'], exclude: ['private/**'] })
  assert.equal(pages.length, 3)
  assert.deepEqual(pages.filter(p => p.searchable).map(p => p.title), ['Public'])
  assert.deepEqual(pages.find(p => p.title === 'Hidden').contributors, ['Author'])
})
test('metadata and duplicate identities fail early with path and field diagnostics', async () => {
  const site = await fixture(), content = resolve(site, 'content')
  for (const [field, value] of [['tags', 'invalid'], ['aliases', [3]], ['title', 42], ['search', 'false'], ['updated', 'not a date']]) {
    await put(site, 'content/a.md', `---\n${field}: ${JSON.stringify(value)}\n---\n`)
    await assert.rejects(api.scanContent(content), error => error.message.includes('a.md') && error.message.includes(field))
  }
  await put(site, 'content/a.md', '---\ntitle: A\naliases: [Same]\n---\n')
  await put(site, 'content/b.md', '---\ntitle: Same\n---\n')
  await assert.rejects(api.scanContent(content), /title\/aliases.*a.md/)
  await rm(resolve(content, 'b.md'))
  await put(site, 'content/a.page.vue', '<template>A</template>')
  await assert.rejects(api.scanContent(content), /route.*a.md/)
})
test('manual update overrides source Git dates; Vue dates include metadata history', async () => {
  const site = await fixture()
  execFileSync('git', ['init', '-q', site])
  await put(site, 'content/date.md', '---\ntitle: Date\n---\n')
  execFileSync('git', ['add', '.'], { cwd: site })
  execFileSync('git', ['-c', 'user.name=Test', '-c', 'user.email=test@example.com', 'commit', '-qm', 'fixture'], { cwd: site, env: { ...process.env, GIT_AUTHOR_DATE: '2024-01-02T00:00:00Z', GIT_COMMITTER_DATE: '2024-01-02T00:00:00Z' } })
  let [page] = await api.scanContent(resolve(site, 'content'))
  assert.equal(page.lastUpdated, Date.parse('2024-01-02T00:00:00Z'))
  await put(site, 'content/date.md', '---\ntitle: Date\nupdated: 2025-02-03\n---\n')
  ;[page] = await api.scanContent(resolve(site, 'content'))
  assert.equal(page.lastUpdated, Date.parse('2025-02-03T00:00:00Z'))
})
test('relative imports/includes use source location and manifest maps original files', async () => {
  const site = await fixture()
  await put(site, 'components/Chart.vue', '<template>Chart</template>')
  await put(site, 'snippets/part.md', 'Included')
  await put(site, 'content/demo.md', '<script setup>\nimport Chart from "../components/Chart.vue"\n</script>\n<!-- @include: ../snippets/part.md -->')
  const pages = await api.scanContent(resolve(site, 'content'))
  await api.prepareRuntime(site, { title: 'Test' }, 'dev', pages)
  const generated = await readFile(resolve(site, '.cocowiki/site/demo.md'), 'utf8')
  assert.match(generated, /\.\.\/\.\.\/components\/Chart.vue/)
  assert.match(generated, /\.\.\/\.\.\/snippets\/part.md/)
  const manifest = JSON.parse(await readFile(resolve(site, '.cocowiki/site/.vitepress/manifest.json'), 'utf8'))
  assert.equal(manifest.pages[0].sourcePath, resolve(site, 'content/demo.md'))
  const example = '```js\nimport Chart from "../components/Chart.vue"\n```'
  assert.equal(api.rebaseMarkdown(example, resolve(site, 'content/demo.md'), resolve(site, '.cocowiki/site/demo.md')), example)
})
test('Wiki links read the current snapshot instead of a copied map', async () => {
  const MarkdownIt = createRequire(resolve(pkg, 'package.json'))('vitepress').createMarkdownRenderer
  const md = await MarkdownIt(temporary)
  const records = [{ title: 'Old', aliases: ['Alias'], route: '/old' }]
  api.applyCocoWikiMarkdown(md, records, { base: '/wiki/' })
  assert.match(md.render('[[Alias]]'), /href="\/wiki\/old"/)
  records.splice(0, 1, { title: 'New', aliases: ['Alias'], route: '/new/' })
  assert.match(md.render('[[Alias]]'), /href="\/wiki\/new\/"/)
})
test('configuration preflight rejects missing theme files, unsafe directories and wrong fields', async () => {
  const site = await fixture()
  assert.throws(() => api.validateConfig({ title: 'Test', theme: { entry: 'missing.ts' } }, site), /theme.entry/)
  assert.throws(() => api.validateConfig({ title: 'Test', theme: { components: { Invalid: 'x.vue' } } }, site), /未知主题组件/)
  assert.throws(() => api.validateConfig({ title: 'Test', directories: { out: 'content/dist' } }, site), /重叠/)
  assert.throws(() => api.validateConfig({ title: 'Test', search: { exclude: 'bad' } }, site), /search.exclude/)
})

test('archive safely groups every legal category, including object prototype names', () => {
  const categories = ['constructor', 'toString', '__proto__']
  const records = categories.map((category, index) => ({ id: String(index), route: `/${index}`, title: category, category, content: '', tags: [], aliases: [] }))
  const groups = new Map(api.archiveGroups(records))
  for (const category of categories) assert.equal(groups.get(category)[0].title, category)
  assert.equal(api.archiveGroups([{ ...records[0], search: false }]).length, 1)
  assert.equal(api.archiveGroups([{ ...records[0], archive: false }]).length, 0)
})

test('runtime reconciles file/directory transitions, removes empty directories and repairs partial runs', async () => {
  const site = await fixture(), content = resolve(site, 'content'), runtime = resolve(site, '.cocowiki/site')
  const config = { title: 'Paths' }
  await put(site, 'content/files', 'initial file')
  await api.prepareRuntime(site, config, 'dev', await api.scanContent(content))
  await rm(resolve(content, 'files'))
  await put(site, 'content/files/nested/manual.pdf', 'PDF content')
  await api.prepareRuntime(site, config, 'dev', await api.scanContent(content))
  assert.equal(await readFile(resolve(runtime, 'files/nested/manual.pdf'), 'utf8'), 'PDF content')
  await rm(resolve(content, 'files'), { recursive: true })
  await put(site, 'content/files', 'replacement file')
  await api.prepareRuntime(site, config, 'dev', await api.scanContent(content))
  assert.equal(await readFile(resolve(runtime, 'files'), 'utf8'), 'replacement file')
  await rm(resolve(content, 'files'))
  await api.prepareRuntime(site, config, 'dev', await api.scanContent(content))
  await assert.rejects(readFile(resolve(runtime, 'files')), { code: 'ENOENT' })
  // Simulate a failed run leaving an incompatible path outside the manifest.
  await put(site, '.cocowiki/site/files', 'partial write')
  await put(site, 'content/files/manual.pdf', 'retry')
  await api.prepareRuntime(site, config, 'dev', await api.scanContent(content))
  assert.equal(await readFile(resolve(runtime, 'files/manual.pdf'), 'utf8'), 'retry')
  await rm(resolve(content, 'files'), { recursive: true })
  await api.prepareRuntime(site, config, 'dev', await api.scanContent(content))
  const { stat } = await import('node:fs/promises')
  await assert.rejects(stat(resolve(runtime, 'files')), { code: 'ENOENT' })
})
