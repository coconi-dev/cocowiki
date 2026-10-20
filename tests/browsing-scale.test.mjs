import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createRequire } from 'node:module'
import { mkdtemp, readFile, symlink, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..'), pkg = resolve(root, 'packages/cocowiki')
const require = createRequire(resolve(pkg, 'package.json'))
const { build } = require('esbuild'), { parse, compileScript } = require('vue/compiler-sfc'), { createRenderer, nextTick } = require('vue')
const pages = Array.from({ length: 250 }, (_, n) => ({ id: `/page-${n}`, route: `/page-${n}`, title: `长标题资料 ${n}`, category: '地点', tags: ['常用', `标签-${n}`], content: '一份可检索的资料', searchable: true }))
async function mount(name) {
  const temporary = await mkdtemp(resolve(tmpdir(), 'cocowiki-scale-'))
  await symlink(resolve(pkg, 'node_modules'), resolve(temporary, 'node_modules'), 'dir')
  const outfile = resolve(temporary, 'component.mjs')
  await build({ entryPoints: [resolve(pkg, `src/theme/components/${name}.vue`)], bundle: true, platform: 'node', format: 'esm', packages: 'external', outfile, plugins: [{ name: 'scale', setup(build) {
    build.onResolve({ filter: /^virtual:cocowiki-directory$/ }, () => ({ path: 'seed', namespace: 'stub' }))
    build.onResolve({ filter: /^vitepress$/ }, () => ({ path: 'vitepress', namespace: 'stub' }))
    build.onLoad({ filter: /.*/, namespace: 'stub' }, ({ path }) => ({ contents: path === 'seed' ? `export default ${JSON.stringify({ version: 'scale', searchUrl: '/search-index.scale.json', records: pages.map(({ content, ...record }) => record) })}` : 'export const withBase = p => p; export const useRouter = () => globalThis.__scaleRouter' }))
    build.onLoad({ filter: /\.vue$/ }, async ({ path }) => ({ contents: compileScript(parse(await readFile(path, 'utf8')).descriptor, { id: path, inlineTemplate: false }).content, loader: 'ts' }))
  } }] })
  const Component = (await import(pathToFileURL(outfile).href)).default
  Component.render = () => null
  const renderer = createRenderer({ createElement: () => ({}), insert() {}, remove() {}, setElementText() {}, createText: () => ({}), createComment: () => ({}), setText() {}, setComment() {}, parentNode: () => null, nextSibling: () => null, patchProp() {} })
  const app = renderer.createApp(Component); app.mount({})
  return { state: app._instance.setupState, async close() { app.unmount(); await rm(temporary, { recursive: true, force: true }) } }
}
test('large archives bound initial rows and tags, preserve selected tags and reset pagination', async () => {
  const original = { location: globalThis.location, history: globalThis.history, fetch: globalThis.fetch }
  globalThis.location = { href: 'http://example.com/archive' }; globalThis.history = { state: {}, pushState() {} }; globalThis.__scaleRouter = {}
  globalThis.fetch = () => { throw Error('ordinary archive must use its static seed') }
  const app = await mount('ArchiveView')
  try {
    const s = app.state
    assert.equal(s.total, 250); assert.equal(s.visibleCount, 40); assert.equal(s.visibleTags.length, 12)
    s.limit += 40; assert.equal(s.visibleCount, 80)
    s.toggleTag('标签-249'); await nextTick()
    assert.equal(s.visibleCount, 1); assert.equal(s.limit, 40); assert.ok(s.visibleTags.includes('标签-249'))
    s.tagQuery = '不匹配'; assert.deepEqual([...s.visibleTags], ['标签-249'])
    s.clear(); s.tagQuery = ''; s.showAllTags = true
    assert.equal(s.visibleTags.length, 251)
  } finally { await app.close(); for (const [key, value] of Object.entries(original)) { if (value === undefined) delete globalThis[key]; else globalThis[key] = value } delete globalThis.__scaleRouter }
})
test('large search lists bound initial DOM records and keyboard chooses the active overlay result', async () => {
  const keys = ['location', 'fetch', 'window', 'document', '__scaleRouter'], original = keys.map(key => globalThis[key])
  const events = new Map(); let navigated, returnedFocus = false
  globalThis.location = { href: 'http://example.com/search' }
  globalThis.__scaleRouter = { go: url => { navigated = url } }
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ version: 'scale', records: pages }) })
  globalThis.window = { addEventListener: (name, callback) => events.set(name, callback), removeEventListener: name => events.delete(name) }
  globalThis.document = { activeElement: { focus() { returnedFocus = true } }, body: { style: { overflow: '' } }, getElementById: () => ({ scrollIntoView() {} }) }
  let app
  try {
    app = await mount('SearchView')
    for (let i = 0; i < 30 && app.state.loading; i++) await new Promise(resolve => setImmediate(resolve))
    assert.equal(app.state.results.length, 250); assert.equal(app.state.visibleResults.length, 30)
    app.state.limit += 30; assert.equal(app.state.visibleResults.length, 60)
    app.state.query = '长标题'; await nextTick(); assert.equal(app.state.visibleResults.length, 30)
    await app.close(); app = await mount('SearchOverlay')
    for (let i = 0; i < 30 && app.state.loading; i++) await new Promise(resolve => setImmediate(resolve))
    const input = { focus() {} }; app.state.input = input
    const key = value => events.get('keydown')({ key: value, target: app.state.input, preventDefault() {} })
    key('ArrowDown'); assert.equal(app.state.active, 1)
    key('ArrowUp'); assert.equal(app.state.active, 0)
    key('ArrowUp'); assert.equal(app.state.active, 4)
    key('Enter'); assert.equal(navigated, app.state.results[4].route)
    await app.close(); app = undefined
    assert.equal(events.size, 0); assert.equal(globalThis.document.body.style.overflow, ''); assert.ok(returnedFocus)
  } finally { await app?.close(); keys.forEach((key, n) => { if (original[n] === undefined) delete globalThis[key]; else globalThis[key] = original[n] }) }
})
