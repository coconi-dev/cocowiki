import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdtemp, mkdir, writeFile, symlink, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createServer } from 'node:net'
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const { DevSession } = await import(pathToFileURL(resolve(root, 'packages/cocowiki/dist/node/cli.js')).href)
async function freePort() { const server = createServer(); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); const port = server.address().port; await new Promise(resolve => server.close(resolve)); return port }
test('DevSession can close and start another project without exiting or retaining snapshots', { timeout: 30000 }, async () => {
  const temporary = await mkdtemp(resolve(tmpdir(), 'cocowiki-session-'))
  const sessions = []
  try {
    for (const name of ['first', 'second']) {
      const site = resolve(temporary, name); await mkdir(resolve(site, 'content'), { recursive: true })
      await symlink(resolve(root, 'playground/node_modules'), resolve(site, 'node_modules'), 'dir')
      await writeFile(resolve(site, 'cocowiki.config.ts'), `export default { title: '${name}' }`)
      await writeFile(resolve(site, 'content/index.md'), '# Initial\n')
      const port = await freePort(), errors = []
      const session = new DevSession(site, { host: '127.0.0.1', port }, { info() {}, error(value) { errors.push(String(value)) } })
      sessions.push(session)
      assert.equal(await session.start(), true); assert.equal(session.state, 'running')
      assert.ok(globalThis[Symbol.for('cocowiki.snapshots')].has(resolve(site, '.cocowiki/site')))
      await writeFile(resolve(site, 'content/index.md'), '# Changed\n')
      await session.update({ files: new Set([resolve(site, 'content/index.md')]) })
      for (const path of ['/', '/index.md?import']) {
        const response = await fetch(`http://127.0.0.1:${port}${path}`, { signal: AbortSignal.timeout(5000) })
        assert.equal(response.status, 200)
        const body = await response.text(); if (path.includes('import')) assert.match(body, /Changed/)
      }
      await session.close(); await session.close()
      assert.equal(session.state, 'stopped')
      assert.ok(!globalThis[Symbol.for('cocowiki.snapshots')].has(resolve(site, '.cocowiki/site')))
      await assert.rejects(session.start(), /已经关闭/)
      assert.deepEqual(errors, [])
    }
  } finally { await Promise.all(sessions.map(session => session.close())); await rm(temporary, { recursive: true, force: true }) }
})
