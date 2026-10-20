import fg from 'fast-glob'
import matter from 'gray-matter'
import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { basename, dirname, relative, resolve, sep } from 'node:path'
import type { CocoWikiConfig } from '../config'
import type { ContentPage } from '../shared/content'
import { resolveProjectPaths, runtimePath, type RuntimeMode } from './project'
import { validateContributors } from './validation'
import { snapshots } from './snapshot'

function raise(message: string): never { throw new Error(message) }
function pathForImport(from: string, target: string) {
  const path = relative(from, target).split(sep).join('/')
  return path.startsWith('.') ? path : `./${path}`
}
function componentName(filename: string) {
  return basename(filename, '.vue').split(/[-_.\s]+/).filter(Boolean).map(part => part.charAt(0).toUpperCase() + part.slice(1)).join('')
}
export async function writeIfChanged(filename: string, content: string) {
  try { if (await readFile(filename, 'utf8') === content) return } catch {}
  await mkdir(dirname(filename), { recursive: true })
  await writeFile(filename, content)
}

/** Resolve relative imports against their authored location, including external includes. */
export function rebaseMarkdown(source: string, sourceFile: string, generatedFile: string) {
  const rebase = (path: string) => pathForImport(dirname(generatedFile), resolve(dirname(sourceFile), path))
  // Only script blocks contain module imports; code examples remain untouched.
  const examples: string[] = []
  source = source.replace(/^([ \t]*)(`{3,}|~{3,})[^\n]*\n[\s\S]*?^\1\2[ \t]*$/gm, block => `\u0000CW_EXAMPLE_${examples.push(block) - 1}\u0000`)
  source = source.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, script => script
    .replace(/((?:from\s*|import\s*\(\s*|import\s*)['"])(\.{1,2}\/[^'"\n]+)(['"])/g,
      (_all, before, path, after) => before + rebase(path) + after))
  source = source.replace(/<!--\s*@include:\s*([^\s]+?)\s*-->/g, (_all, path: string) => {
    const match = path.match(/^(.*?)(#[\w-]+|\{[\d,]*\})?$/)!
    const target = match[1].startsWith('@') ? match[1] : rebase(match[1])
    if (!match[1].startsWith('@') && !existsSync(resolve(dirname(sourceFile), match[1]))) raise(`${sourceFile} [include]: 文件不存在：${match[1]}`)
    return `<!-- @include: ${target}${match[2] || ''} -->`
  })
  return source.replace(/\u0000CW_EXAMPLE_(\d+)\u0000/g, (_all, index) => examples[Number(index)])
}

export async function prepareRuntime(projectRoot: string, config: CocoWikiConfig, mode: RuntimeMode, pages: ContentPage[]) {
  const paths = resolveProjectPaths(projectRoot, config, runtimePath(projectRoot, mode))
  const configDirectory = resolve(paths.runtimeRoot, '.vitepress')
  const themeDirectory = resolve(configDirectory, 'theme')
  // Stage every source read/transform before changing the last valid runtime.
  const files = await fg('**/*', { cwd: paths.contentDir, onlyFiles: true, dot: true, ignore: ['**/*.page.json', '**/*.page.vue'] })
  const wikiVersion = createHash('sha256').update(JSON.stringify(pages.map(page => [page.route, page.title, page.aliases]))).digest('hex')
  const pageByPath = new Map(pages.map(page => [page.generatedPath, page]))
  const outputs = new Map<string, string | Buffer>()
  for (const file of files) {
    if (file.startsWith('.vitepress/')) raise(`${file} [path]: .vitepress 是保留目录`)
    const sourceFile = resolve(paths.contentDir, file)
    const page = pageByPath.get(file)
    if (page) {
      const parsed = matter(page.sourceContent)
      const normalized = matter.stringify(parsed.content, { ...page.frontmatter, title: page.title })
      outputs.set(file, rebaseMarkdown(normalized, sourceFile, resolve(paths.runtimeRoot, file)) + `\n<!-- cocowiki-links:${wikiVersion} -->\n`)
    } else outputs.set(file, await readFile(sourceFile))
  }
  for (const page of pages.filter(page => page.kind === 'vue')) {
    const frontmatter = { ...page.frontmatter, title: page.title, layout: 'special' }
    const yaml = Object.entries(frontmatter).map(([key, value]) => `${JSON.stringify(key)}: ${JSON.stringify(value)}`).join('\n')
    outputs.set(page.generatedPath, `---\n${yaml}\n---\n\n<script setup lang="ts">\nimport CocoPage from ${JSON.stringify(pathForImport(dirname(resolve(paths.runtimeRoot, page.generatedPath)), page.sourcePath))}\n</script>\n\n<CocoPage />\n`)
  }
  await mkdir(themeDirectory, { recursive: true })
  const selectedTheme = config.theme?.entry
    ? pathForImport(themeDirectory, resolve(projectRoot, config.theme.entry))
    : 'cocowiki/theme'
  const configuredStyles = config.theme?.styles
  const themeStyles = (Array.isArray(configuredStyles) ? configuredStyles : configuredStyles ? [configuredStyles] : [])
    .map((style) => `import ${JSON.stringify(pathForImport(themeDirectory, resolve(projectRoot, style)))}`)
  const componentEntries = Object.entries(config.theme?.components || {})
  const globalComponentFiles = existsSync(paths.componentsDir)
    ? await fg('**/*.vue', { cwd: paths.componentsDir, onlyFiles: true })
    : []
  const componentNames = new Map<string, string>()
  for (const file of globalComponentFiles) {
    const name = componentName(file)
    if (!name) raise(`无法从组件文件名生成全局名称：${file}`)
    const duplicate = componentNames.get(name)
    if (duplicate) raise(`全局组件名称冲突：${duplicate} 与 ${file} 都会注册为 ${name}。`)
    componentNames.set(name, file)
  }
  const overrideDeclarations = componentEntries.map(([name, entry], index) => {
    const source = pathForImport(themeDirectory, resolve(projectRoot, entry))
    return `const ThemeComponent${index} = defineAsyncComponent(() => import(${JSON.stringify(source)}))`
  })
  const overrides = componentEntries.map(([name], index) => `${JSON.stringify(name)}: ThemeComponent${index}`).join(', ')
  const componentsPattern = `${pathForImport(themeDirectory, paths.componentsDir)}/**/*.vue`
  await writeIfChanged(resolve(themeDirectory, 'index.ts'), `import { defineAsyncComponent } from 'vue'\nimport baseTheme from ${JSON.stringify(selectedTheme)}\nimport { cocoWikiThemeComponentsKey } from 'cocowiki/theme/customization'\n${themeStyles.join('\n')}\nconst modules = import.meta.glob(${JSON.stringify(componentsPattern)})\n${overrideDeclarations.join('\n')}\nconst themeComponentOverrides = { ${overrides} }\nfunction componentName(path) {\n  const stem = path.split('/').pop()?.replace(/\\.vue$/, '') || ''\n  return stem.split(/[-_.\\s]+/).filter(Boolean).map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join('')\n}\nexport default {\n  ...baseTheme,\n  enhanceApp(context) {\n    baseTheme.enhanceApp?.(context)\n    context.app.provide(cocoWikiThemeComponentsKey, themeComponentOverrides)\n    for (const [path, loader] of Object.entries(modules)) {\n      const name = componentName(path)\n      if (name) context.app.component(name, defineAsyncComponent(loader))\n    }\n  }\n}\n`)

  const manifestFile = resolve(paths.runtimeRoot, '.vitepress/manifest.json')
  let previous: string[] = []
  try { previous = JSON.parse(await readFile(manifestFile, 'utf8')).files } catch {
    previous = await fg('**/*', { cwd: paths.runtimeRoot, onlyFiles: true, dot: true, ignore: ['.vitepress/**'] })
  }
  for (const [path, content] of outputs) {
    const destination = resolve(paths.runtimeRoot, path)
    if (typeof content === 'string') await writeIfChanged(destination, content)
    else {
      let unchanged = false
      try { unchanged = content.equals(await readFile(destination)) } catch {}
      if (!unchanged) { await mkdir(dirname(destination), { recursive: true }); await writeFile(destination, content) }
    }
  }
  for (const path of previous) if (!outputs.has(path)) await rm(resolve(paths.runtimeRoot, path), { force: true })
  await writeIfChanged(manifestFile, JSON.stringify({ files: [...outputs.keys()], pages: pages.map(({ sourceContent, frontmatter, ...page }) => page) }, null, 2))
  await writeIfChanged(resolve(configDirectory, 'config.mts'), `import { runtimeConfig } from 'cocowiki/runtime'\nexport default runtimeConfig(${JSON.stringify(paths.runtimeRoot)})\n`)
  const snapshot = snapshots.get(paths.runtimeRoot)
  if (snapshot) { snapshot.pages = pages; snapshot.config = config }
  else snapshots.set(paths.runtimeRoot, { pages, config })
  return paths.runtimeRoot
}

export async function preflightRuntime(projectRoot: string, config: CocoWikiConfig, mode: RuntimeMode) {
  const paths = resolveProjectPaths(projectRoot, config, runtimePath(projectRoot, mode))
  const contributors = resolve(paths.dataDir, 'contributors.json')
  if (existsSync(contributors)) validateContributors(JSON.parse(await readFile(contributors, 'utf8')), contributors)
  const names = new Map<string, string>()
  for (const file of await fg('**/*.vue', { cwd: paths.componentsDir })) {
    const name = componentName(file)
    if (!name || names.has(name)) raise(`${file} [component]: 全局组件名称冲突：${names.get(name) || file}`)
    names.set(name, file)
  }
  for (const path of await fg('**/*.md', { cwd: paths.contentDir })) {
    const file = resolve(paths.contentDir, path)
    rebaseMarkdown(await readFile(file, 'utf8'), file, resolve(paths.runtimeRoot, path))
  }
}
