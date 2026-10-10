import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { execFileSync } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { parse as parseScript } from '@babel/parser'
import { parse as parseSfc } from 'vue/compiler-sfc'
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

const findMatchingBrace = (source, openIndex) => {
  let depth = 0
  let quote = ''
  let escaped = false
  let lineComment = false
  let blockComment = false

  for (let index = openIndex; index < source.length; index += 1) {
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
    if (char === '{') depth += 1
    if (char === '}') {
      depth -= 1
      if (depth === 0) return index
    }
  }
  return -1
}

const splitTopLevel = (source) => {
  const parts = []
  let start = 0
  let depth = 0
  let quote = ''
  let escaped = false
  let lineComment = false
  let blockComment = false

  for (let index = 0; index < source.length; index += 1) {
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
    if ('{[('.includes(char)) depth += 1
    if ('}])'.includes(char)) depth -= 1
    if (char === ',' && depth === 0) {
      parts.push(source.slice(start, index))
      start = index + 1
    }
  }
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

const parseDeprecatedApis = (root) => {
  const files = walkFiles(path.join(root, 'vue/packages/components'), (file) =>
    /\.(ts|vue)$/.test(file),
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
  const packageFile = path.join(root, 'vue/packages/element-plus/package.json')
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
  const files = walkFiles(
    path.join(root, 'vue/packages/theme-chalk/src'),
    (file) => /\.(scss|css)$/.test(file),
  )
  const variables = new Map()
  for (const file of files) {
    const content = read(file)
    for (const match of content.matchAll(/--(?:el|fsus)-[A-Za-z0-9-]+/g)) {
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
  const moduleRoot = path.join(root, 'vue/packages/components', moduleName)
  const files = walkFiles(moduleRoot, (file) => /\.(ts|tsx|vue)$/.test(file))
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

// Options props belong to the selected component binding, including an empty
// binding. A sibling export is never evidence for an unresolved expression.
const selectedOptionsProps = (
  root,
  moduleName,
  sources,
  exportName,
  vueSource,
) => {
  const absent = { state: 'absent', selected: false, props: [] }
  const unresolved = { state: 'unresolved', selected: true, props: [] }
  if (!vueSource?.relativePath.endsWith('.vue')) return absent
  const { descriptor } = parseSfc(vueSource.content)
  if (descriptor.scriptSetup || !descriptor.script) return absent
  const modules = new Map()
  const unwrap = (node) => {
    while (
      node &&
      [
        'TSAsExpression',
        'TSTypeAssertion',
        'TSSatisfiesExpression',
        'TSNonNullExpression',
        'ParenthesizedExpression',
      ].includes(node.type)
    )
      node = node.expression
    return node
  }
  const load = (file) => {
    if (modules.has(file)) return modules.get(file)
    modules.set(file, null)
    if (!file.startsWith(`${path.resolve(root)}${path.sep}`) || !exists(file))
      return null
    let content = read(file)
    if (file.endsWith('.vue')) {
      const { descriptor } = parseSfc(content, { filename: file })
      if (descriptor.scriptSetup || !descriptor.script) return null
      content = descriptor.script.content
    }
    let ast
    try {
      ast = parseScript(content, {
        sourceType: 'module',
        plugins: ['typescript', 'jsx'],
      })
    } catch {
      return null
    }
    const module = {
      file,
      locals: new Map(),
      imports: new Map(),
      exports: new Map(),
      stars: [],
    }
    const declarations = (node) => {
      if (node?.type !== 'VariableDeclaration') return
      for (const declaration of node.declarations) {
        if (declaration.id.type === 'Identifier')
          module.locals.set(declaration.id.name, declaration.init)
      }
    }
    for (const node of ast.program.body) {
      declarations(node)
      if (node.type === 'ImportDeclaration' && node.importKind !== 'type') {
        for (const specifier of node.specifiers) {
          if (specifier.importKind === 'type') continue
          module.imports.set(specifier.local.name, {
            source: node.source.value,
            name:
              specifier.type === 'ImportSpecifier'
                ? (specifier.imported.name ?? specifier.imported.value)
                : specifier.type === 'ImportDefaultSpecifier'
                  ? 'default'
                  : '*',
          })
        }
      }
      if (
        node.type === 'ExportNamedDeclaration' &&
        node.exportKind !== 'type'
      ) {
        declarations(node.declaration)
        if (node.declaration?.type === 'VariableDeclaration') {
          for (const declaration of node.declaration.declarations) {
            if (declaration.id.type === 'Identifier')
              module.exports.set(declaration.id.name, {
                local: declaration.id.name,
              })
          }
        }
        for (const specifier of node.specifiers ?? []) {
          if (
            specifier.type !== 'ExportSpecifier' ||
            specifier.exportKind === 'type'
          )
            continue
          module.exports.set(
            specifier.exported.name ?? specifier.exported.value,
            {
              local: specifier.local.name ?? specifier.local.value,
              source: node.source?.value,
            },
          )
        }
      }
      if (node.type === 'ExportDefaultDeclaration')
        module.exports.set('default', { node: node.declaration })
      if (node.type === 'ExportAllDeclaration' && node.exportKind !== 'type')
        module.stars.push(node.source.value)
    }
    modules.set(file, module)
    return module
  }
  const importedModule = (specifier, module) => {
    let base
    if (specifier.startsWith('.'))
      base = path.resolve(path.dirname(module.file), specifier)
    else if (specifier.startsWith('@element-plus/'))
      base = path.resolve(
        root,
        'vue/packages',
        specifier.slice('@element-plus/'.length),
      )
    else return null
    for (const file of [
      base,
      `${base}.ts`,
      `${base}.tsx`,
      `${base}.js`,
      `${base}.vue`,
      path.join(base, 'index.ts'),
      path.join(base, 'index.js'),
    ]) {
      if (exists(file) && fs.statSync(file).isFile()) return load(file)
    }
    return null
  }
  const declaresExport = (name, module, active = new Set()) => {
    if (module.exports.has(name)) return true
    if (name === 'default' || active.has(module.file)) return false
    const next = new Set([...active, module.file])
    return module.stars.some((source) => {
      const owner = importedModule(source, module)
      return owner && declaresExport(name, owner, next)
    })
  }
  const exportValue = (name, module, active, mode) => {
    const key = `${module.file}:export:${name}`
    if (active.has(key)) return null
    const next = new Set([...active, key])
    const binding = module.exports.get(name)
    if (!binding) {
      if (name === 'default') return null
      const owners = []
      for (const source of module.stars) {
        const owner = importedModule(source, module)
        if (!owner) return null
        const candidate = exportValue(name, owner, next, mode)
        if (!candidate && declaresExport(name, owner)) return null
        if (
          candidate &&
          !owners.some(
            (item) =>
              item.node === candidate.node && item.module === candidate.module,
          )
        )
          owners.push(candidate)
      }
      return owners.length === 1 ? owners[0] : null
    }
    if (binding.source) {
      const owner = importedModule(binding.source, module)
      return owner ? exportValue(binding.local, owner, next, mode) : null
    }
    return binding.node
      ? value(binding.node, module, next, mode)
      : localValue(binding.local, module, next, mode)
  }
  const localValue = (name, module, active, mode) => {
    const key = `${module.file}:local:${name}`
    if (active.has(key)) return null
    const next = new Set([...active, key])
    if (module.locals.has(name))
      return value(module.locals.get(name), module, next, mode)
    const binding = module.imports.get(name)
    if (!binding || binding.name === '*') return null
    const owner = importedModule(binding.source, module)
    return owner ? exportValue(binding.name, owner, next, mode) : null
  }
  const propertyName = (property, module, active) => {
    if (!property.computed && property.key.type === 'Identifier')
      return property.key.name
    const key = value(property.key, module, active, 'props')?.node
    return key && ['StringLiteral', 'NumericLiteral'].includes(key.type)
      ? String(key.value)
      : null
  }
  const value = (expression, module, active, mode) => {
    const node = unwrap(expression)
    if (!node) return null
    if (node.type === 'Identifier')
      return localValue(node.name, module, active, mode)
    if (node.type === 'CallExpression' && node.callee.type === 'Identifier') {
      const binding = module.imports.get(node.callee.name)
      const allowed =
        mode === 'options'
          ? (binding?.source === 'vue' && binding.name === 'defineComponent') ||
            (binding?.source === '@element-plus/utils' &&
              ['withInstall', 'withNoopInstall'].includes(binding.name))
          : binding?.source === '@element-plus/utils' &&
            binding.name === 'buildProps'
      return allowed ? value(node.arguments[0], module, active, mode) : null
    }
    if (node.type === 'MemberExpression') {
      const name = propertyName(
        { key: node.property, computed: node.computed },
        module,
        active,
      )
      if (name === null) return null
      const namespace =
        node.object.type === 'Identifier' &&
        module.imports.get(node.object.name)
      if (namespace?.name === '*') {
        const owner = importedModule(namespace.source, module)
        return owner ? exportValue(name, owner, active, mode) : null
      }
      const owner = value(
        node.object,
        module,
        active,
        name === 'props' ? 'options' : mode,
      )
      if (owner?.node.type !== 'ObjectExpression') return null
      const property = selectedProperty(
        owner,
        name,
        name === 'props' ? 'options' : mode,
        mode,
      )
      return property.state === 'resolved' ? property.value : null
    }
    return { node, module, active }
  }
  const selectedProperty = (owner, name, ownerMode, valueMode) => {
    if (owner?.node.type !== 'ObjectExpression') return { state: 'unresolved' }
    let selected = { state: 'absent' }
    for (const property of owner.node.properties) {
      if (property.type === 'SpreadElement') {
        const spread = selectedProperty(
          value(property.argument, owner.module, owner.active, ownerMode),
          name,
          ownerMode,
          valueMode,
        )
        if (spread.state !== 'absent') selected = spread
        continue
      }
      const key = propertyName(property, owner.module, owner.active)
      if (key === null) {
        selected = { state: 'unresolved' }
      } else if (key === name) {
        const resolved =
          property.type === 'ObjectProperty' &&
          value(property.value, owner.module, owner.active, valueMode)
        selected = resolved
          ? { state: 'resolved', value: resolved }
          : { state: 'unresolved' }
      }
    }
    return selected
  }
  const names = (resolved) => {
    if (!resolved) return null
    const { node, module, active } = resolved
    if (node.type === 'ArrayExpression') {
      const result = node.elements.map(
        (item) => value(item, module, active, 'props')?.node,
      )
      return result.every((item) => item?.type === 'StringLiteral')
        ? result.map((item) => item.value)
        : null
    }
    if (node.type !== 'ObjectExpression') return null
    const result = []
    for (const property of node.properties) {
      if (property.type === 'SpreadElement') {
        const spread = names(value(property.argument, module, active, 'props'))
        if (spread === null) return null
        result.push(...spread)
      } else {
        const name = propertyName(property, module, active)
        if (name === null) return null
        result.push(name)
      }
    }
    return result
  }
  // The public export identifies the owner even when legacy source selection
  // falls back to a different SFC in the same module.
  const entry = sources.find(
    (source) =>
      source.relativePath === `vue/packages/components/${moduleName}/index.ts`,
  )
  const module = entry && load(path.resolve(root, entry.relativePath))
  if (!module) return unresolved
  const options = exportValue(exportName, module, new Set(), 'options')
  if (options?.node.type !== 'ObjectExpression') return unresolved
  const props = selectedProperty(options, 'props', 'options', 'props')
  if (props.state === 'absent') return { ...absent, selected: true }
  if (props.state === 'unresolved') return unresolved
  const result = names(props.value)
  return result === null
    ? unresolved
    : { state: 'resolved', selected: true, props: uniqueSorted(result) }
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
  const optionsProps = selectedOptionsProps(
    root,
    moduleName,
    sources,
    exportName,
    vueSource,
  )
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

  return {
    name: exportName,
    module: moduleName,
    classification,
    source: vueSource?.relativePath ?? null,
    props: optionsProps.selected
      ? optionsProps.props
      : uniqueSorted([...fromVue.props, ...fallback.props]),
    emits: uniqueSorted([...fromVue.emits, ...fallback.emits]),
    slots: slotSemantics.semanticSlots,
    exposed: vueSource ? parseDefineExpose(vueSource.content) : [],
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
) => {
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
  const packageJson = parseJson(
    path.join(root, 'vue/packages/element-plus/package.json'),
  )
  const componentModules = parseComponentIndexModules(root)
  const componentImportInfo = parseComponentImports(root)

  const components = []
  for (const moduleName of componentModules) {
    const classification = requiredClassification(
      classifications.componentModules,
      moduleName,
      `component module ${moduleName}`,
    )
    const publicExports = parsePublicExports(root, moduleName)
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
  )
  const cssVariables = parseCssVariables(root)
  const entryPoints = parseEntryPoints(root, classifications)
  const deprecatedApis = parseDeprecatedApis(root)

  const tokenFiles = [
    'spec/tokens/tokens.json',
    'vue/packages/theme-chalk/src/generated/tokens.json',
    'vue/packages/theme-chalk/src/generated/tokens.css',
    'vue/packages/theme-chalk/src/generated/tokens.scss',
  ]
  const iconFiles = [
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
  const inputTreeHash = hashFiles(root, [
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
  ])
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
      toolVersion: `avalonia-vue-public-api-baseline@1.4.2+vue-semantic-baseline@${semanticVersion}`,
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
