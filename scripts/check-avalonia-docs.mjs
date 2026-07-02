import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const failures = []

const toPosix = (value) => value.split(path.sep).join('/')

const exists = (relativePath) => fs.existsSync(path.join(root, relativePath))

const read = (relativePath) =>
  fs.readFileSync(path.join(root, relativePath), 'utf8')

const fail = (message) => failures.push(message)

const assert = (condition, message) => {
  if (!condition) fail(message)
}

const walk = (directory, predicate) => {
  const fullDirectory = path.join(root, directory)
  if (!fs.existsSync(fullDirectory)) return []

  const results = []
  for (const entry of fs.readdirSync(fullDirectory, { withFileTypes: true })) {
    if (['bin', 'obj', 'dist', 'node_modules'].includes(entry.name)) continue
    const relativePath = toPosix(path.join(directory, entry.name))
    if (entry.isDirectory()) {
      results.push(...walk(relativePath, predicate))
      continue
    }
    if (!predicate || predicate(relativePath)) results.push(relativePath)
  }
  return results.sort()
}

const slugify = (heading) =>
  heading
    .trim()
    .toLowerCase()
    .replace(/`/g, '')
    .replace(/[^\p{Letter}\p{Number}\s-]/gu, '')
    .replace(/\s+/g, '-')

const collectAnchors = (content) => {
  const anchors = new Set()
  for (const match of content.matchAll(/^#{1,6}\s+(.+)$/gm)) {
    anchors.add(slugify(match[1]))
  }
  return anchors
}

const collectStableComponents = () => {
  const registry = read(
    'dotnet/FsusUI.Avalonia.Demo/Gallery/FsusAvaloniaGalleryRegistry.cs',
  )
  return [...registry.matchAll(/Entry\("([^"]+)",\s*"([^"]+)"\)/g)].map(
    ([, id, title]) => ({ id, title }),
  )
}

const collectPublicFsusSymbols = () => {
  const files = [
    ...walk('dotnet/FsusUI.Avalonia', (file) => file.endsWith('.cs')),
    ...walk('dotnet/FsusUI.Avalonia.Themes', (file) => file.endsWith('.cs')),
    ...walk('dotnet/FsusUI.Avalonia.Icons', (file) => file.endsWith('.cs')),
  ]
  const symbols = new Set(['FsusUI'])
  const pattern =
    /public\s+(?:sealed\s+|abstract\s+|static\s+|partial\s+)*?(?:class|record|enum|interface|struct)\s+(Fsus[A-Za-z0-9_]+)/g

  for (const file of files) {
    const content = read(file)
    for (const match of content.matchAll(pattern)) {
      symbols.add(match[1])
    }
  }

  return symbols
}

const parsePlatformOverrideIds = () => {
  const files = walk('spec/platform-overrides', (file) => file.endsWith('.yaml'))
  const ids = []
  for (const file of files) {
    const content = read(file)
    for (const match of content.matchAll(/^\s+- id:\s*([A-Za-z0-9_-]+)/gm)) {
      ids.push({ id: match[1], file })
    }
  }
  return ids
}

const stripFenceInfo = (value) => value.trim().split(/\s+/u)[0].toLowerCase()

const csharpFences = (content) => {
  const fences = []
  for (const match of content.matchAll(/```([^\n]*)\n([\s\S]*?)```/g)) {
    if (stripFenceInfo(match[1]) === 'csharp') fences.push(match[2])
  }
  return fences
}

const validateCsharpExamplesReferencePublicApi = (file, content, publicSymbols) => {
  for (const block of csharpFences(content)) {
    for (const match of block.matchAll(/\b(Fsus[A-Za-z0-9_]+)\b/g)) {
      const symbol = match[1]
      if (!publicSymbols.has(symbol)) {
        fail(`${file} csharp example references non-public API ${symbol}`)
      }
    }
  }
}

const validateMarkdownLinks = (files) => {
  const cache = new Map()
  const load = (relativePath) => {
    if (!cache.has(relativePath)) {
      cache.set(relativePath, {
        content: read(relativePath),
        anchors: collectAnchors(read(relativePath)),
      })
    }
    return cache.get(relativePath)
  }

  for (const file of files) {
    const content = read(file)
    for (const match of content.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
      const rawTarget = match[1].trim().replace(/^<|>$/g, '')
      if (
        rawTarget.startsWith('http://') ||
        rawTarget.startsWith('https://') ||
        rawTarget.startsWith('mailto:') ||
        rawTarget.startsWith('app://')
      ) {
        continue
      }

      const [targetPath, rawAnchor] = rawTarget.split('#')
      const normalizedPath =
        targetPath === ''
          ? file
          : toPosix(path.normalize(path.join(path.dirname(file), targetPath)))
      if (!exists(normalizedPath)) {
        fail(`${file} links to missing ${rawTarget}`)
        continue
      }
      if (rawAnchor) {
        const anchor = decodeURIComponent(rawAnchor)
        const target = load(normalizedPath)
        assert(
          target.anchors.has(anchor),
          `${file} links to missing anchor #${anchor} in ${normalizedPath}`,
        )
      }
    }
  }
}

const validatePackageReadmes = () => {
  const readmes = [
    'dotnet/FsusUI.Avalonia/README.md',
    'dotnet/FsusUI.Avalonia.Themes/README.md',
    'dotnet/FsusUI.Avalonia.Icons/README.md',
  ]
  for (const file of readmes) {
    assert(exists(file), `${file} missing`)
    if (!exists(file)) continue
    const content = read(file)
    assert(
      content.includes('docs/avalonia/installation.md'),
      `${file} must link to docs/avalonia/installation.md`,
    )
  }
}

const validateConsumerSample = () => {
  const project = 'dotnet/FsusUI.Avalonia.ConsumerSample/FsusUI.Avalonia.ConsumerSample.csproj'
  const program = 'dotnet/FsusUI.Avalonia.ConsumerSample/Program.cs'

  assert(exists(project), `${project} missing`)
  assert(exists(program), `${program} missing`)
  if (!exists(project) || !exists(program)) return

  const projectXml = read(project)
  for (const required of [
    '..\\FsusUI.Avalonia\\FsusUI.Avalonia.csproj',
    '..\\FsusUI.Avalonia.Themes\\FsusUI.Avalonia.Themes.csproj',
    '..\\FsusUI.Avalonia.Icons\\FsusUI.Avalonia.Icons.csproj',
  ]) {
    assert(projectXml.includes(required), `${project} missing ${required}`)
  }

  const programCs = read(program)
  for (const required of [
    'FsusButton',
    'FsusInput',
    'FsusThemeManager',
    'FsusIconKeys',
    '--smoke',
  ]) {
    assert(programCs.includes(required), `${program} missing ${required}`)
  }
}

const validateAvaloniaDocs = () => {
  const components = collectStableComponents()
  const publicSymbols = collectPublicFsusSymbols()
  const docsFiles = [
    'docs/avalonia/README.md',
    'docs/avalonia/installation.md',
    'docs/avalonia/platform-differences.md',
    'docs/avalonia/vue-migration.md',
    ...components.map(({ id }) => `docs/avalonia/components/${id}.md`),
  ]

  for (const file of docsFiles) {
    assert(exists(file), `${file} missing`)
  }

  if (exists('docs/avalonia/installation.md')) {
    const installation = read('docs/avalonia/installation.md')
    for (const packageName of [
      'FsusUI.Avalonia',
      'FsusUI.Avalonia.Themes',
      'FsusUI.Avalonia.Icons',
    ]) {
      assert(
        installation.includes(packageName),
        `docs/avalonia/installation.md missing ${packageName}`,
      )
    }
    assert(
      installation.includes('FsusUI.Avalonia.ConsumerSample'),
      'docs/avalonia/installation.md must link the clean consumer sample',
    )
  }

  if (exists('docs/avalonia/vue-migration.md')) {
    const migration = read('docs/avalonia/vue-migration.md')
    for (const term of [
      'slots',
      'services',
      'directives',
      'overlay behavior',
      'locale providers',
    ]) {
      assert(
        migration.toLowerCase().includes(term),
        `docs/avalonia/vue-migration.md missing ${term}`,
      )
    }
  }

  if (exists('docs/avalonia/platform-differences.md')) {
    const differences = read('docs/avalonia/platform-differences.md')
    for (const { id, file } of parsePlatformOverrideIds()) {
      assert(
        differences.includes(id),
        `docs/avalonia/platform-differences.md missing ${id} from ${file}`,
      )
    }
  }

  const requiredSections = [
    '## Avalonia API',
    '## Vue Contract Mapping',
    '## Supported Platform Differences',
    '## Theme Tokens',
    '## Minimal Avalonia Example',
    '## Known Limitations',
  ]

  for (const { id, title } of components) {
    const file = `docs/avalonia/components/${id}.md`
    if (!exists(file)) continue
    const content = read(file)
    assert(
      content.includes(`Component ID: \`${id}\``),
      `${file} missing component id marker`,
    )
    assert(content.includes(title), `${file} missing stable title ${title}`)
    for (const section of requiredSections) {
      assert(content.includes(section), `${file} missing ${section}`)
    }
    assert(csharpFences(content).length > 0, `${file} missing csharp example`)
    assert(
      content.includes('docs/avalonia/platform-differences.md'),
      `${file} must cross-reference platform differences`,
    )
    validateCsharpExamplesReferencePublicApi(file, content, publicSymbols)
  }

  validateMarkdownLinks(docsFiles.filter((file) => exists(file)))
}

try {
  validatePackageReadmes()
  validateConsumerSample()
  validateAvaloniaDocs()

  if (failures.length) {
    throw new Error(failures.map((failure) => `- ${failure}`).join('\n'))
  }

  console.log('Avalonia docs check passed.')
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
}
