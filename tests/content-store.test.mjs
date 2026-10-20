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
    await build({ entryPoints: [resolve(pkg, 'src/theme/content.ts')], bundle: true, platform: 'node', format: 'esm', packages: 'external', outfile: resolve(temporary, 'store.mjs'), plugins: [{ name: 'vitepress-stub', setup(build) { build.onResolve({ filter: /^vitepress$/ }, () => ({ path: 'vitepress', namespace: 'stub' })); build.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({ contents: 'export const withBase = p => p' })) } }] })
    const api = await import(pathToFileURL(resolve(temporary, 'store.mjs')).href)
    const page = title => ({ id: '/page', route: '/page', title, tags: [], aliases: [], contributors: [], content: title, searchable: true })
    let calls = 0
    globalThis.fetch = async () => { calls++; return { ok: true, json: async () => [page('First')] } }
    const renderer = createRenderer({ createElement: () => ({}), insert() {}, remove() {}, setElementText() {}, createText: () => ({}), createComment: () => ({}), setText() {}, setComment() {}, parentNode: () => null, nextSibling: () => null, patchProp() {} })
    const consumers = []
    const Child = { setup() { const store = api.useContentStore(); consumers.push(store); return () => h('div', store.records.value[0]?.title || '') } }
    const app = renderer.createApp({ render: () => h('div', [h(Child), h(Child), h(Child)]) })
    app.mount({})
    await api.loadContentRecords()
    assert.equal(calls, 1)
    globalThis.fetch = async () => ({ ok: true, json: async () => [page('Second')] })
    await api.refreshContent()
    await nextTick()
    assert.ok(consumers.every(store => store.records.value[0].title === 'Second'))
    assert.equal(consumers[0].index.value.search('Second')[0].title, 'Second')
    globalThis.fetch = async () => ({ ok: false, status: 503 })
    await assert.rejects(api.refreshContent(), /503/)
    assert.ok(consumers.every(store => store.error.value?.message.includes('503') && !store.loading.value))
    let resolveOld
    globalThis.fetch = () => new Promise(resolve => { resolveOld = resolve })
    const older = api.refreshContent()
    globalThis.fetch = async () => ({ ok: true, json: async () => [page('Latest')] })
    await api.refreshContent()
    resolveOld({ ok: true, json: async () => [page('Stale')] })
    await older
    assert.ok(consumers.every(store => store.records.value[0].title === 'Latest' && !store.error.value))
    app.unmount()
  } finally { globalThis.fetch = originalFetch; await rm(temporary, { recursive: true, force: true }) }
})
