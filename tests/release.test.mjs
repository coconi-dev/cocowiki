import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const script = fileURLToPath(new URL('../.github/scripts/validate-release.mjs', import.meta.url))
test('release requires matching versions in both packages and template', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'cocowiki-release-'))
  try {
    for (const file of ['package.json', 'packages/cocowiki/package.json', 'packages/create-cocowiki/package.json', 'packages/create-cocowiki/template/package.json']) {
      await mkdir(path.dirname(path.join(root, file)), { recursive: true })
      await writeFile(path.join(root, file), JSON.stringify({ version: '1.2.3', dependencies: { cocowiki: '^1.2.3' } }))
    }
    const run = tag => spawnSync(process.execPath, [script], { cwd: root, env: { ...process.env, RELEASE_TAG: tag }, encoding: 'utf8' })
    assert.equal(run('v1.2.3').status, 0)
    assert.notEqual(run('v1.2.4').status, 0)
    assert.notEqual(run('latest').status, 0)
    await writeFile(path.join(root, 'packages/create-cocowiki/package.json'), JSON.stringify({ version: '1.2.2' }))
    assert.match(run('v1.2.3').stderr, /create-cocowiki/)
    await writeFile(path.join(root, 'packages/create-cocowiki/package.json'), JSON.stringify({ version: '1.2.3' }))
    await writeFile(path.join(root, 'packages/create-cocowiki/template/package.json'), JSON.stringify({ dependencies: { cocowiki: '^1.2.2' } }))
    assert.match(run('v1.2.3').stderr, /模板/)
  } finally { await rm(root, { recursive: true, force: true }) }
})
