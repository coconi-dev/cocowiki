import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createRequire } from 'node:module'
import { mkdtemp, readFile, symlink, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const pkg = resolve(root, 'packages/cocowiki')
const require = createRequire(resolve(pkg, 'package.json'))
const { build } = require('esbuild')
const { parse, compileScript } = require('vue/compiler-sfc')
const { createRenderer, nextTick } = require('vue')

test('mounted search tracks full navigation URLs and restores existing router hooks', async () => {
  const temporary = await mkdtemp(resolve(tmpdir(), 'cocowiki-search-navigation-'))
  const originalFetch = globalThis.fetch
  const originalLocation = globalThis.location
  const previousCalls = []
  const previousHook = href => { previousCalls.push(href) }
  globalThis.__cocowikiTestRouter = { onAfterRouteChange: previousHook }
  globalThis.location = { href: 'http://example.com/search?q=Alpha' }
  const page = title => ({ id: `/${title}`, route: `/${title}`, title, tags: [], aliases: [], contributors: [], content: title, searchable: true })
  globalThis.fetch = async () => ({ ok: true, json: async () => [page('Alpha'), page('Beta')] })
  let app
  try {
    await symlink(resolve(pkg, 'node_modules'), resolve(temporary, 'node_modules'), 'dir')
    const outfile = resolve(temporary, 'search.mjs')
    await build({ entryPoints: [resolve(pkg, 'src/theme/components/SearchView.vue')], bundle: true, platform: 'node', format: 'esm', packages: 'external', outfile, plugins: [{ name: 'test-components', setup(build) {
      build.onResolve({ filter: /^vitepress$/ }, () => ({ path: 'vitepress', namespace: 'test' }))
      build.onLoad({ filter: /.*/, namespace: 'test' }, () => ({ contents: 'export const withBase = p => p; export const useRouter = () => globalThis.__cocowikiTestRouter' }))
      build.onLoad({ filter: /\.vue$/ }, async ({ path }) => {
        const { descriptor } = parse(await readFile(path, 'utf8'))
        return { contents: compileScript(descriptor, { id: path, inlineTemplate: false }).content, loader: 'ts' }
      })
    } }] })
    const Component = (await import(pathToFileURL(outfile).href)).default
    Component.render = () => null
    const renderer = createRenderer({ createElement: () => ({}), insert() {}, remove() {}, setElementText() {}, createText: () => ({}), createComment: () => ({}), setText() {}, setComment() {}, parentNode: () => null, nextSibling: () => null, patchProp() {} })
    app = renderer.createApp(Component)
    app.mount({})
    const state = app._instance.setupState
    await new Promise(resolve => setImmediate(resolve))
    await nextTick()
    assert.equal(state.query, 'Alpha')
    assert.deepEqual(state.results.map(result => result.title), ['Alpha'])
    for (const href of ['/search?q=Beta', '/search?q=Alpha', '/search', '/search?q=%E4%B8%AD%E6%96%87']) {
      globalThis.location.href = new URL(href, 'http://example.com').href
      await globalThis.__cocowikiTestRouter.onAfterRouteChange(href)
      await nextTick()
      const query = new URL(href, 'http://example.com').searchParams.get('q') || ''
      assert.equal(state.query, query)
      if (query === 'Alpha' || query === 'Beta') assert.deepEqual(state.results.map(result => result.title), [query])
    }
    assert.equal(previousCalls.length, 4)
    app.unmount()
    app = undefined
    assert.equal(globalThis.__cocowikiTestRouter.onAfterRouteChange, previousHook)
  } finally {
    app?.unmount()
    globalThis.fetch = originalFetch
    if (originalLocation === undefined) delete globalThis.location
    else globalThis.location = originalLocation
    delete globalThis.__cocowikiTestRouter
    await rm(temporary, { recursive: true, force: true })
  }
})
