#!/usr/bin/env node
import { cp, mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises'
import { basename, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const targetArgument = process.argv.slice(2).find((argument) => !argument.startsWith('-')) || 'cocowiki-site'
const targetDirectory = resolve(process.cwd(), targetArgument)
const templateDirectory = fileURLToPath(new URL('../template', import.meta.url))
const siteName = basename(targetDirectory)

function fail(message) {
  console.error(`\ncreate-cocowiki: ${message}\n`)
  process.exit(1)
}

try {
  await mkdir(targetDirectory, { recursive: true })
  const existing = await readdir(targetDirectory)
  if (existing.length) fail(`目标目录不为空：${targetDirectory}`)

  await cp(templateDirectory, targetDirectory, { recursive: true })
  await rename(resolve(targetDirectory, '_gitignore'), resolve(targetDirectory, '.gitignore'))

  const packageFile = resolve(targetDirectory, 'package.json')
  const packageJson = JSON.parse(await readFile(packageFile, 'utf8'))
  packageJson.name = siteName.toLocaleLowerCase().replace(/[^a-z0-9._-]+/g, '-') || 'cocowiki-site'
  await writeFile(packageFile, `${JSON.stringify(packageJson, null, 2)}\n`)

  for (const relativeFile of ['cocowiki.config.ts', 'content/index.md']) {
    const filename = resolve(targetDirectory, relativeFile)
    const source = await readFile(filename, 'utf8')
    await writeFile(filename, source.replaceAll('__COCOWIKI_SITE_NAME__', siteName))
  }

  console.log(`\nCoCoWiki 已创建：${targetDirectory}\n`)
  console.log(`  cd ${targetArgument}`)
  console.log('  pnpm install')
  console.log('  pnpm dev\n')
} catch (error) {
  fail(error instanceof Error ? error.message : String(error))
}
