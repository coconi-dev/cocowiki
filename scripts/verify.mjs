import { spawnSync } from 'node:child_process'
import { readdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { bootstrap, framework, root } from './framework.mjs'
function run(args, cwd = root) {
  const result = spawnSync(process.execPath, args, { cwd, stdio: 'inherit' })
  if (result.error) throw result.error
  if (result.status !== 0) process.exit(result.status || 1)
}
await bootstrap()
run([resolve(root, 'scripts/sync-examples.mjs'), '--check'])
run([resolve(framework, 'node_modules/vue-tsc/bin/vue-tsc.js'), '--noEmit', '-p', resolve(framework, 'tsconfig.json')])
run(['--test', ...(await readdir(resolve(root, 'tests'))).filter(file => file.endsWith('.test.mjs')).sort().map(file => resolve(root, 'tests', file))])
for (const command of ['check', 'build']) run([resolve(framework, 'bin/cocowiki.mjs'), command], resolve(root, 'playground'))
