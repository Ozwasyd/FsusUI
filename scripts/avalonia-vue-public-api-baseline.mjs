import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { execFileSync } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import {
  extractDeprecatedDeclarations,
  extractComponentSemantics,
  declaredComponentNames,
  sourceForComponent as compilerSourceForComponent,
} from './vue-semantic-baseline.mjs'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const defaultRoot = path.resolve(scriptDir, '..')
const args = new Set(process.argv.slice(2))
const checkMode = args.has('--check')
const writeMode = !checkMode

const allowedClassifications = new Set([
  'portable',
  'native-adapter',
  'platform-override',
  'web-only',
])

const read = (file) => fs.readFileSync(file, 'utf8')
const exists = (file) => fs.existsSync(file)
const write = (file, content) => {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, content)
}

const stableJson = (value) => `${JSON.stringify(value, null, 2)}\n`

const formatGenerated = async (file, content) => {
  const prettier = await import('prettier')
  return prettier.format(content, { filepath: file })
}

const hashFiles = (root, files) => {
  const hash = crypto.createHash('sha256')
  for (const relativePath of files.sort()) {
    const fullPath = path.join(root, relativePath)
    if (exists(fullPath)) {
      hash.update(relativePath)
      hash.update('\0')
      hash.update(read(fullPath))
      hash.update('\0')
    }
  }
  return hash.digest('hex')
}

const sha256 = (value) =>
  crypto.createHash('sha256').update(value).digest('hex')

const walkFiles = (dir, predicate = () => true) => {
  if (!exists(dir)) return []
  const results = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist') continue
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      results.push(...walkFiles(fullPath, predicate))
    } else if (predicate(fullPath)) {
      results.push(fullPath)
    }
  }
  return results.sort()
}

const toPosix = (value) => value.split(path.sep).join('/')

const toKebab = (value) =>
  value
    .replace(/^El/, '')
    .replace(/^Fsus/, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1-$2')
    .toLowerCase()

const uniqueSorted = (values) => [...new Set(values.filter(Boolean))].sort()

const parseJson = (file) => JSON.parse(read(file))

const getGitSha = (root) => {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
  } catch {
    return 'unknown'
  }
}

const scanDelimiters = (source, start, visit) => {
  let quote = ''
  let escaped = false
  let lineComment = false
  let blockComment = false

  for (let index = start; index < source.length; index += 1) {
    const char = source[index]
    const next = source[index + 1]

    if (lineComment) {
      if (char === '\n') lineComment = false
      continue
    }
    if (blockComment) {
      if (char === '*' && next === '/') {
        blockComment = false
        index += 1
      }
      continue
    }
    if (quote) {
      if (escaped) {
        escaped = false
      } else if (char === '\\') {
        escaped = true
      } else if (char === quote) {
        quote = ''
      }
      continue
    }
    if (char === '/' && next === '/') {
      lineComment = true
      index += 1
      continue
    }
    if (char === '/' && next === '*') {
      blockComment = true
      index += 1
      continue
    }
    if (char === '"' || char === "'" || char === '`') {
      quote = char
      continue
    }
    if ('{}[](),'.includes(char) && visit(char, index)) return index
  }
  return -1
}

const findMatchingBrace = (source, openIndex) => {
  let depth = 0
  return scanDelimiters(source, openIndex, (char) => {
    if (char === '{') depth += 1
    if (char === '}') depth -= 1
    return char === '}' && depth === 0
  })
}

const splitTopLevel = (source) => {
  const parts = []
  let start = 0
  let depth = 0
  scanDelimiters(source, 0, (char, index) => {
    if ('{[('.includes(char)) depth += 1
    if ('}])'.includes(char)) depth -= 1
    if (char === ',' && depth === 0) {
      parts.push(source.slice(start, index))
      start = index + 1
    }
  })
  parts.push(source.slice(start))
  return parts
}

const stripComments = (source) =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')

const parseObjectKeys = (objectSource) => {
  const inner = objectSource.trim().replace(/^\{/, '').replace(/\}$/, '')
  return uniqueSorted(
    splitTopLevel(inner)
      .map((part) => stripComments(part).trim())
      .map((part) => {
        if (!part) return ''
        if (part.startsWith('...')) return `...${part.slice(3).trim()}`
        const computed = part.match(/^\[([^\]]+)\]\s*:/)
        if (computed) return `[${computed[1].trim()}]`
        const quoted = part.match(/^['"]([^'"]+)['"]\s*:/)
        if (quoted) return quoted[1]
        const normal = part.match(/^([A-Za-z_$][\w$-]*)\s*:/)
        if (normal) return normal[1]
        const method = part.match(/^([A-Za-z_$][\w$-]*)\s*\(/)
        if (method) return method[1]
        const shorthand = part.match(/^([A-Za-z_$][\w$]*)$/)
        if (shorthand) return shorthand[1]
        return ''
      }),
  )
}

const objectForExpression = (source, startIndex) => {
  const openIndex = source.indexOf('{', startIndex)
  if (openIndex === -1) return ''
  const closeIndex = findMatchingBrace(source, openIndex)
  if (closeIndex === -1) return ''
  return source.slice(openIndex, closeIndex + 1)
}

const objectLiteralAtExpression = (source, startIndex) => {
  let openIndex = startIndex
  while (/\s/.test(source[openIndex] ?? '')) openIndex += 1
  if (source[openIndex] !== '{') return ''
  const closeIndex = findMatchingBrace(source, openIndex)
  if (closeIndex === -1) return ''
  return source.slice(openIndex, closeIndex + 1)
}

const findConstObject = (sources, identifier) => {
  const assignment = new RegExp(
    `(?:export\\s+)?const\\s+${identifier.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*=`,
  )
  for (const source of sources) {
    const match = source.content.match(assignment)
    if (!match) continue
    const offset = match.index + match[0].length
    return objectForExpression(source.content, offset)
  }
  return ''
}

const parseDefineArguments = (vueSource, macroName) =>
  uniqueSorted(
    [...vueSource.matchAll(new RegExp(`${macroName}\\(([^)]*)\\)`, 'g'))].map(
      (match) => match[1].trim(),
    ),
  )

const parseDefineExpose = (vueSource) => {
  const exposed = []
  for (const match of vueSource.matchAll(/defineExpose\s*\(/g)) {
    const object = objectForExpression(vueSource, match.index + match[0].length)
    if (object) exposed.push(...parseObjectKeys(object))
  }
  return uniqueSorted(exposed)
}

const parseOptionsApiObjects = (vueSource, key) => {
  const results = []
  for (const match of vueSource.matchAll(new RegExp(`${key}\\s*:\\s*`, 'g'))) {
    const object = objectLiteralAtExpression(
      vueSource,
      match.index + match[0].length,
    )
    if (object) results.push(object)
  }
  return results
}

const isV2NativeLayout = (root) =>
  exists(path.join(root, 'vue/packages/fsusui/package.json'))

const parseV2ComponentCatalog = (root) => {
  const indexFile = path.join(root, 'vue/packages/components/src/index.ts')
  const content = exists(indexFile) ? read(indexFile) : ''
  const moduleToExports = new Map()
  const exportToModule = new Map()
  const serviceOrDirectiveNames = new Set([
    'FsusMessage',
    'FsusNotification',
    'FsusMessageBox',
    'FsusLoadingService',
    'vFsusLoading',
    'vFsusInfiniteScroll',
  ])

  const registerExport = (name, moduleName) => {
    exportToModule.set(name, moduleName)
    if (!moduleToExports.has(moduleName)) moduleToExports.set(moduleName, [])
    moduleToExports.get(moduleName).push(name)
  }

  for (const match of content.matchAll(
    /import\s+([A-Za-z_$][\w$]*)\s+from\s+['"]\.\/([^/'"]+)(?:\/[^'"]+)?['"]/g,
  )) {
    const [, name, moduleName] = match
    registerExport(name, moduleName)
  }
  for (const match of content.matchAll(
    /import\s*\{([\s\S]*?)\}\s*from\s+['"]\.\/([^/'"]+)(?:\/[^'"]+)?['"]/g,
  )) {
    const [, namesBlock, moduleName] = match
    const names = namesBlock
      .split(',')
      .map((part) => part.trim())
      .filter((part) => part && !part.startsWith('type '))
      .map((part) => part.split(/\s+as\s+/).at(-1)?.trim())
      .filter(Boolean)
    for (const name of names) registerExport(name, moduleName)
  }

  // Markdown subpath components (@ozwasyd/fsusui/markdown)
  if (exists(path.join(root, 'vue/packages/markdown/src/markdown-editor'))) {
    registerExport('FsusMarkdownEditor', 'markdown-editor')
  }
  if (exists(path.join(root, 'vue/packages/markdown/src/markdown-renderer'))) {
    registerExport('FsusMarkdownRenderer', 'markdown-renderer')
  }
  // Icon component (@ozwasyd/fsusui/icons)
  if (exists(path.join(root, 'vue/packages/icons/src/index.ts'))) {
    registerExport('FsusIcon', 'icon')
  }

  const installed = []
  const listMatch = content.match(
    /export\s+const\s+fsusComponents(?:\s*:\s*[^=]+)?\s*=\s*\[/,
  )
  if (listMatch) {
    const openIndex = listMatch.index + listMatch[0].length - 1
    const closeIndex = content.indexOf(']', openIndex)
    if (openIndex !== -1 && closeIndex !== -1) {
      installed.push(
        ...content
          .slice(openIndex + 1, closeIndex)
          .split(',')
          .map((part) => part.trim())
          .filter(Boolean),
      )
    }
  }
  if (exportToModule.has('FsusIcon')) installed.push('FsusIcon')

  const componentModules = uniqueSorted([...moduleToExports.keys()])
  const componentExportsByModule = new Map()
  for (const moduleName of componentModules) {
    componentExportsByModule.set(
      moduleName,
      uniqueSorted(
        (moduleToExports.get(moduleName) ?? []).filter(
          (name) => !serviceOrDirectiveNames.has(name),
        ),
      ),
    )
  }

  return {
    componentModules,
    componentExportsByModule,
    allExportsByModule: moduleToExports,
    imports: exportToModule,
    installed: uniqueSorted(installed),
  }
}

const parseDeprecatedApis = (root) => {
  const dirs = isV2NativeLayout(root)
    ? [
        path.join(root, 'vue/packages/components/src'),
        path.join(root, 'vue/packages/markdown/src'),
        path.join(root, 'vue/packages/icons/src'),
      ]
    : [path.join(root, 'vue/packages/components')]
  const files = dirs.flatMap((dir) =>
    walkFiles(dir, (file) => /\.(ts|vue)$/.test(file) && !file.includes('__tests__')),
  )
  const deprecated = []
  for (const file of files) {
    const content = read(file)
    if (!content.includes('@deprecated')) continue
    for (const declaration of extractDeprecatedDeclarations({
      source: content,
      filename: file,
    })) {
      deprecated.push({
        file: toPosix(path.relative(root, file)),
        ...declaration,
      })
    }
  }
  return deprecated.sort((a, b) =>
    `${a.file}:${a.target}`.localeCompare(`${b.file}:${b.target}`),
  )
}

const parseComponentIndexModules = (root) => {
  const file = path.join(root, 'vue/packages/components/index.ts')
  const content = exists(file) ? read(file) : ''
  return uniqueSorted(
    [...content.matchAll(/export\s+\*\s+from\s+['"]\.\/([^'"]+)['"]/g)].map(
      (match) => match[1],
    ),
  )
}

const parsePublicExports = (root, moduleName) => {
  const file = path.join(
    root,
    'vue/packages/components',
    moduleName,
    'index.ts',
  )
  if (!exists(file)) return []
  const content = read(file)
  const exports = []
  for (const match of content.matchAll(
    /export\s+const\s+([A-Za-z_$][\w$]*)/g,
  )) {
    exports.push(match[1])
  }
  for (const match of content.matchAll(/export\s*\{([^}]+)\}/g)) {
    const names = match[1]
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const alias = part.split(/\s+as\s+/).map((value) => value.trim())
        return alias.at(-1)
      })
      .filter(Boolean)
    exports.push(...names)
  }
  return uniqueSorted(exports)
}

const parseComponentImports = (root) => {
  const file = path.join(root, 'vue/packages/element-plus/component.ts')
  if (!exists(file)) return { imports: new Map(), installed: [] }
  const content = read(file)
  const imports = new Map()
  for (const match of content.matchAll(
    /import\s*\{([\s\S]*?)\}\s*from\s*['"]@element-plus\/components\/([^'"]+)['"]/g,
  )) {
    const moduleName = match[2]
    const names = match[1]
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean)
    for (const name of names) imports.set(name, moduleName)
  }
  const installed = []
  const allComponentsMatch = content.match(
    /export\s+const\s+allComponents\s*=\s*\[/,
  )
  if (allComponentsMatch) {
    const openIndex = content.indexOf('[', allComponentsMatch.index)
    const closeIndex = content.indexOf(']', openIndex)
    if (openIndex !== -1 && closeIndex !== -1) {
      installed.push(
        ...content
          .slice(openIndex + 1, closeIndex)
          .split(',')
          .map((part) => part.trim())
          .filter(Boolean),
      )
    }
  }
  return { imports, installed: uniqueSorted(installed) }
}

const parsePluginImports = (root) => {
  if (isV2NativeLayout(root)) {
    return [
      { name: 'FsusMotionPlugin', source: '@fsusui/motion' },
      { name: 'FsusUI', source: '@ozwasyd/fsusui' },
    ]
  }
  const file = path.join(root, 'vue/packages/element-plus/plugin.ts')
  if (!exists(file)) return []
  const content = read(file)
  const plugins = []
  for (const match of content.matchAll(
    /import\s*\{([^}]+)\}\s*from\s*['"]([^'"]+)['"]/g,
  )) {
    const source = match[2]
    const names = match[1]
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean)
    for (const name of names) plugins.push({ name, source })
  }
  return plugins.sort((a, b) => a.name.localeCompare(b.name))
}

const parseEntryPoints = (root, classifications) => {
  const packageFile = isV2NativeLayout(root)
    ? path.join(root, 'vue/packages/fsusui/package.json')
    : path.join(root, 'vue/packages/element-plus/package.json')
  if (!exists(packageFile)) return []
  const packageJson = parseJson(packageFile)
  return Object.keys(packageJson.exports || {})
    .sort()
    .map((entry) => ({
      path: entry,
      classification: requiredClassification(
        classifications.entryPoints,
        entry,
        `entry point ${entry}`,
      ),
    }))
}

const parseCssVariables = (root) => {
  const themeDir = isV2NativeLayout(root)
    ? path.join(root, 'vue/packages/theme/src')
    : path.join(root, 'vue/packages/theme-chalk/src')
  const files = walkFiles(themeDir, (file) => /\.(scss|css)$/.test(file))
  const varPattern = isV2NativeLayout(root)
    ? /--fsus-[A-Za-z0-9-]+/g
    : /--(?:el|fsus)-[A-Za-z0-9-]+/g
  const variables = new Map()
  for (const file of files) {
    const content = read(file)
    for (const match of content.matchAll(varPattern)) {
      const name = match[0]
      const entry = variables.get(name) || { name, files: [] }
      entry.files.push(toPosix(path.relative(root, file)))
      variables.set(name, entry)
    }
  }
  return [...variables.values()]
    .map((entry) => ({
      ...entry,
      files: uniqueSorted(entry.files),
      classification: 'portable',
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

const requiredClassification = (map, key, label) => {
  const classification = map?.[key]
  if (!classification) throw new Error(`${label} is missing classification`)
  if (!allowedClassifications.has(classification)) {
    throw new Error(`${label} has invalid classification ${classification}`)
  }
  return classification
}

const loadClassifications = (root) => {
  const file = path.join(
    root,
    'spec/baselines/vue-public-api-classifications.json',
  )
  if (!exists(file)) {
    throw new Error(
      'spec/baselines/vue-public-api-classifications.json missing',
    )
  }
  return parseJson(file)
}

const loadModuleSources = (root, moduleName) => {
  const candidates = isV2NativeLayout(root)
    ? moduleName === 'icon'
      ? [path.join(root, 'vue/packages/icons/src')]
      : [
          path.join(root, 'vue/packages/components/src', moduleName),
          path.join(root, 'vue/packages/markdown/src', moduleName),
        ]
    : [path.join(root, 'vue/packages/components', moduleName)]
  const moduleRoot = candidates.find((candidate) => exists(candidate))
  if (!moduleRoot) return []
  const files = walkFiles(
    moduleRoot,
    (file) => /\.(ts|tsx|vue)$/.test(file) && !file.includes('__tests__'),
  )
  return files.map((file) => ({
    file,
    relativePath: toPosix(path.relative(root, file)),
    content: read(file),
  }))
}

const sourceForComponent = (sources, exportName) => {
  const kebab = toKebab(exportName)
  const exact = sources.find(
    (source) =>
      source.relativePath.endsWith(`/${exportName}.vue`) ||
      source.relativePath.endsWith(`/${exportName}.tsx`) ||
      source.relativePath.endsWith(`/src/${kebab}.vue`) ||
      source.relativePath.endsWith(`/src/${kebab}.tsx`),
  )
  if (exact) return exact
  const declared = sources.find((source) =>
    declaredComponentNames(source.content).has(exportName),
  )
  if (declared) return declared
  return sources.find((source) => source.relativePath.endsWith('.vue'))
}

const collectPropsAndEmits = (sources, vueSource) => {
  const props = []
  const emits = []

  for (const arg of parseDefineArguments(vueSource, 'defineProps')) {
    if (arg.startsWith('{')) {
      props.push(...parseObjectKeys(arg))
      continue
    }
    const object = findConstObject(sources, arg)
    if (object) props.push(...parseObjectKeys(object))
  }
  for (const object of parseOptionsApiObjects(vueSource, 'props')) {
    props.push(...parseObjectKeys(object))
  }

  for (const arg of parseDefineArguments(vueSource, 'defineEmits')) {
    if (arg.startsWith('{')) {
      emits.push(...parseObjectKeys(arg))
      continue
    }
    const object = findConstObject(sources, arg)
    if (object) emits.push(...parseObjectKeys(object))
  }
  for (const object of parseOptionsApiObjects(vueSource, 'emits')) {
    emits.push(...parseObjectKeys(object))
  }

  return {
    props: uniqueSorted(props),
    emits: uniqueSorted(emits),
  }
}

const fallbackPropsAndEmits = (sources, exportName) => {
  const base = toKebab(exportName).replace(/-([a-z])/g, (_, char) =>
    char.toUpperCase(),
  )
  const props = []
  const emits = []
  for (const source of sources) {
    for (const match of source.content.matchAll(
      /export\s+const\s+([A-Za-z_$][\w$]*(?:Props|Emits))\s*=/g,
    )) {
      const identifier = match[1]
      if (
        !identifier.toLowerCase().includes(base.toLowerCase()) &&
        sources.length > 4
      ) {
        continue
      }
      const object = findConstObject(sources, identifier)
      if (!object) continue
      if (identifier.endsWith('Props')) props.push(...parseObjectKeys(object))
      if (identifier.endsWith('Emits')) emits.push(...parseObjectKeys(object))
    }
  }
  return {
    props: uniqueSorted(props),
    emits: uniqueSorted(emits),
  }
}

const parseComponent = (
  root,
  moduleName,
  exportName,
  classification,
  structuredEmitNames,
  structuredExposedNames,
) => {
  const sources = loadModuleSources(root, moduleName)
  const vueSource = sourceForComponent(sources, exportName)
  const slotVueSource = compilerSourceForComponent(sources, exportName)
  const fromVue = vueSource
    ? collectPropsAndEmits(sources, vueSource.content)
    : { props: [], emits: [] }
  const fallback =
    fromVue.props.length || fromVue.emits.length
      ? { props: [], emits: [] }
      : fallbackPropsAndEmits(sources, exportName)
  const semantics = extractComponentSemantics({
    root,
    moduleSources: sources,
    vueSource,
    exportName,
    structuredEmitNames,
    structuredExposedNames,
  })
  const slotSemantics =
    slotVueSource === vueSource
      ? semantics
      : extractComponentSemantics({
          root,
          moduleSources: sources,
          vueSource: slotVueSource,
          exportName,
        })

  const rawProps = uniqueSorted([...fromVue.props, ...fallback.props])
  const rawEmits = uniqueSorted([...fromVue.emits, ...fallback.emits])
  const rawExposed = vueSource ? parseDefineExpose(vueSource.content) : []

  return {
    name: exportName,
    module: moduleName,
    classification,
    source: vueSource?.relativePath ?? null,
    props: rawProps.length > 0 ? rawProps : semantics.legacyProps,
    emits: rawEmits.length > 0 ? rawEmits : semantics.legacyEmits,
    slots: slotSemantics.semanticSlots,
    exposed: rawExposed.length > 0 ? rawExposed : semantics.legacyExposed,
    semantic: {
      props: semantics.semanticProps,
      emits: semantics.semanticEmits,
      exposed: semantics.semanticExposed,
      slots: slotSemantics.semanticSlots,
    },
  }
}

const parseServicesAndDirectives = (
  root,
  componentModules,
  classifications,
  v2Catalog = null,
) => {
  if (v2Catalog) {
    const directives = [
      { name: 'vClickOutside', module: 'core' },
      { name: 'vFsusInfiniteScroll', module: 'image' },
      { name: 'vFsusLoading', module: 'loading' },
    ].map((item) => ({
      ...item,
      classification: requiredClassification(
        classifications.directives,
        item.name,
        `directive ${item.name}`,
      ),
    }))
    const services = [
      { name: 'FsusLoadingService', module: 'loading' },
      { name: 'FsusMessage', module: 'message' },
      { name: 'FsusMessageBox', module: 'message-box' },
      { name: 'FsusNotification', module: 'notification' },
    ].map((item) => ({
      ...item,
      classification: requiredClassification(
        classifications.services,
        item.name,
        `service ${item.name}`,
      ),
    }))
    return {
      directives: directives.sort((a, b) => a.name.localeCompare(b.name)),
      services: services.sort((a, b) => a.name.localeCompare(b.name)),
    }
  }
  const directives = []
  const services = []
  for (const moduleName of componentModules) {
    const publicExports = parsePublicExports(root, moduleName)
    for (const exportName of publicExports) {
      if (/Directive$/.test(exportName) || /^v[A-Z]/.test(exportName)) {
        directives.push({
          name: exportName,
          module: moduleName,
          classification: requiredClassification(
            classifications.directives,
            exportName,
            `directive ${exportName}`,
          ),
        })
      }
      if (/Service$/.test(exportName)) {
        services.push({
          name: exportName,
          module: moduleName,
          classification: requiredClassification(
            classifications.services,
            exportName,
            `service ${exportName}`,
          ),
        })
      }
    }
  }
  for (const serviceName of Object.keys(classifications.services || {})) {
    if (!services.some((service) => service.name === serviceName)) {
      const plugin = parsePluginImports(root).find(
        (item) => item.name === serviceName,
      )
      services.push({
        name: serviceName,
        module: plugin?.source ?? 'vue/packages/element-plus/plugin.ts',
        classification: requiredClassification(
          classifications.services,
          serviceName,
          `service ${serviceName}`,
        ),
      })
    }
  }
  return {
    directives: directives.sort((a, b) => a.name.localeCompare(b.name)),
    services: services.sort((a, b) => a.name.localeCompare(b.name)),
  }
}

export const buildArtifacts = (root, options = {}) => {
  const classifications = loadClassifications(root)
  const semanticBindingsPath = path.join(
    root,
    'spec/components/contracts/v2/semantic-member-bindings.json',
  )
  const structuredOutputs = new Map()
  const structuredOperations = new Map()
  if (exists(semanticBindingsPath)) {
    const semanticBindings = parseJson(semanticBindingsPath)
    for (const binding of semanticBindings.mappings ?? []) {
      if (binding.kind === 'output') {
        const names = structuredOutputs.get(binding.component) ?? new Set()
        names.add(binding.web)
        structuredOutputs.set(binding.component, names)
      }
      if (binding.kind === 'operation') {
        const names = structuredOperations.get(binding.component) ?? new Set()
        names.add(binding.web)
        structuredOperations.set(binding.component, names)
      }
    }
  }
  const v2Native = isV2NativeLayout(root)
  const packageJson = parseJson(
    path.join(
      root,
      v2Native
        ? 'vue/packages/fsusui/package.json'
        : 'vue/packages/element-plus/package.json',
    ),
  )
  const v2Catalog = v2Native ? parseV2ComponentCatalog(root) : null
  const componentModules = v2Catalog
    ? v2Catalog.componentModules
    : parseComponentIndexModules(root)
  const componentImportInfo = v2Catalog
    ? { imports: v2Catalog.imports, installed: v2Catalog.installed }
    : parseComponentImports(root)

  const components = []
  for (const moduleName of componentModules) {
    const classification = requiredClassification(
      classifications.componentModules,
      moduleName,
      `component module ${moduleName}`,
    )
    const publicExports = v2Catalog
      ? (v2Catalog.componentExportsByModule.get(moduleName) ?? [])
      : parsePublicExports(root, moduleName)
    for (const exportName of publicExports) {
      components.push(
        parseComponent(
          root,
          moduleName,
          exportName,
          classification,
          structuredOutputs.get(exportName) ?? [],
          structuredOperations.get(exportName) ?? [],
        ),
      )
    }
  }

  for (const [name, moduleName] of componentImportInfo.imports) {
    if (!componentModules.includes(moduleName)) {
      throw new Error(
        `${name} imports unregistered component module ${moduleName}`,
      )
    }
  }
  for (const name of componentImportInfo.installed) {
    if (!componentImportInfo.imports.has(name)) {
      throw new Error(`${name} is installable but has no component import`)
    }
  }

  const plugins = parsePluginImports(root).map((plugin) => ({
    ...plugin,
    classification: requiredClassification(
      classifications.plugins,
      plugin.name,
      `plugin ${plugin.name}`,
    ),
  }))
  const { directives, services } = parseServicesAndDirectives(
    root,
    componentModules,
    classifications,
    v2Catalog,
  )
  const cssVariables = parseCssVariables(root)
  const entryPoints = parseEntryPoints(root, classifications)
  const deprecatedApis = parseDeprecatedApis(root)

  const tokenFiles = v2Native
    ? [
        'spec/tokens/tokens.json',
        'vue/packages/theme/src/generated/tokens.json',
        'vue/packages/theme/src/generated/tokens.css',
        'vue/packages/theme/src/generated/tokens.scss',
      ]
    : [
        'spec/tokens/tokens.json',
        'vue/packages/theme-chalk/src/generated/tokens.json',
        'vue/packages/theme-chalk/src/generated/tokens.css',
        'vue/packages/theme-chalk/src/generated/tokens.scss',
      ]
  const iconFiles = v2Native
    ? [
        'spec/icons/registry.yaml',
        'spec/icons/categories.yaml',
        'vue/packages/icons/src/icon-paths.ts',
      ]
    : [
        'spec/icons/registry.yaml',
        'spec/icons/categories.yaml',
        'vue/packages/icons-vue/generated/icon-metadata.json',
      ]

  const componentCountByClassification = {}
  for (const classification of allowedClassifications) {
    componentCountByClassification[classification] = components.filter(
      (component) => component.classification === classification,
    ).length
  }

  const semanticVersion = '1.4.0'
  const compilerOptionsHash = sha256(
    stableJson({
      parser: ['@babel/parser'],
      plugins: [
        'typescript',
        'jsx',
        'decorators-legacy',
        'importAttributes',
        'topLevelAwait',
      ],
      sfcCompiler: {
        implementation: 'vue/compiler-sfc',
        templateAst: true,
        slotPayloadTypes: 'unknown-unless-compiler-proven',
      },
      typeChecker: {
        implementation: 'typescript',
        configHash: hashFiles(root, [
          'vue/tsconfig.base.json',
          'vue/tsconfig.web.json',
        ]),
        structuredEmitScope: 'explicit semantic output bindings',
        structuredExposedScope: 'explicit semantic operation bindings',
        maxFields: 64,
        maxDepth: 1,
      },
    }),
  )
  const dependencyVersionHash = sha256(
    stableJson({
      vue: read(path.join(defaultRoot, 'node_modules/vue/package.json')).match(
        /"version":\s*"([^"]+)"/,
      )?.[1],
      '@vue/compiler-sfc': read(
        path.join(defaultRoot, 'node_modules/@vue/compiler-sfc/package.json'),
      ).match(/"version":\s*"([^"]+)"/)?.[1],
      '@babel/parser': read(
        path.join(defaultRoot, 'node_modules/@babel/parser/package.json'),
      ).match(/"version":\s*"([^"]+)"/)?.[1],
      typescript: read(
        path.join(defaultRoot, 'node_modules/typescript/package.json'),
      ).match(/"version":\s*"([^"]+)"/)?.[1],
    }),
  )
  const inputTreeHash = hashFiles(
    root,
    v2Native
      ? [
          ...walkFiles(
            path.join(root, 'vue/packages/components/src'),
            (file) => /\.(ts|tsx|vue|json)$/.test(file) && !file.includes('__tests__'),
          ).map((file) => toPosix(path.relative(root, file))),
          ...walkFiles(
            path.join(root, 'vue/packages/markdown/src'),
            (file) => /\.(ts|tsx|vue|json)$/.test(file) && !file.includes('__tests__'),
          ).map((file) => toPosix(path.relative(root, file))),
          ...walkFiles(
            path.join(root, 'vue/packages/icons/src'),
            (file) => /\.ts$/.test(file) && !file.includes('__tests__'),
          ).map((file) => toPosix(path.relative(root, file))),
          ...walkFiles(
            path.join(root, 'vue/packages/core/src'),
            (file) => /\.ts$/.test(file) && !file.includes('__tests__'),
          ).map((file) => toPosix(path.relative(root, file))),
          ...walkFiles(
            path.join(root, 'vue/packages/motion/src'),
            (file) => /\.ts$/.test(file) && !file.includes('__tests__'),
          ).map((file) => toPosix(path.relative(root, file))),
          'vue/packages/fsusui/src/index.ts',
          'vue/packages/fsusui/package.json',
          'spec/baselines/vue-public-api-classifications.json',
        ]
      : [
          ...walkFiles(
            path.join(root, 'vue/packages/components'),
            (file) => /\.(ts|vue|json)$/.test(file) && !file.includes('__tests__'),
          ).map((file) => toPosix(path.relative(root, file))),
          ...walkFiles(
            path.join(root, 'vue/packages/hooks'),
            (file) => /\.ts$/.test(file) && !file.includes('__tests__'),
          ).map((file) => toPosix(path.relative(root, file))),
          ...walkFiles(path.join(root, 'vue/packages/constants'), (file) =>
            /\.ts$/.test(file),
          ).map((file) => toPosix(path.relative(root, file))),
          ...walkFiles(
            path.join(root, 'vue/packages/utils'),
            (file) => /\.ts$/.test(file) && !file.includes('__tests__'),
          ).map((file) => toPosix(path.relative(root, file))),
          'vue/packages/components/motion.ts',
          'vue/packages/element-plus/package.json',
          'spec/baselines/vue-public-api-classifications.json',
        ],
  )
  const structuredOutputSelectionHash = hashFiles(root, [
    'spec/components/contracts/v2/semantic-member-bindings.json',
  ])

  const baseline = {
    schemaVersion: 1,
    source: {
      commitSha: options.commitShaOverride ?? getGitSha(root),
      packageName: packageJson.name,
      packageVersion: packageJson.version,
      tokenHash: hashFiles(root, tokenFiles),
      iconHash: hashFiles(root, iconFiles),
      toolVersion: `avalonia-vue-public-api-baseline@${semanticVersion}+vue-semantic-baseline@${semanticVersion}`,
      inputTreeHash,
      compilerOptionsHash,
      dependencyVersionHash,
      structuredOutputSelectionHash,
      contractSchemaVersion: '2.0.0',
      outputHash: '',
    },
    summary: {
      componentModules: componentModules.length,
      components: components.length,
      installableComponents: componentImportInfo.installed.length,
      directives: directives.length,
      services: services.length,
      plugins: plugins.length,
      cssVariables: cssVariables.length,
      deprecatedApis: deprecatedApis.length,
      componentCountByClassification,
    },
    installableComponents: componentImportInfo.installed.map((name) => ({
      name,
      module: componentImportInfo.imports.get(name),
    })),
    components: components.sort((a, b) => a.name.localeCompare(b.name)),
    directives,
    services,
    plugins,
    cssVariables,
    deprecatedApis,
    entryPoints,
    webOnlyApis: uniqueSorted([
      ...components
        .filter((component) => component.classification === 'web-only')
        .map((component) => component.name),
      ...directives
        .filter((directive) => directive.classification === 'web-only')
        .map((directive) => directive.name),
      ...services
        .filter((service) => service.classification === 'web-only')
        .map((service) => service.name),
      ...plugins
        .filter((plugin) => plugin.classification === 'web-only')
        .map((plugin) => plugin.name),
    ]),
  }

  baseline.source.outputHash = sha256(
    stableJson({
      ...baseline,
      source: { ...baseline.source, outputHash: '' },
    }),
  )

  return {
    baseline,
    report: renderReport(baseline),
  }
}

const renderReport = (baseline) => {
  const rows = baseline.components
    .map(
      (component) =>
        `| \`${component.name}\` | \`${component.module}\` | ${component.classification} | ${component.props.length} | ${component.emits.length} | ${component.slots.map((slot) => (slot.scoped ? `${slot.name}*` : slot.name)).join(', ') || '-'} | ${component.exposed.join(', ') || '-'} |`,
    )
    .join('\n')

  const classificationRows = Object.entries(
    baseline.summary.componentCountByClassification,
  )
    .map(([classification, count]) => `| ${classification} | ${count} |`)
    .join('\n')

  return `# Vue Public API Baseline

This file is generated by \`pnpm run avalonia:baseline\`. Update the generator input or Vue API source first, then regenerate this report and \`spec/baselines/vue-current.json\`.

## Capture

| Field | Value |
| --- | --- |
| Commit | \`${baseline.source.commitSha}\` |
| Package | \`${baseline.source.packageName}@${baseline.source.packageVersion}\` |
| Token hash | \`${baseline.source.tokenHash}\` |
| Icon hash | \`${baseline.source.iconHash}\` |

## Summary

| Area | Count |
| --- | ---: |
| Component modules | ${baseline.summary.componentModules} |
| Public component exports | ${baseline.summary.components} |
| Installable components | ${baseline.summary.installableComponents} |
| Directives | ${baseline.summary.directives} |
| Services | ${baseline.summary.services} |
| Plugins | ${baseline.summary.plugins} |
| CSS variables | ${baseline.summary.cssVariables} |
| Deprecated API markers | ${baseline.summary.deprecatedApis} |

## Classification

| Classification | Component exports |
| --- | ---: |
${classificationRows}

## Components

| Export | Module | Classification | Props | Emits | Slots | Exposed |
| --- | --- | --- | ---: | ---: | --- | --- |
${rows}

Slots marked with \`*\` are scoped slots in the Vue baseline.

## Directives And Services

Directives: ${baseline.directives.map((directive) => `\`${directive.name}\``).join(', ') || '-'}

Services: ${baseline.services.map((service) => `\`${service.name}\``).join(', ') || '-'}

## Web-Only APIs

${baseline.webOnlyApis.map((name) => `- \`${name}\``).join('\n') || '- None'}
`
}

const runFixtureAssertions = () => {
  const fixtureRoot = path.join(
    defaultRoot,
    'tests/fixtures/vue-public-api-baseline',
  )
  if (!exists(fixtureRoot)) return
  const { baseline } = buildArtifacts(fixtureRoot, {
    commitShaOverride: 'fixture-sha',
  })
  const widget = baseline.components.find(
    (component) => component.name === 'ElFixtureWidget',
  )
  if (!widget) throw new Error('fixture widget missing from baseline')
  const optionsWidget = baseline.components.find(
    (component) => component.name === 'ElFixtureOptionsWidget',
  )
  if (!optionsWidget)
    throw new Error('fixture options widget missing from baseline')
  if (
    optionsWidget.props.includes('emit') ||
    optionsWidget.emits.includes('emit')
  ) {
    throw new Error(
      'Options API setup context was misclassified as a prop or emit',
    )
  }
  const tsxWidget = baseline.components.find(
    (component) => component.name === 'ElFixtureTsxWidget',
  )
  if (!tsxWidget) throw new Error('fixture TSX widget missing from baseline')
  if (
    tsxWidget.source !==
    'vue/packages/components/fixture-tsx-widget/src/fixture-tsx-surface.tsx'
  ) {
    throw new Error('fixture TSX widget source identity was not exact')
  }
  for (const prop of ['count', 'label']) {
    if (!tsxWidget.semantic.props.some((item) => item.name === prop)) {
      throw new Error(
        `fixture TSX widget imported prop ${prop} was not extracted`,
      )
    }
  }
  if (!tsxWidget.semantic.emits.some((item) => item.name === 'submit')) {
    throw new Error('fixture TSX widget emit submit was not extracted')
  }
  if (!tsxWidget.semantic.exposed.some((item) => item.name === 'focus')) {
    throw new Error('fixture TSX widget exposed member focus was not extracted')
  }
  if (
    !tsxWidget.semantic.slots.some(
      (slot) => slot.name === 'default' && slot.scoped,
    )
  ) {
    throw new Error('fixture TSX widget scoped default slot was not extracted')
  }
  for (const prop of ['label', 'legacyMode', 'modelValue']) {
    if (!widget.props.includes(prop)) {
      throw new Error(`fixture widget prop ${prop} was not extracted`)
    }
  }
  for (const eventName of ['submit', '[UPDATE_MODEL_EVENT]']) {
    if (!widget.emits.includes(eventName)) {
      throw new Error(`fixture widget emit ${eventName} was not extracted`)
    }
  }
  for (const slotName of ['default', 'actions', 'item']) {
    if (!widget.slots.some((slot) => slot.name === slotName)) {
      throw new Error(`fixture widget slot ${slotName} was not extracted`)
    }
  }
  if (!widget.slots.some((slot) => slot.name === 'item' && slot.scoped)) {
    throw new Error('fixture scoped slot was not extracted')
  }
  for (const exposed of ['focus', 'reset']) {
    if (!widget.exposed.includes(exposed)) {
      throw new Error(
        `fixture widget exposed member ${exposed} was not extracted`,
      )
    }
  }
  if (
    !baseline.deprecatedApis.some((api) => api.target.includes('legacyMode'))
  ) {
    throw new Error('fixture deprecated prop marker was not extracted')
  }
  if (
    !baseline.services.some((service) => service.name === 'ElFixtureService')
  ) {
    throw new Error('fixture service was not extracted')
  }
  if (
    !baseline.directives.some(
      (directive) => directive.name === 'ElFixtureDirective',
    )
  ) {
    throw new Error('fixture directive was not extracted')
  }
}

const main = async () => {
  runFixtureAssertions()

  const baselineFile = path.join(defaultRoot, 'spec/baselines/vue-current.json')
  const reportFile = path.join(
    defaultRoot,
    'docs/avalonia/vue-public-api-baseline.md',
  )
  const existingBaseline =
    checkMode && exists(baselineFile) ? parseJson(baselineFile) : undefined
  const { baseline, report } = buildArtifacts(defaultRoot, {
    commitShaOverride: existingBaseline?.source?.commitSha,
  })

  const nextBaseline = await formatGenerated(baselineFile, stableJson(baseline))
  const nextReport = await formatGenerated(reportFile, report)
  if (checkMode) {
    const currentBaseline = exists(baselineFile) ? read(baselineFile) : ''
    const currentReport = exists(reportFile) ? read(reportFile) : ''
    const failures = []
    if (currentBaseline !== nextBaseline) failures.push(baselineFile)
    if (currentReport !== nextReport) failures.push(reportFile)
    if (failures.length) {
      console.error(
        `Avalonia Vue public API baseline is stale:\n${failures
          .map((file) => `- ${toPosix(path.relative(defaultRoot, file))}`)
          .join('\n')}\nRun pnpm run avalonia:baseline and commit the result.`,
      )
      process.exitCode = 1
      return
    }
    console.log('avalonia:baseline:check passed')
    return
  }

  if (writeMode) {
    write(baselineFile, nextBaseline)
    write(reportFile, nextReport)
    console.log('avalonia:baseline generated')
  }
}

const isMain =
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href

if (isMain) {
  try {
    await main()
  } catch (error) {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  }
}
