import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { format, resolveConfig } from 'prettier'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const packageRoot = path.resolve(__dirname, '..')
const repoRoot = path.resolve(packageRoot, '..', '..')
const iconsSvgRoot = path.join(repoRoot, 'packages', 'icons-svg')
const iconRegistry = path.join(repoRoot, 'spec', 'icons', 'registry.yaml')
const componentsRoot = path.join(packageRoot, 'src', 'components')
const componentsIndex = path.join(packageRoot, 'src/components/index.ts')

const requiredSvgPatterns = [
  /stroke-linejoin="round"/u,
  /stroke-linecap="round"/u,
  /stroke-width="32"/u,
  /stroke="currentColor"/u,
  /viewBox="0 0 1024 1024"/u,
  /fill="currentColor"/u,
]

function toPascalCase(name: string) {
  return name
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('')
}

function parseScalar(value: string) {
  const trimmed = value.trim()
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    return trimmed
      .slice(1, -1)
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
  }
  return trimmed.replace(/^['"]|['"]$/gu, '')
}

function readRegistryAliases(registry: string) {
  const icons: Array<{ id: string; source?: string; aliases?: string[] }> = []
  let current: { id: string; source?: string; aliases?: string[] } | undefined

  for (const line of registry.split('\n')) {
    const idMatch = line.match(/^[ ]{2}- id: (.+)$/u)
    if (idMatch) {
      current = { id: String(parseScalar(idMatch[1])) }
      icons.push(current)
      continue
    }

    const fieldMatch = line.match(/^[ ]{4}(source|aliases): (.+)$/u)
    if (!fieldMatch || !current) continue
    const [, field, value] = fieldMatch
    if (field === 'aliases') {
      current.aliases = parseScalar(value) as string[]
    } else {
      current.source = String(parseScalar(value))
    }
  }

  return icons
}

function readAttributes(markup: string) {
  return Array.from(markup.matchAll(/([\w:-]+)="([^"]*)"/gu)).map(
    ([, name, value]) => ({ name, value }),
  )
}

function formatSvg(svg: string) {
  const svgMatch = svg.match(/^<svg\b([^>]*)>(.*)<\/svg>$/su)
  if (!svgMatch) {
    throw new Error('Icon source must contain one root <svg> element.')
  }

  const [, rootAttrs, body] = svgMatch
  const formattedRootAttrs = readAttributes(rootAttrs)
    .filter(({ name }) => name !== 'xml:space')
    .map(({ name, value }) => `    ${name}="${value}"`)
    .join('\n')

  const formattedPaths = Array.from(body.matchAll(/<path\b([^>]*)\/>/gu))
    .map(([, pathAttrs]) => {
      const attrs = readAttributes(pathAttrs)
        .map(({ name, value }) => `      ${name}="${value}"`)
        .join('\n')

      return `    <path\n${attrs}\n    />`
    })
    .join('\n')

  return `<svg\n${formattedRootAttrs}\n  >\n${formattedPaths}\n  </svg>`
}

function componentTemplate(componentName: string, svg: string) {
  return `<template>
  ${formatSvg(svg)}
</template>
<script lang="ts" setup>
defineOptions({
  name: '${componentName}',
})
</script>
`
}

const svgFiles = (await readdir(iconsSvgRoot))
  .filter((file) => file.endsWith('.svg'))
  .sort((a, b) => a.localeCompare(b))
const prettierOptions = (await resolveConfig(
  path.join(repoRoot, 'package.json'),
)) ?? {
  semi: false,
  singleQuote: true,
}

await mkdir(componentsRoot, { recursive: true })

const staleVueFiles = (await readdir(componentsRoot)).filter((file) =>
  file.endsWith('.vue'),
)

await Promise.all(
  staleVueFiles.map((file) =>
    rm(path.join(componentsRoot, file), { force: true }),
  ),
)

const exportTargets = new Map<string, string>()

for (const file of svgFiles) {
  const name = file.replace(/\.svg$/u, '')
  const componentName = toPascalCase(name)
  const svg = (await readFile(path.join(iconsSvgRoot, file), 'utf8')).trim()

  const missing = requiredSvgPatterns.filter((pattern) => !pattern.test(svg))
  if (missing.length > 0) {
    throw new Error(
      `Icon ${file} is missing FsusUI design attrs: ${missing
        .map((pattern) => pattern.source)
        .join(', ')}`,
    )
  }

  await writeFile(
    path.join(componentsRoot, `${name}.vue`),
    await format(componentTemplate(componentName, svg), {
      ...prettierOptions,
      parser: 'vue',
    }),
    'utf8',
  )
  exportTargets.set(componentName, name)
}

const registryAliases = readRegistryAliases(
  await readFile(iconRegistry, 'utf8'),
)
for (const icon of registryAliases) {
  if (!icon.source) {
    throw new Error(`Icon registry entry ${icon.id} is missing source`)
  }

  const sourceName = path.basename(icon.source).replace(/\.svg$/u, '')
  if (!svgFiles.includes(`${sourceName}.svg`)) {
    throw new Error(`Icon registry source ${icon.source} does not exist`)
  }

  for (const alias of [icon.id, ...(icon.aliases ?? [])]) {
    const exportName = toPascalCase(alias)
    const existing = exportTargets.get(exportName)
    if (existing && existing !== sourceName) {
      throw new Error(
        `Icon registry alias ${exportName} conflicts with ${existing}.vue`,
      )
    }
    exportTargets.set(exportName, sourceName)
  }
}

const exports = Array.from(exportTargets.entries())
  .map(([componentName, fileName]) => {
    return `export { default as ${componentName} } from './${fileName}.vue'`
  })
  .sort((a, b) => a.localeCompare(b))

await writeFile(
  componentsIndex,
  await format(`${exports.join('\n')}\n`, {
    ...prettierOptions,
    parser: 'typescript',
  }),
  'utf8',
)

console.log(`Generated ${svgFiles.length} FsusUI design-aligned icons.`)
