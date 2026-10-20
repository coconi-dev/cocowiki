import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { mkdtemp, mkdir, readFile, realpath, rm, stat, symlink, writeFile } from 'node:fs/promises'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { dirname, resolve } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const repository = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const cli = resolve(repository, 'packages/cocowiki/bin/cocowiki.mjs')

async function freePort() {
  const socket = createServer()
  socket.listen(0, '127.0.0.1')
  await once(socket, 'listening')
  const { port } = socket.address()
  await new Promise((done) => socket.close(done))
  return port
}

function launch(args, cwd, env = process.env) {
  const process = spawn(globalThis.process.execPath, [cli, ...args], { cwd, env, stdio: ['ignore', 'pipe', 'pipe'] })
  let output = ''
  process.stdout.on('data', (chunk) => { output += chunk })
  process.stderr.on('data', (chunk) => { output += chunk })
  return { process, output: () => output }
}

async function waitForExit(child, timeout = 5000) {
  const exited = once(child, 'exit')
  const timer = setTimeout(() => child.kill('SIGKILL'), timeout)
  try { return await exited } finally { clearTimeout(timer) }
}

async function waitForResponse(url, contains, output) {
  const deadline = Date.now() + 20000
  let last = ''
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(2000) })
      last = await response.text()
      if (response.ok && last.includes(contains)) return last
    } catch (error) { last = error.message }
    await delay(100)
  }
  assert.fail(`Timed out waiting for ${url} to contain ${contains}\n${last.slice(0, 1500)}\n${output()}`)
}

async function waitForOutput(output, pattern, start = 0) {
  const deadline = Date.now() + 10000
  while (Date.now() < deadline) {
    if (pattern.test(output().slice(start))) return
    await delay(50)
  }
  assert.fail(`Missing log ${pattern}: ${output().slice(start)}`)
}

const configSource = (title, content = 'content') => `export default ${JSON.stringify({
  title,
  directories: { content },
  markdown: { spoiler: true, wikiLink: true }
})}\n`
const documentSource = (marker) => `---\ntitle: Welcome\n---\n\n# Welcome\n\n\`\`\`ts\nconst message = '${marker}'\n\`\`\`\n`

test('dev recreates Markdown renderers and stays usable during builds', { timeout: 120000 }, async (t) => {
  const fixture = await mkdtemp(resolve(tmpdir(), 'cocowiki-lifecycle-'))
  let dev
  t.after(async () => {
    if (dev?.process.exitCode === null) {
      const exited = once(dev.process, 'exit')
      dev.process.kill('SIGTERM')
      await exited
    }
    await rm(fixture, { recursive: true, force: true })
  })
  await symlink(resolve(repository, 'playground/node_modules'), resolve(fixture, 'node_modules'), 'dir')
  await mkdir(resolve(fixture, 'content'))
  await writeFile(resolve(fixture, 'content/index.md'), '# Home\n')
  await writeFile(resolve(fixture, 'content/welcome.md'), documentSource('INITIAL_MARKER'))
  const configFile = resolve(fixture, 'cocowiki.config.ts')
  await writeFile(configFile, configSource('Lifecycle initial'))
  const port = await freePort()
  const origin = `http://127.0.0.1:${port}`
  dev = launch(['dev', '--host', '127.0.0.1', '--port', String(port)], fixture)
  const page = () => waitForResponse(`${origin}/welcome.md?import`, 'INITIAL_MARKER', dev.output)
  const rendered = await page()
  assert.match(rendered, /language-ts/)

  // Repeating dev reuses the verified instance and exits successfully without
  // touching the active runtime, even when a different port was requested.
  const generatedConfig = resolve(fixture, '.cocowiki/site/.vitepress/config.mts')
  const beforeDuplicate = (await stat(generatedConfig)).mtimeMs
  const duplicate = launch(['dev', '--host', '127.0.0.1', '--port', String(await freePort())], fixture)
  const [duplicateCode] = await waitForExit(duplicate.process)
  assert.equal(duplicateCode, 0, duplicate.output())
  assert.match(duplicate.output(), /开发服务已在运行/)
  assert.ok(duplicate.output().includes(origin), duplicate.output())
  assert.doesNotMatch(duplicate.output(), /ELIFECYCLE/)
  assert.equal((await stat(generatedConfig)).mtimeMs, beforeDuplicate)
  await page()

  for (let index = 1; index <= 3; index += 1) {
    const title = `Lifecycle restart ${index}`
    await writeFile(configFile, configSource(title))
    await waitForResponse(`${origin}/@siteData`, title, dev.output)
    await page()
    assert.equal((await stat(generatedConfig)).mtimeMs, beforeDuplicate)
    // A subsequent Markdown edit must use the new highlighter as well.
    const marker = `EDIT_MARKER_${index}`
    await writeFile(resolve(fixture, 'content/welcome.md'), documentSource(marker))
    await waitForResponse(`${origin}/welcome.md?import`, marker, dev.output)
    await writeFile(resolve(fixture, 'content/welcome.md'), documentSource('INITIAL_MARKER'))
    await page()
  }

  // Invalid edits must leave the last valid renderer and process alive, and
  // fixing the file must recover automatically without restarting the CLI.
  for (const [repairIndex, [source, expected]] of [
    ['export default {}\n', /配置文件必须提供 title/],
    ['export default {\n', /Unexpected|Expected|Transform failed/]
  ].entries()) {
    const logStart = dev.output().length
    await writeFile(configFile, source)
    await waitForOutput(dev.output, expected, logStart)
    await page()
    await writeFile(configFile, configSource(`Lifecycle recovered ${repairIndex}`))
    await waitForResponse(`${origin}/@siteData`, `Lifecycle recovered ${repairIndex}`, dev.output)
    await page()
  }

  await mkdir(resolve(fixture, 'notes'))
  await writeFile(resolve(fixture, 'notes/index.md'), '# New home\n')
  await writeFile(resolve(fixture, 'notes/welcome.md'), documentSource('MOVED_MARKER'))
  await writeFile(configFile, configSource('Lifecycle moved', 'notes'))
  await waitForResponse(`${origin}/@siteData`, 'Lifecycle moved', dev.output)
  await waitForResponse(`${origin}/welcome.md?import`, 'MOVED_MARKER', dev.output)
  await writeFile(resolve(fixture, 'notes/welcome.md'), documentSource('WATCHER_MARKER'))
  await waitForResponse(`${origin}/welcome.md?import`, 'WATCHER_MARKER', dev.output)

  const build = launch(['build'], fixture)
  const completed = once(build.process, 'exit')
  let building = true
  completed.then(() => { building = false })
  while (building) {
    await waitForResponse(`${origin}/welcome.md?import`, 'WATCHER_MARKER', dev.output)
    await delay(100)
  }
  const [exitCode] = await completed
  assert.equal(exitCode, 0, build.output())
  assert.match(await readFile(resolve(fixture, '.cocowiki/site/welcome.md'), 'utf8'), /WATCHER_MARKER/)
  assert.match(await readFile(resolve(fixture, '.cocowiki/build/welcome.md'), 'utf8'), /WATCHER_MARKER/)
  assert.match(await readFile(resolve(fixture, 'dist/welcome.html'), 'utf8'), /WATCHER_MARKER/)
  await waitForResponse(`${origin}/welcome.md?import`, 'WATCHER_MARKER', dev.output)
  // Three normal edits, two repairs and one directory switch must result in
  // six replacements, with no extra restart from generated-file events.
  await delay(800)
  assert.equal((dev.output().match(/配置已更新，开发服务已重建/g) || []).length, 6, dev.output())
  assert.doesNotMatch(dev.output(), /Shiki instance has been disposed|Internal server error|trying another one/)

  const stopped = once(dev.process, 'exit')
  dev.process.kill('SIGINT')
  await stopped
  await assert.rejects(readFile(resolve(fixture, '.cocowiki/dev.lock')), { code: 'ENOENT' })

  // Immediate relaunch after Ctrl+C uses the same port; a hard crash is also
  // recoverable without manual lock deletion or process cleanup.
  dev = launch(['dev', '--host', '127.0.0.1', '--port', String(port)], fixture)
  await waitForResponse(`${origin}/welcome.md?import`, 'WATCHER_MARKER', dev.output)
  const crashed = once(dev.process, 'exit')
  dev.process.kill('SIGKILL')
  await crashed
  dev = launch(['dev', '--host', '127.0.0.1', '--port', String(port)], fixture)
  await waitForResponse(`${origin}/welcome.md?import`, 'WATCHER_MARKER', dev.output)
  const recovered = once(dev.process, 'exit')
  dev.process.kill('SIGTERM')
  await recovered

  // Recover locks left by a crashed process, but refuse an occupied port
  // instead of silently starting another server on the next port.
  const exitedOwner = spawn(globalThis.process.execPath, ['-e', ''], { stdio: 'ignore' })
  await once(exitedOwner, 'exit')
  await writeFile(resolve(fixture, '.cocowiki/dev.lock'), JSON.stringify({ pid: exitedOwner.pid }))
  const blocker = createServer()
  blocker.listen(port, '127.0.0.1')
  await once(blocker, 'listening')
  try {
    const collision = launch(['dev', '--host', '127.0.0.1', '--port', String(port)], fixture)
    const [collisionCode] = await waitForExit(collision.process)
    assert.equal(collisionCode, 1, collision.output())
    assert.match(collision.output(), /already in use/)
    assert.doesNotMatch(collision.output(), /trying another one/)
    await assert.rejects(readFile(resolve(fixture, '.cocowiki/dev.lock')), { code: 'ENOENT' })
  } finally {
    await new Promise((done) => blocker.close(done))
  }
})

// Exercise the actual nested package-manager command used from the repo root,
// including terminal-style Ctrl+C delivery to its process group.
test('pnpm dev owns its terminal lifecycle and repeated invocation succeeds', {
  timeout: 60000,
  skip: process.platform === 'win32'
}, async (t) => {
  const workspace = await mkdtemp(resolve(tmpdir(), 'cocowiki-terminal-'))
  const site = resolve(workspace, 'site')
  const children = []
  t.after(async () => {
    for (const child of children) {
      try { process.kill(-child.pid, 'SIGTERM') } catch (error) { if (error.code !== 'ESRCH') throw error }
      if (child.exitCode === null && child.signalCode === null) await waitForExit(child)
    }
    await rm(workspace, { recursive: true, force: true })
  })
  await mkdir(resolve(site, 'content'), { recursive: true })
  await symlink(resolve(repository, 'playground/node_modules'), resolve(site, 'node_modules'), 'dir')
  await writeFile(resolve(workspace, 'package.json'), JSON.stringify({ private: true, scripts: { dev: 'pnpm --dir site dev' } }))
  await writeFile(resolve(site, 'package.json'), JSON.stringify({ private: true, type: 'module', scripts: { dev: 'cocowiki dev' } }))
  await writeFile(resolve(site, 'cocowiki.config.ts'), configSource('Terminal lifecycle'))
  await writeFile(resolve(site, 'content/index.md'), documentSource('TERMINAL_MARKER'))
  const port = await freePort()
  const origin = `http://localhost:${port}`
  const run = () => {
    const child = spawn('pnpm', ['dev', '--port', String(port)], {
      cwd: workspace, detached: true, stdio: ['ignore', 'pipe', 'pipe']
    })
    children.push(child)
    let log = ''
    child.stdout.on('data', (chunk) => { log += chunk })
    child.stderr.on('data', (chunk) => { log += chunk })
    return { child, output: () => log }
  }
  const first = run()
  await waitForResponse(`${origin}/index.md?import`, 'TERMINAL_MARKER', first.output)
  const duplicate = run()
  const [code] = await waitForExit(duplicate.child)
  assert.equal(code, 0, duplicate.output())
  assert.match(duplicate.output(), /开发服务已在运行/)
  assert.doesNotMatch(duplicate.output(), /ELIFECYCLE/)

  const firstExit = once(first.child, 'exit')
  process.kill(-first.child.pid, 'SIGINT')
  await firstExit
  const second = run()
  await waitForResponse(`${origin}/index.md?import`, 'TERMINAL_MARKER', second.output)
  assert.doesNotMatch(second.output(), /trying another one|Shiki instance has been disposed/)
  const secondExit = once(second.child, 'exit')
  process.kill(-second.child.pid, 'SIGINT')
  await secondExit
  await assert.rejects(readFile(resolve(site, '.cocowiki/dev.lock')), { code: 'ENOENT' })
  const socket = createServer()
  socket.listen(port, 'localhost')
  await once(socket, 'listening')
  await new Promise((done) => socket.close(done))
})

test('invalid replacement configs recover; source snapshot drives Vue discovery and Wiki links', { timeout: 90000 }, async (t) => {
  const fixture = await mkdtemp(resolve(tmpdir(), 'cocowiki-recovery-'))
  let dev
  t.after(async () => {
    if (dev?.process.exitCode === null) { const exited = once(dev.process, 'exit'); dev.process.kill('SIGTERM'); await exited }
    await rm(fixture, { recursive: true, force: true })
  })
  await symlink(resolve(repository, 'playground/node_modules'), resolve(fixture, 'node_modules'), 'dir')
  await mkdir(resolve(fixture, 'content'))
  await mkdir(resolve(fixture, 'components'))
  await mkdir(resolve(fixture, 'snippets'))
  await writeFile(resolve(fixture, 'components/Chart.vue'), '<template><p>SOURCE_IMPORT_MARKER</p></template>')
  await writeFile(resolve(fixture, 'snippets/part.md'), 'SOURCE_INCLUDE_MARKER\n')
  await writeFile(resolve(fixture, 'content/index.md'), '# Home\n')
  await writeFile(resolve(fixture, 'content/ref.md'), '---\ntitle: Reference\nupdated: 2024-01-02T12:00:00Z\n---\n[[Alias]]\n<script setup>\nimport Chart from "../components/Chart.vue"\n</script>\n<Chart />\n<!-- @include: ../snippets/part.md -->\n')
  await writeFile(resolve(fixture, 'content/target.md'), '---\ntitle: Target\naliases: [Alias]\n---\n')
  const configFile = resolve(fixture, 'cocowiki.config.ts')
  const valid = { title: 'Recovery', base: '/wiki/', search: { exclude: ['hidden/**'] } }
  const configure = config => writeFile(configFile, `export default ${JSON.stringify(config)}\n`)
  await configure(valid)
  const port = await freePort()
  const origin = `http://127.0.0.1:${port}/wiki`
  dev = launch(['dev', '--host', '127.0.0.1', '--port', String(port)], fixture)
  await waitForResponse(`${origin}/ref.md?import`, '/wiki/target', dev.output)
  await waitForResponse(`${origin}/ref.md?import`, 'SOURCE_INCLUDE_MARKER', dev.output)
  for (const [theme, pattern] of [
    [{ entry: 'theme/missing.ts' }, /theme.entry/],
    [{ styles: 'theme/missing.css' }, /theme.styles/],
    [{ components: { Invalid: 'unknown.vue' } }, /未知主题组件/]
  ]) {
    const start = dev.output().length
    await configure({ ...valid, theme })
    await waitForOutput(dev.output, pattern, start)
    await waitForResponse(`${origin}/ref.md?import`, '/wiki/target', dev.output)
    await configure({ ...valid, title: `Repaired ${pattern.source}` })
    await waitForResponse(`${origin}/@siteData`, `Repaired ${pattern.source}`, dev.output)
  }
  // Adding the missing file repairs the latest config without another config edit.
  await configure({ ...valid, theme: { styles: 'theme/later.css' } })
  await waitForOutput(dev.output, /later.css/)
  await mkdir(resolve(fixture, 'theme'))
  await writeFile(resolve(fixture, 'theme/later.css'), 'body { --repaired: 1; }')
  await waitForResponse(`${origin}/@siteData`, 'Recovery', dev.output)

  await writeFile(resolve(fixture, 'content/new.page.vue'), '<template>New Vue</template>')
  await waitForResponse(`${origin}/search-index.json`, '"route":"/new"', dev.output)
  await waitForResponse(`${origin}/new.md?import`, 'CocoPage', dev.output)
  await writeFile(resolve(fixture, 'content/new.page.json'), '{"title":"New Vue","aliases":["NewAlias"]}')
  await waitForResponse(`${origin}/search-index.json`, 'NewAlias', dev.output)
  await rm(resolve(fixture, 'content/new.page.vue'))
  await waitForResponse(`${origin}/search-index.json`, '"route":"/target"', dev.output)
  const deadline = Date.now() + 10000
  while (Date.now() < deadline) {
    if (!(await (await fetch(`${origin}/search-index.json`)).text()).includes('"route":"/new"')) break
    await delay(50)
  }
  assert.ok(!(await (await fetch(`${origin}/search-index.json`)).text()).includes('"route":"/new"'))
  // Unchanged referring Markdown must be recompiled when the target alias moves.
  await writeFile(resolve(fixture, 'content/target.md'), '---\ntitle: Target\naliases: [FormerAlias]\n---\n')
  await waitForResponse(`${origin}/ref.md?import`, '/wiki/search?q=Alias', dev.output)
  await writeFile(resolve(fixture, 'content/other.md'), '---\ntitle: Other\naliases: [Alias]\n---\n')
  await waitForResponse(`${origin}/ref.md?import`, '/wiki/other', dev.output)

  const start = dev.output().length
  await writeFile(resolve(fixture, 'content/other.md'), '---\ntitle: Other\ntags: invalid\n---\n')
  await waitForOutput(dev.output, /other.md.*tags/, start)
  assert.ok((await (await fetch(`${origin}/search-index.json`)).text()).includes('"title":"Other"'))
  await writeFile(resolve(fixture, 'content/other.md'), '---\ntitle: Recovered content\naliases: [Alias]\n---\n')
  await waitForResponse(`${origin}/search-index.json`, 'Recovered content', dev.output)
  await writeFile(resolve(fixture, 'content/guide.md'), '---\ntitle: Flat guide\n---\n')
  await mkdir(resolve(fixture, 'content/guide'))
  await writeFile(resolve(fixture, 'content/guide/index.md'), '---\ntitle: Directory guide\n---\n')
  await waitForResponse(`${origin}/search-index.json`, '"route":"/guide/"', dev.output)
  await writeFile(resolve(fixture, 'settings.ts'), 'export const title = "Dependency one"\n')
  await writeFile(configFile, `import { title } from './settings'\nexport default { ...${JSON.stringify(valid)}, title }\n`)
  await waitForResponse(`${origin}/@siteData`, 'Dependency one', dev.output)
  await writeFile(resolve(fixture, 'settings.ts'), 'export const title = "Dependency two"\n')
  await waitForResponse(`${origin}/@siteData`, 'Dependency two', dev.output)
  const built = launch(['build'], fixture)
  const [code] = await waitForExit(built.process, 30000)
  assert.equal(code, 0, built.output())
  const output = await readFile(resolve(fixture, 'dist/ref.html'), 'utf8')
  assert.match(output, /SOURCE_IMPORT_MARKER/)
  assert.match(output, /最后更新：2024\/1\/2/)
  assert.match(output, /SOURCE_INCLUDE_MARKER/)
  assert.match(output, /href="\/wiki\/other"/)
  await readFile(resolve(fixture, 'dist/guide.html'))
  await readFile(resolve(fixture, 'dist/guide/index.html'))
})

test('first invalid config recovers when only an external imported dependency is repaired', { timeout: 30000 }, async (t) => {
  const workspace = await mkdtemp(resolve(tmpdir(), 'cocowiki-external-config-'))
  const site = resolve(workspace, 'site')
  const shared = resolve(workspace, 'shared')
  let dev
  t.after(async () => {
    if (dev?.process.exitCode === null) { const exited = once(dev.process, 'exit'); dev.process.kill('SIGTERM'); await exited }
    await rm(workspace, { recursive: true, force: true })
  })
  await mkdir(resolve(site, 'content'), { recursive: true })
  await mkdir(shared)
  await symlink(resolve(repository, 'playground/node_modules'), resolve(site, 'node_modules'), 'dir')
  await writeFile(resolve(site, 'content/index.md'), '# Home\n')
  await writeFile(resolve(site, 'cocowiki.config.ts'), "export { default } from '../shared/config'\n")
  const dependency = resolve(shared, 'config.ts')
  await writeFile(dependency, 'export default { title: "" }\n')
  const port = await freePort()
  dev = launch(['dev', '--host', '127.0.0.1', '--port', String(port)], site)
  await waitForOutput(dev.output, /配置文件必须提供 title/)
  assert.equal(dev.process.exitCode, null)
  await writeFile(dependency, 'export default { title: "External repair" }\n')
  await waitForResponse(`http://127.0.0.1:${port}/@siteData`, 'External repair', dev.output)
  await writeFile(dependency, 'export default { title: "External edit" }\n')
  await waitForResponse(`http://127.0.0.1:${port}/@siteData`, 'External edit', dev.output)
})

test('component/data edits avoid Git queries and body edits reuse committed dates', { timeout: 30000 }, async (t) => {
  const workspace = await mkdtemp(resolve(tmpdir(), 'cocowiki-incremental-'))
  const site = resolve(workspace, 'site'), tools = resolve(workspace, 'tools'), trace = resolve(workspace, 'git-queries.log')
  let dev
  t.after(async () => {
    if (dev?.process.exitCode === null) { const exited = once(dev.process, 'exit'); dev.process.kill('SIGTERM'); await exited }
    await rm(workspace, { recursive: true, force: true })
  })
  for (const dir of ['content', 'components', 'data']) await mkdir(resolve(site, dir), { recursive: true })
  await mkdir(tools)
  const fakeGit = `#!/usr/bin/env node
const fs = require('node:fs')
fs.appendFileSync(${JSON.stringify(trace)}, process.argv.slice(2).join(' ') + '\\n')
if (process.argv[2] === 'rev-parse') process.stdout.write('fixture-head\\n')
else if (process.argv[2] === 'log') process.stdout.write('1704153600\\n')
else process.exitCode = 1
`
  await writeFile(resolve(tools, 'git'), fakeGit, { mode: 0o755 })
  await symlink(resolve(repository, 'playground/node_modules'), resolve(site, 'node_modules'), 'dir')
  await writeFile(resolve(site, 'cocowiki.config.ts'), configSource('Incremental'))
  await writeFile(resolve(site, 'content/index.md'), '# Home\n')
  await writeFile(resolve(site, 'content/intro.md'), documentSource('BEFORE_EDIT'))
  await writeFile(resolve(site, 'components/Chart.vue'), '<template>BEFORE_COMPONENT</template>')
  await writeFile(resolve(site, 'data/items.json'), '[]')
  const port = await freePort(), origin = `http://127.0.0.1:${port}`
  dev = launch(['dev', '--host', '127.0.0.1', '--port', String(port)], site, { ...process.env, PATH: `${tools}:${process.env.PATH}` })
  await waitForResponse(`${origin}/intro.md?import`, 'BEFORE_EDIT', dev.output)
  const queries = async () => (await readFile(trace, 'utf8')).trim().split('\n')
  const before = await queries()
  assert.equal(before.filter(line => line.startsWith('log ')).length, 2)
  await writeFile(resolve(site, 'components/Chart.vue'), '<template>AFTER_COMPONENT</template>')
  await waitForResponse(`${origin}/@fs${await realpath(resolve(site, 'components/Chart.vue'))}`, 'AFTER_COMPONENT', dev.output)
  await delay(300)
  assert.deepEqual(await queries(), before, 'component changes must reuse the published content snapshot')
  await writeFile(resolve(site, 'data/items.json'), '[{"name":"changed"}]')
  await delay(300)
  assert.deepEqual(await queries(), before, 'data changes must not scan Git history')
  await writeFile(resolve(site, 'content/intro.md'), documentSource('AFTER_EDIT'))
  await waitForResponse(`${origin}/intro.md?import`, 'AFTER_EDIT', dev.output)
  const edited = await queries()
  assert.equal(edited.filter(line => line.startsWith('log ')).length, 2)
  assert.ok(edited.filter(line => line.startsWith('rev-parse ')).length > before.filter(line => line.startsWith('rev-parse ')).length)
  // A Git event explicitly invalidates dates even when HEAD text is unchanged.
  await mkdir(resolve(site, '.git'))
  await writeFile(resolve(site, '.git/HEAD'), 'ref: refs/heads/main\n')
  const deadline = Date.now() + 5000
  while (Date.now() < deadline && (await queries()).filter(line => line.startsWith('log ')).length < 4) await delay(50)
  assert.equal((await queries()).filter(line => line.startsWith('log ')).length, 4)
})
