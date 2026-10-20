import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createRequire } from 'node:module'
import { mkdtemp, symlink, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const pkg = resolve(root, 'packages/cocowiki')
const require = createRequire(resolve(pkg, 'package.json'))
const { build } = require('esbuild')
const { createRenderer, h, nextTick } = require('vue')

test('mounted consumers share requests, refresh reactively, report failures and reject stale responses', async () => {
  const temporary = await mkdtemp(resolve(tmpdir(), 'cocowiki-store-'))
  const originalFetch = globalThis.fetch
  try {
    await symlink(resolve(pkg, 'node_modules'), resolve(temporary, 'node_modules'), 'dir')
    await build({ entryPoints: [resolve(pkg, 'src/theme/content.ts')], bundle: true, platform: 'node', format: 'esm', packages: 'external', outfile: resolve(temporary, 'store.mjs'), plugins: [{ name: 'vitepress-stub', setup(build) {
      build.onResolve({ filter: /^virtual:cocowiki-directory$/ }, () => ({ path: 'directory', namespace: 'seed' }))
      build.onLoad({ filter: /.*/, namespace: 'seed' }, () => ({ contents: 'export default { version: \"\", records: [], searchUrl: \"\" }' })); build.onResolve({ filter: /^vitepress$/ }, () => ({ path: 'vitepress', namespace: 'stub' })); build.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({ contents: 'export const withBase = p => p' })) } }] })
    const api = await import(pathToFileURL(resolve(temporary, 'store.mjs')).href)
    const page = title => ({ id: '/page', route: '/page', title, tags: [], aliases: [], contributors: [], content: title, searchable: true })
    const payload = title => ({ version: title, searchUrl: `/search-index.${title}.json`, records: [page(title)] })
    const urls = []
    let currentTitle = 'First'
    const fetchData = async url => {
      urls.push(url)
      return { ok: true, json: async () => url.includes('content-directory') ? payload(currentTitle) : payload(url.match(/search-index\.(.*)\.json/)[1]) }
    }
    globalThis.fetch = fetchData
    const renderer = createRenderer({ createElement: () => ({}), insert() {}, remove() {}, setElementText() {}, createText: () => ({}), createComment: () => ({}), setText() {}, setComment() {}, parentNode: () => null, nextSibling: () => null, patchProp() {} })
    const consumers = []
    const Child = { setup() { const store = api.useContentStore(); consumers.push(store); return () => h('div', store.records.value[0]?.title || '') } }
    const app = renderer.createApp({ render: () => h('div', [h(Child), h(Child), h(Child)]) })
    app.mount({})
    await api.loadContentRecords()
    assert.deepEqual(urls, ['/content-directory.json'], 'ordinary reading never requests search text')
    const first = await api.loadSearchContent()
    assert.equal(first.index.search('First')[0].title, 'First')
    assert.equal((await api.loadSearchContent()).index, first.index, 'reuse the built MiniSearch instance')
    assert.equal(urls.length, 2)
    currentTitle = 'Second'
    await api.refreshContent()
    const second = await api.loadSearchContent()
    await nextTick()
    assert.ok(consumers.every(store => store.records.value[0].title === 'Second'))
    assert.equal(second.index.search('Second')[0].title, 'Second')
    assert.notEqual(second.index, first.index)
    globalThis.fetch = async () => ({ ok: false, status: 503 })
    await assert.rejects(api.refreshContent(), /503/)
    assert.ok(consumers.every(store => store.error.value?.message.includes('503') && !store.loading.value))
    let resolveOld
    globalThis.fetch = () => new Promise(resolve => { resolveOld = resolve })
    const older = api.refreshContent()
    currentTitle = 'Latest'; globalThis.fetch = fetchData
    await api.refreshContent()
    resolveOld({ ok: true, json: async () => payload('Stale') })
    await older
    assert.ok(consumers.every(store => store.records.value[0].title === 'Latest' && !store.error.value))
    await api.loadSearchContent()
    currentTitle = 'Mismatch'
    globalThis.fetch = async url => ({ ok: true, json: async () => url.includes('content-directory') ? payload('Mismatch') : payload('Wrong') })
    await api.refreshContent()
    await assert.rejects(api.loadSearchContent(), /版本不一致/)
    app.unmount()
  } finally { globalThis.fetch = originalFetch; await rm(temporary, { recursive: true, force: true }) }
})
