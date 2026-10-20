import { readFile } from 'node:fs/promises'

const tag = process.env.RELEASE_TAG || ''
if (!/^v\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(tag)) {
  throw new Error(`不是版本 tag：${tag}，应使用 vX.Y.Z 或 vX.Y.Z-prerelease`)
}
const version = tag.slice(1)
for (const file of ['package.json', 'packages/cocowiki/package.json', 'packages/create-cocowiki/package.json']) {
  const manifest = JSON.parse(await readFile(file, 'utf8'))
  if (manifest.version !== version) throw new Error(`${file} 版本 ${manifest.version} 与 ${tag} 不一致`)
}
const template = JSON.parse(await readFile('packages/create-cocowiki/template/package.json', 'utf8'))
if (template.dependencies.cocowiki !== `^${version}`) throw new Error(`模板 cocowiki 依赖与 ${tag} 不一致`)
console.log(`版本校验通过：${tag}`)
