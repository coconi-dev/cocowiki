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
const MiniSearch = require('minisearch')

test('evaluate Chinese multi-keyword retrieval against real documentation and example entries', async t => {
  const temporary = await mkdtemp(resolve(tmpdir(), 'cocowiki-search-evaluation-'))
  try {
    await symlink(resolve(pkg, 'node_modules'), resolve(temporary, 'node_modules'), 'dir')
    const outfile = resolve(temporary, 'search.mjs')
    await build({ stdin: { contents: `export * from './src/node/content'; export * from './src/theme/search'`, resolveDir: pkg }, bundle: true, platform: 'node', format: 'esm', packages: 'external', outfile })
    const api = await import(pathToFileURL(outfile).href)
    const corpus = JSON.parse(await readFile(resolve(root, 'tests/fixtures/search-documents.json'), 'utf8'))
    const records = [...corpus.records, ...await api.scanContent(resolve(root, 'playground/content'))]
      .filter(page => page.search !== false && !['home', 'search', 'archive', 'contributors'].includes(page.layout || ''))
    const baseline = new MiniSearch({
      fields: ['title', 'aliases', 'tags', 'contributors', 'description', 'content'], storeFields: ['route', 'title'],
      searchOptions: { boost: { title: 4, aliases: 3, contributors: 2.5, tags: 2, description: 1.5 }, prefix: true, fuzzy: 0.16 },
      tokenize(text) {
        const normalized = text.toLocaleLowerCase().trim()
        const words = normalized.match(/[a-z0-9]+|[\u3400-\u9fff]/g) || []
        const chinese = [...normalized.replace(/[^\u3400-\u9fff]/g, '')]
        return [...new Set([...words, ...chinese.slice(0, -1).map((char, i) => char + chinese[i + 1])])]
      }
    })
    baseline.addAll(records.map(page => ({ ...page, aliases: page.aliases?.join(' '), tags: page.tags?.join(' '), contributors: page.contributors?.join(' ') })))
    const improved = api.createSearch(records)
    const cases = [
      ['内容 路由', '/manual/reference/cli'], ['配置 主题', '/manual/config/layout-and-theme'], ['贡献 登记', '/manual/features/contributors'],
      ['开发 服务', '/manual/reference/cli'], ['Vue 图鉴', '/atlas'], ['页面 阅读顺序', ['/welcome', '/manual/content/frontmatter', '/manual/config/layout-and-theme']],
      ['源文件 更新时间', ['/manual/content/frontmatter']], ['皙折 图鉴', '/atlas'], ['分类 标签', ['/manual/features/search-and-archive']]
      , ['贡献者 署名', '/manual/features/contributors'], ['Wiki 别名', '/manual/content/markdown'], ['Vue 静态数据', '/manual/content/vue-components']
    ]
    let oldHits = 0, newHits = 0
    for (const [query, expected] of cases) {
      const relevant = Array.isArray(expected) ? expected : [expected]
      const old = baseline.search(query, { combineWith: 'AND' }).slice(0, 5).some(result => relevant.includes(result.route))
      const current = api.searchDocuments(improved, query).slice(0, 5).some(result => relevant.includes(result.route))
      oldHits += Number(old); newHits += Number(current)
      assert.ok(current, `${query} must find ${expected} in top 5`)
    }
    assert.ok(newHits > oldHits)
    assert.ok(!api.tokenize('北境 城市').includes('境城'), 'never invent bigrams across word boundaries')
    assert.ok(api.tokenize('𠮷野').includes('𠮷野'), 'support supplementary Han characters')
    assert.deepEqual(api.searchDocuments(improved, '不存在的独立词条XYZ'), [])
    const unsafe = '<script>alert("x")</script> 北境城市'
    const parts = api.highlightParts(unsafe, '北境 城市 <script>')
    assert.equal(parts.map(part => part.text).join(''), unsafe)
    assert.ok(parts.some(part => part.match && part.text === '北境'))
    const snippet = api.searchSnippet({ title: '北城', content: '前言'.repeat(150) + '北境 城市的城墙' }, '北境 城市')
    assert.ok(snippet.includes('北境') && snippet.includes('城市') && snippet.startsWith('…'))
    t.diagnostic(`real corpus: ${records.length} entries; recall@5 baseline=${oldHits}/${cases.length}, improved=${newHits}/${cases.length}`)
  } finally { await rm(temporary, { recursive: true, force: true }) }
})
