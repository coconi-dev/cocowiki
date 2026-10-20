import { readdir, readFile, writeFile, mkdir, rm } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { root } from './framework.mjs'
const source = resolve(root, 'packages/create-cocowiki/template'), target = resolve(root, 'playground')
const check = process.argv.includes('--check')
async function list(directory) {
  try {
    const entries = await readdir(directory, { withFileTypes: true })
    return (await Promise.all(entries.map(async entry => entry.isDirectory() ? (await list(resolve(directory, entry.name))).map(file => `${entry.name}/${file}`) : [entry.name]))).flat()
  } catch (error) { if (error.code === 'ENOENT') return []; throw error }
}
let differences = []
for (const folder of ['content', 'components', 'data', 'public', 'cocowiki.config.ts']) {
  const sources = folder.endsWith('.ts') ? [''] : await list(resolve(source, folder))
  const targets = folder.endsWith('.ts') ? [''] : await list(resolve(target, folder))
  for (const name of new Set([...sources, ...targets])) {
    if (name.startsWith('demos/')) continue // Playground-only demonstrations.
    const relative = name ? `${folder}/${name}` : folder
    if (!sources.includes(name)) {
      differences.push(relative)
      if (!check) await rm(resolve(target, relative))
      continue
    }
    let expected = await readFile(resolve(source, relative))
    if (/\.(md|ts)$/.test(relative)) expected = Buffer.from(expected.toString().replaceAll('__COCOWIKI_SITE_NAME__', 'CoCoWiki'))
    let current
    try { current = await readFile(resolve(target, relative)) } catch {}
    if (!current?.equals(expected)) {
      differences.push(relative)
      if (!check) { await mkdir(dirname(resolve(target, relative)), { recursive: true }); await writeFile(resolve(target, relative), expected) }
    }
  }
}
if (check && differences.length) { console.error(`示例与模板不同步：\n${differences.join('\n')}\n运行 pnpm sync:examples`); process.exitCode = 1 }
else console.log(check ? '模板与示例一致' : `已同步 ${differences.length} 个示例文件`)
