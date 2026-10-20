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
const { createRenderer, nextTick, h, ref } = require('vue')

test('outline follows actual headings, router scroll offset and updates; removes listeners on unmount', async () => {
  const temporary = await mkdtemp(resolve(tmpdir(), 'cocowiki-outline-'))
  const globals = ['window', 'document', 'requestAnimationFrame', 'cancelAnimationFrame']
  const original = globals.map(key => globalThis[key])
  const listeners = new Map(), frames = new Map()
  let id = 0
  const heading = (slug, top) => ({ id: slug, tagName: 'H2', top, visible: true, getClientRects() { return this.visible ? [{}] : [] }, getBoundingClientRect() { return { top: this.top } }, cloneNode() { return { textContent: this.id, querySelector: () => ({ remove() {} }) } } })
  let elements = [heading('开始', 400), heading('中文章节', 900)]
  globalThis.window = { addEventListener: (name, callback) => listeners.set(name, callback), removeEventListener: (name, callback) => { if (listeners.get(name) === callback) listeners.delete(name) } }
  globalThis.document = { querySelectorAll: () => elements, querySelector: () => ({ getBoundingClientRect: () => ({ bottom: 52 }) }) }
  globalThis.requestAnimationFrame = callback => { frames.set(++id, callback); return id }
  globalThis.cancelAnimationFrame = id => frames.delete(id)
  const flush = async () => { await nextTick(); for (const [id, callback] of [...frames]) { frames.delete(id); callback() } await nextTick() }
  let app
  try {
    await symlink(resolve(pkg, 'node_modules'), resolve(temporary, 'node_modules'), 'dir')
    const outfile = resolve(temporary, 'outline.mjs')
    await build({ entryPoints: [resolve(pkg, 'src/theme/components/PageOutline.vue')], bundle: true, platform: 'node', format: 'esm', packages: 'external', outfile, plugins: [{ name: 'outline', setup(build) {
      build.onResolve({ filter: /^vitepress$/ }, () => ({ path: 'vitepress', namespace: 'test' }))
      build.onLoad({ filter: /.*/, namespace: 'test' }, () => ({ contents: "export const useData = () => ({ site: { value: { scrollOffset: 134 } } })" }))
      build.onLoad({ filter: /\.vue$/ }, async ({ path }) => ({ contents: compileScript(parse(await readFile(path, 'utf8')).descriptor, { id: path, inlineTemplate: false }).content, loader: 'ts' }))
    } }] })
    const Component = (await import(pathToFileURL(outfile).href)).default
    Component.render = () => null
    const renderer = createRenderer({ createElement: () => ({}), insert() {}, remove() {}, setElementText() {}, createText: () => ({}), createComment: () => ({}), setText() {}, setComment() {}, parentNode: () => null, nextSibling: () => null, patchProp() {} })
    const headers = ref([])
    app = renderer.createApp({ setup: () => () => h(Component, { headers: headers.value, variant: 'inline' }) })
    app.mount({})
    const state = app._instance.subTree.component.setupState
    await flush()
    assert.equal(state.headings.length, 2)
    assert.equal(state.active, '开始')
    elements[0].top = -600; elements[1].top = 134
    listeners.get('scroll')(); await flush()
    assert.equal(state.active, '中文章节', 'jumped chapter uses the same offset as VitePress')
    elements = [heading('新增章节', 100)]
    headers.value = [{ slug: '新增章节', title: '新增章节', level: 2 }]
    await flush(); await flush()
    assert.deepEqual(state.headings.map(heading => heading.slug), ['新增章节'])
    assert.equal(state.active, '新增章节')
    listeners.get('resize')()
    app.unmount(); app = undefined
    assert.equal(listeners.size, 0)
    assert.equal(frames.size, 0)
  } finally {
    app?.unmount()
    globals.forEach((key, i) => { if (original[i] === undefined) delete globalThis[key]; else globalThis[key] = original[i] })
    await rm(temporary, { recursive: true, force: true })
  }
})
