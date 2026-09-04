import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import babelParser from '@babel/parser'
import { parse as parseSfc } from 'vue/compiler-sfc'
import { extractStructuredEmitPayloads } from './vue-structured-emit-payload.mjs'
import { extractStructuredExposedSignatures } from './vue-structured-exposed-signature.mjs'

const { parse: babelParse } = babelParser

const RUNTIME_TYPE_NAMES = new Set([
  'String',
  'Number',
  'Boolean',
  'Array',
  'Object',
  'Function',
  'Date',
  'Symbol',
  'BigInt',
  'null',
  'undefined',
  'Promise',
  'RegExp',
])

const walkNodes = (node, visit) => {
  if (!node || typeof node !== 'object') return
  if (Array.isArray(node)) {
    for (const item of node) walkNodes(item, visit)
    return
  }
  visit(node)
  for (const key of Object.keys(node)) {
    if (key === 'loc' || key === 'start' || key === 'end' || key === 'tokens')
      continue
    const value = node[key]
    if (Array.isArray(value)) {
      for (const item of value) walkNodes(item, visit)
    } else if (value && typeof value === 'object') {
      walkNodes(value, visit)
    }
  }
}

const sha256 = (value) =>
  crypto.createHash('sha256').update(value).digest('hex')

const normalizeJsDocLine = (line) =>
  line
    .trim()
    .replace(/^\*+\s?/u, '')
    .trim()

export const deprecatedMetadataForNode = (node) => {
  const comment = [...(node?.leadingComments ?? [])]
    .reverse()
    .find((candidate) => /@deprecated\b/u.test(candidate.value))
  if (!comment) return { deprecated: false, deprecationMessage: null }

  const lines = comment.value.split(/\r?\n/u).map(normalizeJsDocLine)
  const marker = lines.findIndex((line) => /^@deprecated\b/u.test(line))
  const message = [
    lines[marker]?.replace(/^@deprecated\b\s*/u, '') ?? '',
    ...lines.slice(marker + 1).filter((line) => !line.startsWith('@')),
  ]
    .filter(Boolean)
    .join(' ')
    .trim()
  return {
    deprecated: true,
    deprecationMessage: message || null,
  }
}

const declarationNames = (node) => {
  if (!node) return []
  if (node.type === 'ExportNamedDeclaration')
    return declarationNames(node.declaration)
  if (node.type === 'VariableDeclaration') {
    return (node.declarations ?? [])
      .map((declaration) =>
        declaration.id?.type === 'Identifier' ? declaration.id.name : null,
      )
      .filter(Boolean)
  }
  if (
    node.type === 'TSTypeAliasDeclaration' ||
    node.type === 'TSInterfaceDeclaration' ||
    node.type === 'ClassDeclaration' ||
    node.type === 'FunctionDeclaration'
  ) {
    return node.id?.name ? [node.id.name] : []
  }
  if (
    node.type === 'ObjectProperty' ||
    node.type === 'ObjectMethod' ||
    node.type === 'TSPropertySignature' ||
    node.type === 'TSMethodSignature'
  ) {
    if (node.key?.type === 'Identifier') return [node.key.name]
    if (node.key?.type === 'StringLiteral') return [node.key.value]
  }
  if (
    node.type === 'StringLiteral' ||
    node.type === 'NumericLiteral' ||
    node.type === 'BooleanLiteral'
  ) {
    return [String(node.value)]
  }
  return []
}

const declarationKind = (node) => {
  const target =
    node?.type === 'ExportNamedDeclaration' ? node.declaration : node
  if (target?.type === 'ObjectProperty' || target?.type === 'ObjectMethod')
    return 'property'
  if (
    target?.type === 'StringLiteral' ||
    target?.type === 'NumericLiteral' ||
    target?.type === 'BooleanLiteral'
  )
    return 'literal-value'
  if (node?.type === 'ExportNamedDeclaration') return 'export'
  return 'declaration'
}

export const extractDeprecatedDeclarations = ({ source, filename }) => {
  const scriptSources = []
  if (filename.endsWith('.vue')) {
    const { descriptor } = parseSfc(source, { filename })
    if (descriptor.script?.content)
      scriptSources.push(descriptor.script.content)
    if (descriptor.scriptSetup?.content)
      scriptSources.push(descriptor.scriptSetup.content)
  } else {
    scriptSources.push(source)
  }

  const declarations = []
  for (const scriptSource of scriptSources) {
    let parsed
    try {
      parsed = babelParse(scriptSource, {
        sourceType: 'module',
        plugins: [
          'typescript',
          'jsx',
          'decorators-legacy',
          'importAttributes',
          'topLevelAwait',
        ],
        errorRecovery: true,
        allowReturnOutsideFunction: true,
      })
    } catch {
      continue
    }
    walkNodes(parsed.program.body, (node) => {
      const metadata = deprecatedMetadataForNode(node)
      if (!metadata.deprecated) return
      for (const target of declarationNames(node)) {
        declarations.push({
          kind: declarationKind(node),
          target,
          message: metadata.deprecationMessage,
        })
      }
    })
  }
  const unique = new Map()
  for (const declaration of declarations) {
    unique.set(
      `${declaration.kind}\u0000${declaration.target}\u0000${declaration.message ?? ''}`,
      declaration,
    )
  }
  return [...unique.values()].sort(
    (first, second) =>
      first.target.localeCompare(second.target) ||
      first.kind.localeCompare(second.kind),
  )
}

const staticStringExpression = (expression) => {
  if (expression?.type !== 4) return null
  const value = expression.content.trim()
  const match = value.match(/^(['"])(.*)\1$/su)
  return match ? match[2] : null
}

const slotIdentity = ({ name, nameKnown, nameExpression }) =>
  nameKnown ? name : `$dynamic:${nameExpression?.trim() || 'unknown'}`

export const extractTemplateSlots = (templateAst) => {
  const slots = []
  walkNodes(templateAst, (node) => {
    if (node.type !== 1 || node.tag !== 'slot') return
    let name = 'default'
    let nameKnown = true
    let nameExpression = null
    let payloadComplete = true
    const payload = []

    for (const property of node.props ?? []) {
      if (property.type === 6 && property.name === 'name') {
        if (property.value?.content) {
          name = property.value.content
        } else {
          nameKnown = false
          nameExpression = null
        }
        continue
      }
      if (property.type !== 7 || property.name !== 'bind') continue

      if (property.arg?.type === 4 && property.arg.isStatic) {
        if (property.arg.content === 'name') {
          const literalName = staticStringExpression(property.exp)
          if (literalName == null) {
            nameKnown = false
            nameExpression = property.exp?.content ?? null
          } else {
            name = literalName
          }
          continue
        }
        payload.push({
          name: property.arg.content,
          expression: property.exp?.content ?? null,
          type: null,
        })
        continue
      }

      payloadComplete = false
    }

    const slot = {
      name: slotIdentity({ name, nameKnown, nameExpression }),
      nameKnown,
      scoped: payload.length > 0 || !payloadComplete,
      payload: payload.sort((first, second) =>
        first.name.localeCompare(second.name),
      ),
      payloadComplete,
    }
    if (!nameKnown) slot.nameExpression = nameExpression
    slots.push(slot)
  })

  const byName = new Map()
  for (const slot of slots) {
    const current = byName.get(slot.name)
    if (!current) {
      byName.set(slot.name, slot)
      continue
    }
    const payload = new Map(
      [...current.payload, ...slot.payload].map((field) => [field.name, field]),
    )
    byName.set(slot.name, {
      ...current,
      scoped: current.scoped || slot.scoped,
      payload: [...payload.values()].sort((first, second) =>
        first.name.localeCompare(second.name),
      ),
      payloadComplete: current.payloadComplete && slot.payloadComplete,
    })
  }
  return [...byName.values()].sort((first, second) =>
    first.name.localeCompare(second.name),
  )
}

class SemanticResolver {
  constructor(root, moduleSources) {
    this.root = root
    this.moduleSources = moduleSources
    this.cache = new Map()
    this.constSearchCache = new Map()
    this.vueFileCache = new Map()
    this.sharedRoots = [
      'vue/packages/hooks',
      'vue/packages/constants',
      'vue/packages/utils',
      'vue/packages/components/motion.ts',
      'vue/packages/components',
    ]
  }

  readSource(relPath) {
    if (this.cache.has(relPath)) return this.cache.get(relPath)
    const fullPath = path.join(this.root, relPath)
    let content = null
    if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
      content = fs.readFileSync(fullPath, 'utf8')
    }
    this.cache.set(relPath, content)
    return content
  }

  moduleRelPaths() {
    return this.moduleSources.map((item) => item.relativePath)
  }

  parseTsModule(relPath) {
    const content = this.readSource(relPath)
    if (content === null) return null
    let ast
    try {
      ast = babelParse(content, {
        sourceType: 'module',
        plugins: [
          'typescript',
          'jsx',
          'decorators-legacy',
          'importAttributes',
          'topLevelAwait',
        ],
        errorRecovery: true,
        allowReturnOutsideFunction: true,
      })
    } catch {
      return null
    }
    const consts = new Map()
    const functions = new Map()
    const imports = new Map()
    for (const node of ast.program.body) {
      if (node.type === 'ImportDeclaration') {
        for (const spec of node.specifiers || []) {
          if (spec.type === 'ImportSpecifier') {
            const local = spec.local.name
            const imported =
              spec.imported.type === 'Identifier'
                ? spec.imported.name
                : spec.imported.value
            imports.set(local, { spec: node.source.value, imported })
          } else if (
            spec.type === 'ImportDefaultSpecifier' ||
            spec.type === 'ImportNamespaceSpecifier'
          ) {
            imports.set(spec.local.name, {
              spec: node.source.value,
              imported: null,
            })
          }
        }
      }
      if (node.type === 'ExportNamedDeclaration' && node.declaration) {
        if (node.declaration.type === 'VariableDeclaration') {
          for (const decl of node.declaration.declarations) {
            if (decl.id.type === 'Identifier')
              consts.set(decl.id.name, decl.init)
          }
        }
        if (
          node.declaration.type === 'FunctionDeclaration' &&
          node.declaration.id
        ) {
          functions.set(node.declaration.id.name, node.declaration)
        }
      }
      if (node.type === 'VariableDeclaration') {
        for (const decl of node.declarations) {
          if (decl.id.type === 'Identifier') consts.set(decl.id.name, decl.init)
        }
      }
      if (node.type === 'FunctionDeclaration' && node.id) {
        functions.set(node.id.name, node)
      }
    }
    return { ast, consts, functions, imports, content, relPath }
  }

  parseVueModule(relPath) {
    const content = this.readSource(relPath)
    if (content === null) return null
    if (this.vueFileCache.has(relPath)) return this.vueFileCache.get(relPath)
    let result = null
    try {
      const { descriptor } = parseSfc(content, {
        filename: path.basename(relPath),
      })
      const setup = descriptor.scriptSetup?.content
      const plain = descriptor.script?.content
      const scriptAst = setup ? null : plain || null
      const consts = new Map()
      const functions = new Map()
      const imports = new Map()
      let macroCalls = []
      if (setup) {
        const parsed = babelParse(setup, {
          sourceType: 'module',
          plugins: ['typescript', 'jsx', 'importAttributes', 'topLevelAwait'],
          errorRecovery: true,
        })
        const statements = parsed.program.body
        for (const node of statements) {
          if (node.type === 'ImportDeclaration') {
            for (const spec of node.specifiers || []) {
              if (spec.type === 'ImportSpecifier') {
                imports.set(spec.local.name, {
                  spec: node.source.value,
                  imported:
                    spec.imported.type === 'Identifier'
                      ? spec.imported.name
                      : spec.imported.value,
                })
              } else if (
                spec.type === 'ImportDefaultSpecifier' ||
                spec.type === 'ImportNamespaceSpecifier'
              ) {
                imports.set(spec.local.name, {
                  spec: node.source.value,
                  imported: null,
                })
              }
            }
          }
          if (node.type === 'VariableDeclaration') {
            for (const decl of node.declarations) {
              if (decl.id.type === 'Identifier')
                consts.set(decl.id.name, decl.init)
            }
          }
          if (node.type === 'FunctionDeclaration' && node.id)
            functions.set(node.id.name, node)
        }
        walkNodes(statements, (node) => {
          if (
            node.type === 'CallExpression' &&
            node.callee?.type === 'Identifier' &&
            ['defineProps', 'defineEmits', 'defineExpose'].includes(
              node.callee.name,
            )
          ) {
            macroCalls.push(node)
          }
        })
      } else if (plain) {
        const parsed = babelParse(plain, {
          sourceType: 'module',
          plugins: ['typescript', 'jsx', 'importAttributes', 'topLevelAwait'],
          errorRecovery: true,
        })
        for (const node of parsed.program.body) {
          if (node.type === 'ImportDeclaration') {
            for (const spec of node.specifiers || []) {
              if (spec.type === 'ImportSpecifier') {
                imports.set(spec.local.name, {
                  spec: node.source.value,
                  imported:
                    spec.imported.type === 'Identifier'
                      ? spec.imported.name
                      : spec.imported.value,
                })
              } else if (
                spec.type === 'ImportDefaultSpecifier' ||
                spec.type === 'ImportNamespaceSpecifier'
              ) {
                imports.set(spec.local.name, {
                  spec: node.source.value,
                  imported: null,
                })
              }
            }
          }
          if (node.type === 'VariableDeclaration') {
            for (const decl of node.declarations) {
              if (decl.id.type === 'Identifier')
                consts.set(decl.id.name, decl.init)
            }
          }
          if (node.type === 'FunctionDeclaration' && node.id)
            functions.set(node.id.name, node)
        }
        macroCalls = []
      }
      result = {
        content,
        consts,
        functions,
        imports,
        macroCalls,
        setup,
        scriptAst,
        templateAst: descriptor.template?.ast ?? null,
      }
    } catch {
      result = null
    }
    this.vueFileCache.set(relPath, result)
    return result
  }

  resolveSpecFile(spec, fromRelPath) {
    const fromDir = path.posix.dirname(fromRelPath)
    if (spec.startsWith('.')) {
      const candidates = [
        `${spec}.ts`,
        `${spec}.vue`,
        `${spec}.js`,
        `${spec}/index.ts`,
        `${spec}/index.js`,
      ]
      for (const candidate of candidates) {
        const rel = path.posix.normalize(path.posix.join(fromDir, candidate))
        if (this.readSource(rel) !== null) return rel
      }
      return null
    }
    if (spec === '@element-plus/icons-vue') return null
    if (spec.startsWith('@element-plus/components/')) {
      const name = spec.slice('@element-plus/components/'.length)
      const candidates = [
        `vue/packages/components/${name}/index.ts`,
        `vue/packages/components/${name}.ts`,
        `vue/packages/components/${name}/src/index.ts`,
      ]
      for (const candidate of candidates) {
        if (this.readSource(candidate) !== null) return candidate
      }
      return null
    }
    if (spec.startsWith('@element-plus/')) {
      const name = spec.slice('@element-plus/'.length)
      const candidates = [
        `vue/packages/${name}/index.ts`,
        `vue/packages/${name}.ts`,
        `vue/packages/${name}/index.js`,
      ]
      for (const candidate of candidates) {
        if (this.readSource(candidate) !== null) return candidate
      }
      return null
    }
    return null
  }

  findConstInRelPath(name, relPath) {
    const module = relPath.endsWith('.vue')
      ? this.parseVueModule(relPath)
      : this.parseTsModule(relPath)
    if (!module) return null
    if (module.consts.has(name))
      return { node: module.consts.get(name), relPath }
    return null
  }

  findExportAnywhere(name, fromRelPath) {
    const searched = new Set()
    const searchRel = (relPath) => {
      if (searched.has(relPath)) return null
      searched.add(relPath)
      if (this.readSource(relPath) === null) return null
      const module = relPath.endsWith('.vue')
        ? this.parseVueModule(relPath)
        : this.parseTsModule(relPath)
      if (!module) return null
      if (module.consts.has(name)) {
        return {
          node: module.consts.get(name),
          relPath,
          source: module.setup || module.scriptAst || module.content,
        }
      }
      return null
    }
    const moduleHit = searchRel(fromRelPath)
    if (moduleHit) return moduleHit
    if (this.constSearchCache.has(name)) return this.constSearchCache.get(name)
    const hits = []
    for (const root of this.sharedRoots) {
      const fullRoot = path.join(this.root, root)
      if (!fs.existsSync(fullRoot)) continue
      const files = []
      const walk = (dir, isFile = false) => {
        if (isFile) {
          if (dir.endsWith('.ts') && !dir.endsWith('.d.ts')) files.push(dir)
          return
        }
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          if (
            entry.name === 'node_modules' ||
            entry.name === 'dist' ||
            entry.name === 'bin' ||
            entry.name === 'obj'
          )
            continue
          const full = path.join(dir, entry.name)
          if (entry.isDirectory()) walk(full)
          else if (
            entry.name.endsWith('.ts') &&
            !entry.name.endsWith('.d.ts') &&
            !entry.name.endsWith('.test.ts')
          )
            files.push(full)
        }
      }
      walk(fullRoot, fs.statSync(fullRoot).isFile())
      for (const file of files) {
        const content = fs.readFileSync(file, 'utf8')
        if (
          !new RegExp(`(?:export\\s+)?const\\s+${name}\\s*=`, 'u').test(content)
        )
          continue
        const rel = path.relative(this.root, file).split(path.sep).join('/')
        const hit = searchRel(rel)
        if (hit) {
          hits.push(hit)
          break
        }
      }
      if (hits.length) break
    }
    const best = hits[0] || null
    this.constSearchCache.set(name, best)
    return best
  }

  resolveIdentifier(name, fromRelPath) {
    if (!name) return null
    const module = fromRelPath.endsWith('.vue')
      ? this.parseVueModule(fromRelPath)
      : this.parseTsModule(fromRelPath)
    if (module?.consts.has(name)) {
      return {
        node: module.consts.get(name),
        relPath: fromRelPath,
        source: module.setup || module.scriptAst || module.content,
      }
    }
    if (module?.functions.has(name)) {
      return {
        node: module.functions.get(name),
        relPath: fromRelPath,
        functionNode: true,
        source: module.setup || module.scriptAst || module.content,
      }
    }
    if (module?.imports.has(name)) {
      const imp = module.imports.get(name)
      const specFile = this.resolveSpecFile(imp.spec, fromRelPath)
      if (specFile) {
        const targetName = imp.imported || name
        const hit = this.findExportAnywhere(targetName, specFile)
        if (hit) return hit
      }
    }
    return this.findExportAnywhere(name, fromRelPath)
  }
}

const unwrapExpression = (node) => {
  let current = node
  while (
    current &&
    (current.type === 'TSAsExpression' ||
      current.type === 'TSTypeAssertion' ||
      current.type === 'ParenthesizedExpression')
  ) {
    current = current.expression
  }
  return current
}

const typeText = (node, source) => {
  if (!node) return null
  if (node.type === 'TSTypeAnnotation')
    return source.slice(node.typeAnnotation.start, node.typeAnnotation.end)
  return source.slice(node.start, node.end)
}

const literalToJson = (node, source) => {
  if (!node) return { kind: 'missing' }
  if (node.type === 'StringLiteral')
    return { kind: 'literal', value: node.value }
  if (node.type === 'NumericLiteral')
    return { kind: 'literal', value: node.value }
  if (node.type === 'BooleanLiteral')
    return { kind: 'literal', value: node.value }
  if (node.type === 'NullLiteral') return { kind: 'null', value: null }
  if (node.type === 'Identifier' && node.name === 'undefined')
    return { kind: 'undefined' }
  if (
    node.type === 'ArrowFunctionExpression' ||
    node.type === 'FunctionExpression'
  ) {
    return {
      kind: 'function',
      sourceHash: sha256(source.slice(node.start, node.end)),
    }
  }
  if (node.type === 'TemplateLiteral') {
    return { kind: 'literal', value: source.slice(node.start, node.end) }
  }
  if (
    node.type === 'UnaryExpression' &&
    node.operator === '-' &&
    node.argument?.type === 'NumericLiteral'
  ) {
    return { kind: 'literal', value: -node.argument.value }
  }
  return {
    kind: 'expression',
    sourceHash: sha256(source.slice(node.start, node.end)),
  }
}

const literalTypeValues = (node) => {
  if (!node) return { values: null, valuesKnown: false }
  if (
    node.type === 'TSParenthesizedType' ||
    node.type === 'TSOptionalType' ||
    node.type === 'TSRestType'
  ) {
    return literalTypeValues(node.typeAnnotation)
  }
  if (node.type === 'TSTypeReference' && node.typeParameters?.params?.length) {
    const name =
      node.typeName?.type === 'Identifier' ? node.typeName.name : null
    if (name === 'PropType' || name === 'Readonly') {
      return literalTypeValues(node.typeParameters.params[0])
    }
  }
  if (node.type === 'TSLiteralType') {
    if (node.literal?.type === 'StringLiteral')
      return { values: [node.literal.value], valuesKnown: true }
    if (node.literal?.type === 'NumericLiteral')
      return { values: [node.literal.value], valuesKnown: true }
    if (node.literal?.type === 'BooleanLiteral')
      return { values: [node.literal.value], valuesKnown: true }
    return { values: null, valuesKnown: false }
  }
  if (
    node.type === 'TSNullKeyword' ||
    node.type === 'TSUndefinedKeyword' ||
    node.type === 'TSVoidKeyword'
  ) {
    return { values: [], valuesKnown: true }
  }
  if (node.type !== 'TSUnionType') return { values: null, valuesKnown: false }

  const values = []
  for (const member of node.types ?? []) {
    const extracted = literalTypeValues(member)
    if (!extracted.valuesKnown) return { values: null, valuesKnown: false }
    values.push(...extracted.values)
  }
  return { values: [...new Set(values)], valuesKnown: true }
}

const arrayLiteralValues = (node) => {
  if (!node) return null
  if (node.type === 'ArrayExpression') {
    const values = []
    let valuesKnown = true
    for (const element of node.elements || []) {
      if (!element) continue
      if (element.type === 'StringLiteral') values.push(element.value)
      else if (element.type === 'NumericLiteral') values.push(element.value)
      else if (element.type === 'BooleanLiteral') values.push(element.value)
      else if (element.type === 'NullLiteral') values.push(null)
      else valuesKnown = false
    }
    return { values, valuesKnown }
  }
  return null
}

const extractTypeExpression = (typeNode, source) => {
  if (!typeNode)
    return {
      runtimeType: null,
      semanticType: null,
      nullable: false,
      values: null,
      valuesKnown: false,
    }
  if (typeNode.type === 'Identifier') {
    return {
      runtimeType: RUNTIME_TYPE_NAMES.has(typeNode.name) ? typeNode.name : null,
      semanticType: RUNTIME_TYPE_NAMES.has(typeNode.name)
        ? null
        : typeNode.name,
      nullable: false,
      values: null,
      valuesKnown: false,
    }
  }
  if (typeNode.type === 'TSAsExpression') {
    const inner = extractTypeExpression(typeNode.expression, source)
    const semantic = typeText(typeNode.typeAnnotation, source)
    const literalValues = literalTypeValues(typeNode.typeAnnotation)
    return {
      runtimeType: inner.runtimeType || null,
      semanticType: semantic,
      nullable: /\bnull\b|\bundefined\b/u.test(semantic || ''),
      values: literalValues.valuesKnown ? literalValues.values : inner.values,
      valuesKnown: literalValues.valuesKnown || inner.valuesKnown,
    }
  }
  if (typeNode.type === 'TSTypeAssertion') {
    return extractTypeExpression(typeNode.expression, source)
  }
  if (
    typeNode.type === 'CallExpression' &&
    typeNode.callee?.type === 'Identifier'
  ) {
    const callee = typeNode.callee.name
    if (callee === 'definePropType') {
      const typeParam = typeNode.typeParameters?.params?.[0]
      const semantic = typeParam ? typeText(typeParam, source) : null
      const arg = typeNode.arguments?.[0]
      let runtimeType = null
      if (arg?.type === 'Identifier')
        runtimeType = RUNTIME_TYPE_NAMES.has(arg.name) ? arg.name : arg.name
      if (arg?.type === 'ArrayExpression') runtimeType = 'Array'
      return {
        runtimeType,
        semanticType: semantic,
        nullable: /\bnull\b|\bundefined\b/u.test(semantic || ''),
        ...literalTypeValues(typeParam),
      }
    }
    return {
      runtimeType: null,
      semanticType: null,
      nullable: false,
      values: null,
      valuesKnown: false,
    }
  }
  if (typeNode.type === 'ArrayExpression') {
    const names = (typeNode.elements || []).map((el) =>
      el?.type === 'Identifier' ? el.name : null,
    )
    return {
      runtimeType: 'Array',
      semanticType: names.filter(Boolean).join(' | '),
      nullable: false,
      values: null,
      valuesKnown: false,
    }
  }
  if (
    typeNode.type === 'TSArrayType' ||
    typeNode.type === 'TSUnionType' ||
    typeNode.type === 'TSLiteralType'
  ) {
    const semantic = typeText(typeNode, source)
    return {
      runtimeType: null,
      semanticType: semantic,
      nullable: /\bnull\b|\bundefined\b/u.test(semantic || ''),
      ...literalTypeValues(typeNode),
    }
  }
  return {
    runtimeType: null,
    semanticType: null,
    nullable: false,
    values: null,
    valuesKnown: false,
  }
}

class PropDescriptorParser {
  constructor(resolver, source, fromRelPath) {
    this.resolver = resolver
    this.source = source
    this.fromRelPath = fromRelPath
  }

  parseBuildPropsObject(objectNode) {
    const result = []
    for (const property of objectNode.properties || []) {
      if (property.type === 'SpreadElement') {
        const resolved = this.resolver.resolveIdentifier(
          property.argument?.name,
          this.fromRelPath,
        )
        if (resolved?.node?.type === 'ObjectExpression') {
          result.push(...this.parseBuildPropsObject(resolved.node))
        }
        continue
      }
      if (
        property.type !== 'ObjectProperty' &&
        property.type !== 'ObjectMethod'
      )
        continue
      const name = this.propertyName(property)
      if (!name) continue
      const descriptor = this.parsePropValue(property.value, name, property)
      if (descriptor) result.push(descriptor)
    }
    return result
  }

  propertyName(property) {
    if (property.key?.type === 'Identifier') return property.key.name
    if (property.key?.type === 'StringLiteral') return property.key.value
    return null
  }

  parsePropValue(valueNode, name, declarationNode = null) {
    if (!valueNode) return null
    const deprecated = deprecatedMetadataForNode(declarationNode)
    valueNode = unwrapExpression(valueNode)
    if (valueNode.type === 'Identifier') {
      if (RUNTIME_TYPE_NAMES.has(valueNode.name)) {
        return {
          name,
          runtimeType: valueNode.name,
          semanticType: null,
          nullable: false,
          values: null,
          valuesKnown: false,
          default: { kind: 'missing' },
          required: false,
          readonly: false,
          ...deprecated,
        }
      }
      const resolved = this.resolver.resolveIdentifier(
        valueNode.name,
        this.fromRelPath,
      )
      if (!resolved?.node) {
        return {
          name,
          runtimeType: null,
          semanticType: valueNode.name,
          nullable: false,
          values: null,
          valuesKnown: false,
          default: { kind: 'missing' },
          required: false,
          readonly: false,
          ...deprecated,
        }
      }
      const sub = this.parseFromNode(resolved.node, name, resolved.relPath)
      if (sub) return { ...sub, ...deprecated }
      return {
        name,
        runtimeType: null,
        semanticType: valueNode.name,
        nullable: false,
        values: null,
        valuesKnown: false,
        default: { kind: 'missing' },
        required: false,
        readonly: false,
        ...deprecated,
      }
    }
    if (valueNode.type === 'ObjectExpression') {
      return {
        ...this.parseDescriptorObject(valueNode, name),
        ...deprecated,
      }
    }
    if (
      valueNode.type === 'CallExpression' &&
      valueNode.callee?.type === 'Identifier' &&
      valueNode.callee.name === 'buildProp'
    ) {
      const arg = unwrapExpression(valueNode.arguments?.[0])
      if (arg?.type === 'ObjectExpression')
        return {
          ...this.parseDescriptorObject(arg, name),
          ...deprecated,
        }
    }
    const typeInfo = extractTypeExpression(valueNode, this.source)
    return {
      name,
      runtimeType: typeInfo.runtimeType,
      semanticType: typeInfo.semanticType,
      nullable: typeInfo.nullable,
      values: typeInfo.values,
      valuesKnown: typeInfo.valuesKnown,
      default: { kind: 'missing' },
      required: false,
      readonly: false,
      ...deprecated,
    }
  }

  parseFromNode(node, name, relPath) {
    node = unwrapExpression(node)
    if (node.type === 'ObjectExpression') {
      const source =
        relPath === this.fromRelPath
          ? this.source
          : this.resolver.readSource(relPath) || ''
      return new PropDescriptorParser(
        this.resolver,
        source,
        relPath,
      ).parseDescriptorObject(node, name)
    }
    if (
      node.type === 'CallExpression' &&
      node.callee?.type === 'Identifier' &&
      node.callee.name === 'buildProp'
    ) {
      const arg = unwrapExpression(node.arguments?.[0])
      if (arg?.type === 'ObjectExpression') {
        const source =
          relPath === this.fromRelPath
            ? this.source
            : this.resolver.readSource(relPath) || ''
        return new PropDescriptorParser(
          this.resolver,
          source,
          relPath,
        ).parseDescriptorObject(arg, name)
      }
    }
    if (
      node.type === 'CallExpression' &&
      node.callee?.type === 'Identifier' &&
      node.callee.name === 'definePropType'
    ) {
      const typeInfo = extractTypeExpression(node, this.source)
      return {
        name,
        runtimeType: typeInfo.runtimeType,
        semanticType: typeInfo.semanticType,
        nullable: typeInfo.nullable,
        values: typeInfo.values,
        valuesKnown: typeInfo.valuesKnown,
        default: { kind: 'missing' },
        required: false,
        readonly: false,
        deprecated: false,
        deprecationMessage: null,
      }
    }
    return null
  }

  parseDescriptorObject(objectNode, name) {
    let runtimeType = null
    let semanticType = null
    let nullable = false
    let values = null
    let valuesKnown = false
    let defaultValue = { kind: 'missing' }
    let required = false
    let readonly = false
    for (const property of objectNode.properties || []) {
      if (property.type === 'SpreadElement') {
        const resolved = this.resolver.resolveIdentifier(
          property.argument?.name,
          this.fromRelPath,
        )
        if (resolved?.node?.type === 'ObjectExpression') {
          const merged = this.parseDescriptorObject(resolved.node, name)
          if (merged) {
            runtimeType = merged.runtimeType
            semanticType = merged.semanticType
            nullable = merged.nullable
            values = merged.values
            valuesKnown = merged.valuesKnown
            defaultValue = merged.default
            required = merged.required
            readonly = merged.readonly
          }
        }
        continue
      }
      if (property.type !== 'ObjectProperty') continue
      const key = this.propertyName(property)
      if (key === 'type') {
        const info = extractTypeExpression(property.value, this.source)
        runtimeType = info.runtimeType
        semanticType = info.semanticType
        nullable = info.nullable
        if (info.valuesKnown) {
          values = info.values
          valuesKnown = true
        }
      } else if (key === 'values') {
        let extracted = null
        if (property.value.type === 'ArrayExpression') {
          extracted = arrayLiteralValues(property.value)
        } else if (property.value.type === 'Identifier') {
          const resolved = this.resolver.resolveIdentifier(
            property.value.name,
            this.fromRelPath,
          )
          if (resolved?.node?.type === 'ArrayExpression')
            extracted = arrayLiteralValues(resolved.node)
        }
        values = extracted?.values ?? null
        valuesKnown = extracted?.valuesKnown ?? false
      } else if (key === 'default') {
        defaultValue = literalToJson(property.value, this.source)
      } else if (key === 'required') {
        required =
          property.value.type === 'BooleanLiteral' &&
          property.value.value === true
      } else if (key === 'readonly') {
        readonly =
          property.value.type === 'BooleanLiteral' &&
          property.value.value === true
      }
    }
    if (defaultValue.kind === 'literal' && defaultValue.value === null)
      nullable = true
    if (defaultValue.kind === 'null') nullable = true
    return {
      name,
      runtimeType,
      semanticType,
      nullable,
      values,
      valuesKnown,
      default: defaultValue,
      required,
      readonly,
      deprecated: false,
      deprecationMessage: null,
    }
  }
}

const payloadFromFunction = (fnNode, source) => {
  if (
    !fnNode ||
    (fnNode.type !== 'ArrowFunctionExpression' &&
      fnNode.type !== 'FunctionExpression' &&
      fnNode.type !== 'FunctionDeclaration')
  )
    return []
  return (fnNode.params || []).map((param) => {
    const result = { name: null, type: null, optional: false, rest: false }
    if (param.type === 'Identifier') {
      result.name = param.name
      result.optional = Boolean(param.optional)
      if (param.typeAnnotation)
        result.type = typeText(param.typeAnnotation, source)
    } else if (param.type === 'AssignmentPattern') {
      result.optional = true
      if (param.left?.type === 'Identifier') {
        result.name = param.left.name
        if (param.left.typeAnnotation)
          result.type = typeText(param.left.typeAnnotation, source)
      }
    } else if (param.type === 'RestElement') {
      result.rest = true
      if (param.argument?.type === 'Identifier') {
        result.name = param.argument.name
        if (param.argument.typeAnnotation)
          result.type = typeText(param.argument.typeAnnotation, source)
      }
    }
    return result
  })
}

const signatureFromFunction = (fnNode, source) => {
  const parameters = payloadFromFunction(fnNode, source)
  const returnType = fnNode.returnType
    ? typeText(fnNode.returnType, source)
    : null
  return { parameters, returnType }
}

const keyText = (keyNode, source) => {
  if (!keyNode) return null
  if (keyNode.type === 'Identifier') return keyNode.name
  if (keyNode.type === 'StringLiteral') return keyNode.value
  if (keyNode.type === 'NumericLiteral') return String(keyNode.value)
  return source.slice(keyNode.start, keyNode.end)
}

export const extractComponentSemantics = ({
  root,
  moduleSources,
  vueSource,
  structuredEmitNames = [],
  structuredExposedNames = [],
}) => {
  const resolver = new SemanticResolver(root, moduleSources)
  const vueRel = vueSource ? vueSource.relativePath : null
  const vueModule = vueRel ? resolver.parseVueModule(vueRel) : null

  const props = []
  const emits = []
  const exposed = []
  const slots = extractTemplateSlots(vueModule?.templateAst)

  const resolveCallArg = (argNode, fromRel) => {
    if (!argNode) return null
    const unwrapped = unwrapExpression(argNode)
    if (unwrapped.type === 'ObjectExpression')
      return {
        object: unwrapped,
        source: resolver.readSource(fromRel) || '',
        sourceRel: fromRel,
      }
    if (unwrapped.type === 'ArrayExpression')
      return {
        array: unwrapped,
        source: resolver.readSource(fromRel) || '',
        sourceRel: fromRel,
      }
    if (unwrapped.type === 'Identifier') {
      const resolved = resolver.resolveIdentifier(unwrapped.name, fromRel)
      if (!resolved?.node) return null
      const source = resolver.readSource(resolved.relPath) || ''
      if (resolved.node.type === 'ObjectExpression')
        return { object: resolved.node, source, sourceRel: resolved.relPath }
      if (resolved.node.type === 'ArrayExpression')
        return { array: resolved.node, source, sourceRel: resolved.relPath }
      if (
        resolved.node.type === 'CallExpression' &&
        resolved.node.callee?.type === 'Identifier' &&
        resolved.node.callee.name === 'buildProps'
      ) {
        const arg = unwrapExpression(resolved.node.arguments?.[0])
        if (arg?.type === 'ObjectExpression')
          return { object: arg, source, sourceRel: resolved.relPath }
      }
    }
    return null
  }

  const collectPropsFromObject = (objectNode, source, fromRel) => {
    const parser = new PropDescriptorParser(resolver, source, fromRel)
    return parser.parseBuildPropsObject(objectNode)
  }

  const collectEmitsFromObject = (
    objectNode,
    source,
    fromRel,
    sourceRel = fromRel,
  ) => {
    const result = []
    for (const property of objectNode.properties || []) {
      if (property.type !== 'ObjectProperty') continue
      let name = null
      if (property.computed && property.key?.type === 'Identifier') {
        const resolved = resolver.resolveIdentifier(property.key.name, fromRel)
        if (resolved?.node?.type === 'StringLiteral') name = resolved.node.value
        else name = `[${property.key.name}]`
      } else {
        name = keyText(property.key, source)
      }
      if (!name) continue
      const payload = payloadFromFunction(property.value, source)
      result.push({ name, payload })
    }
    const structured = extractStructuredEmitPayloads({
      root,
      sourceRelativePath: sourceRel,
      objectStart: objectNode.start,
      objectEnd: objectNode.end,
      eventNames: structuredEmitNames,
    })
    for (const emit of result) {
      const resolved = structured.get(emit.name)
      if (!resolved) continue
      emit.payloadShapeStatus = resolved.kind
      emit.payloadShapeReason = resolved.reason ?? null
      if (resolved.kind === 'callable') emit.payload = resolved.parameters
    }
    return result
  }

  const collectEmitsFromArray = (arrayNode) =>
    (arrayNode.elements || [])
      .filter((el) => el?.type === 'StringLiteral')
      .map((el) => ({ name: el.value, payload: [] }))

  if (vueModule) {
    for (const call of vueModule.macroCalls || []) {
      const macro = call.callee.name
      const arg = call.arguments?.[0]
      const fromRel = vueRel
      if (macro === 'defineProps') {
        const resolved = resolveCallArg(arg, fromRel)
        if (resolved?.object)
          props.push(
            ...collectPropsFromObject(
              resolved.object,
              resolved.source,
              fromRel,
            ),
          )
      } else if (macro === 'defineEmits') {
        const resolved = resolveCallArg(arg, fromRel)
        if (resolved?.object)
          emits.push(
            ...collectEmitsFromObject(
              resolved.object,
              resolved.source,
              fromRel,
              resolved.sourceRel,
            ),
          )
        if (resolved?.array)
          emits.push(...collectEmitsFromArray(resolved.array))
      } else if (macro === 'defineExpose' && arg?.type === 'ObjectExpression') {
        for (const property of arg.properties || []) {
          if (
            property.type !== 'ObjectProperty' &&
            property.type !== 'ObjectMethod'
          )
            continue
          const name = keyText(property.key, vueModule.content)
          if (!name) continue
          if (property.type === 'ObjectMethod') {
            exposed.push({
              name,
              ...signatureFromFunction(property, vueModule.content),
            })
            continue
          }
          const valueNode = property.value
          if (valueNode.type === 'Identifier') {
            const resolved = resolver.resolveIdentifier(valueNode.name, vueRel)
            if (resolved?.functionNode) {
              const source =
                resolved.source || resolver.readSource(resolved.relPath) || ''
              exposed.push({
                name,
                ...signatureFromFunction(resolved.node, source),
              })
            } else if (resolved?.node) {
              const source =
                resolved.source || resolver.readSource(resolved.relPath) || ''
              const fn =
                resolved.node.type === 'ArrowFunctionExpression' ||
                resolved.node.type === 'FunctionExpression' ||
                resolved.node.type === 'FunctionDeclaration'
                  ? resolved.node
                  : null
              if (fn)
                exposed.push({ name, ...signatureFromFunction(fn, source) })
              else exposed.push({ name, parameters: [], returnType: null })
            } else {
              exposed.push({ name, parameters: [], returnType: null })
            }
          } else if (
            valueNode.type === 'ArrowFunctionExpression' ||
            valueNode.type === 'FunctionExpression'
          ) {
            exposed.push({
              name,
              ...signatureFromFunction(
                valueNode,
                vueModule.setup || vueModule.scriptAst || vueModule.content,
              ),
            })
          } else {
            exposed.push({ name, parameters: [], returnType: null })
          }
        }
      }
    }
  }

  // Options API fallback (rare) for props/emits defined in script, not script setup.
  if (vueModule && !vueModule.setup && vueModule.scriptAst) {
    const source = vueModule.scriptAst
    const parsed = babelParse(source, {
      sourceType: 'module',
      plugins: ['typescript'],
      errorRecovery: true,
    })
    const propsObjects = []
    const emitsObjects = []
    walkNodes(parsed.program.body, (node) => {
      if (node.type === 'ObjectProperty' && node.key?.type === 'Identifier') {
        if (node.key.name === 'props' && node.value.type === 'ObjectExpression')
          propsObjects.push(node.value)
        if (node.key.name === 'emits') {
          if (node.value.type === 'ObjectExpression')
            emitsObjects.push(node.value)
          if (node.value.type === 'ArrayExpression')
            emits.push(...collectEmitsFromArray(node.value))
        }
      }
    })
    for (const object of propsObjects)
      props.push(...collectPropsFromObject(object, source, vueRel))
    for (const object of emitsObjects)
      emits.push(...collectEmitsFromObject(object, source, vueRel))
  }

  const uniqueBy = (items) => {
    const map = new Map()
    for (const item of items) {
      if (!map.has(item.name)) map.set(item.name, item)
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name))
  }

  const propsSorted = uniqueBy(props)
  const emitsSorted = uniqueBy(emits)
  const exposedSorted = uniqueBy(exposed)
  const requestedExposedNames = [...structuredExposedNames]
  if (vueModule?.setup && requestedExposedNames.length > 0) {
    const structured = extractStructuredExposedSignatures({
      root,
      sourceRelativePath: vueRel,
      scriptContent: vueModule.setup,
      memberNames: requestedExposedNames,
    })
    for (const member of exposedSorted) {
      const resolved = structured.get(member.name)
      if (!resolved) continue
      member.signatureStatus = resolved.kind
      member.signatureReason = resolved.reason ?? null
      if (resolved.kind === 'callable') {
        member.parameters = resolved.parameters
        member.returnType = resolved.returnType
      } else {
        member.parameters = []
        member.returnType = null
      }
    }
  }

  return {
    semanticProps: propsSorted,
    semanticEmits: emitsSorted,
    semanticExposed: exposedSorted,
    semanticSlots: slots,
    legacyProps: propsSorted.map((p) => p.name),
    legacyEmits: emitsSorted.map((e) => e.name),
    legacyExposed: exposedSorted.map((e) => e.name),
    legacySlots: slots,
  }
}

export const loadModuleSources = (root, moduleName) => {
  const moduleRoot = path.join(root, 'vue/packages/components', moduleName)
  if (!fs.existsSync(moduleRoot)) return []
  const files = []
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (
        entry.name === 'node_modules' ||
        entry.name === 'dist' ||
        entry.name === '__tests__'
      )
        continue
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) walk(full)
      else if (/\.(ts|vue)$/u.test(entry.name)) {
        files.push({
          file: full,
          relativePath: path.relative(root, full).split(path.sep).join('/'),
          content: fs.readFileSync(full, 'utf8'),
        })
      }
    }
  }
  walk(moduleRoot)
  return files.sort((a, b) => a.relativePath.localeCompare(b.relativePath))
}

const declaredComponentNames = (source) => {
  const names = new Set()
  try {
    const { descriptor } = parseSfc(source, { filename: 'component.vue' })
    for (const block of [descriptor.scriptSetup, descriptor.script]) {
      if (!block?.content) continue
      const ast = babelParse(block.content, {
        sourceType: 'module',
        plugins: ['typescript', 'jsx', 'importAttributes', 'topLevelAwait'],
        errorRecovery: true,
      })
      walkNodes(ast.program.body, (node) => {
        if (
          node.type !== 'CallExpression' ||
          node.callee?.type !== 'Identifier' ||
          !['defineComponent', 'defineOptions'].includes(node.callee.name) ||
          node.arguments?.[0]?.type !== 'ObjectExpression'
        ) {
          return
        }
        for (const property of node.arguments[0].properties ?? []) {
          if (
            property.type === 'ObjectProperty' &&
            property.key?.type === 'Identifier' &&
            property.key.name === 'name' &&
            property.value?.type === 'StringLiteral'
          ) {
            names.add(property.value.value)
          }
        }
      })
    }
  } catch {
    return names
  }
  return names
}

export const sourceForComponent = (sources, exportName) => {
  const toKebab = (value) =>
    value
      .replace(/^El/, '')
      .replace(/^Fsus/, '')
      .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
      .replace(/([A-Z])([A-Z][a-z])/g, '$1-$2')
      .toLowerCase()
  const kebab = toKebab(exportName)
  const exact = sources.find((source) =>
    source.relativePath.endsWith(`/src/${kebab}.vue`),
  )
  if (exact) return exact
  const declared = sources.find(
    (source) =>
      source.relativePath.endsWith('.vue') &&
      declaredComponentNames(source.content).has(exportName),
  )
  if (declared) return declared
  return sources.find((source) => source.relativePath.endsWith('.vue'))
}

export const enrichComponentWithSemantics = ({ root, component }) => {
  const moduleSources = loadModuleSources(root, component.module)
  const vueSource = sourceForComponent(moduleSources, component.name)
  const semantics = extractComponentSemantics({
    root,
    moduleSources,
    vueSource,
    exportName: component.name,
  })
  return {
    ...component,
    semantic: {
      props: semantics.semanticProps,
      emits: semantics.semanticEmits,
      exposed: semantics.semanticExposed,
      slots: semantics.semanticSlots,
    },
  }
}
