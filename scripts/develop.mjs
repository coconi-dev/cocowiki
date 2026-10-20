import { spawn } from 'node:child_process'
import { resolve } from 'node:path'
import { bootstrap, context, buildOptions, root } from './framework.mjs'
let child, closing = false, watcher
let queue = Promise.resolve()
async function stop() {
  if (!child || child.exitCode !== null) return
  const previous = child; child = undefined
  await new Promise(resolve => {
    const timer = setTimeout(() => previous.kill('SIGKILL'), 5000)
    previous.once('exit', () => { clearTimeout(timer); resolve() })
    previous.kill('SIGTERM')
  })
}
async function restart() {
  await stop()
  if (closing) return
  child = spawn(process.execPath, [resolve(root, 'packages/cocowiki/bin/cocowiki.mjs'), 'dev', ...process.argv.slice(2).filter(arg => arg !== '--framework')], { cwd: resolve(root, 'playground'), stdio: 'inherit' })
  child.once('error', error => { console.error(error); process.exitCode = 1 })
}
async function close(signal) {
  if (closing) return
  closing = true
  await queue
  await stop()
  await watcher?.dispose()
  process.exitCode = signal === 'SIGINT' ? 130 : 0
}
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => void close(signal))
if (process.argv.includes('--framework')) {
  watcher = await context({ ...buildOptions, plugins: [{ name: 'restart-framework', setup(build) {
    build.onEnd(result => { if (!result.errors.length) queue = queue.then(restart).catch(error => { console.error(error); process.exitCode = 1 }) })
  } }] })
  await watcher.watch()
} else {
  await bootstrap()
  await restart()
}
