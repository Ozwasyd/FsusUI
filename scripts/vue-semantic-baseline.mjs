import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import babelParser from '@babel/parser'
import { parse as parseSfc } from 'vue/compiler-sfc'

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

const parseSlotTags = (templateSource) => {
  const slots = []
  for (const match of templateSource.matchAll(/<slot\b([^>]*)>/g)) {
    const attrs = match[1]
    const nameMatch = attrs.match(/\bname\s*=\s*["']([^"']+)["']/)
    slots.push({
      name: nameMatch ? nameMatch[1] : 'default',
      scoped: /\s(:|v-bind:)[\w-]+/.test(attrs),
    })
  }
  const byName = new Map()
  for (const slot of slots) {
    const current = byName.get(slot.name)
    byName.set(slot.name, {
      name: slot.name,
      scoped: Boolean(current?.scoped || slot.scoped),
    })
  }
  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name))
}

const declaredComponentNames = (source) => {
  const scripts = []
  if (source.relativePath.endsWith('.vue')) {
    try {
      const { descriptor } = parseSfc(source.content, {
        filename: path.basename(source.relativePath),
      })
      if (descriptor.script?.content) scripts.push(descriptor.script.content)
      if (descriptor.scriptSetup?.content) {
        scripts.push(descriptor.scriptSetup.content)
      }
    } catch {
      return []
    }
  } else {
    scripts.push(source.content)
  }

  const names = new Set()
  for (const script of scripts) {
    let ast
    try {
      ast = babelParse(script, {
        sourceType: 'module',
        plugins: [
          'typescript',
          'jsx',
          'decorators-legacy',
          'importAttributes',
          'topLevelAwait',
        ],
        errorRecovery: true,
      })
    } catch {
      continue
    }
    const stringConstants = new Map()
    for (const statement of ast.program.body) {
      if (statement.type !== 'VariableDeclaration') continue
      for (const declaration of statement.declarations || []) {
        if (
          declaration.id?.type === 'Identifier' &&
          declaration.init?.type === 'StringLiteral'
        ) {
          stringConstants.set(declaration.id.name, declaration.init.value)
        }
      }
    }
    const nameFromOptions = (options) => {
      if (options?.type !== 'ObjectExpression') return
      const property = options.properties.find(
        (candidate) =>
          candidate.type === 'ObjectProperty' &&
          !candidate.computed &&
          candidate.key?.type === 'Identifier' &&
          candidate.key.name === 'name',
      )
      if (property?.value?.type === 'StringLiteral') {
        names.add(property.value.value)
      } else if (property?.value?.type === 'Identifier') {
        const value = stringConstants.get(property.value.name)
        if (value) names.add(value)
      }
    }
    walkNodes(ast.program.body, (node) => {
      if (
        node.type === 'CallExpression' &&
        node.callee?.type === 'Identifier' &&
        ['defineComponent', 'defineOptions'].includes(node.callee.name)
      ) {
        nameFromOptions(unwrapExpression(node.arguments?.[0]))
      }
      if (node.type === 'ExportDefaultDeclaration') {
        nameFromOptions(unwrapExpression(node.declaration))
      }
    })
  }
  return [...names].sort()
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
        `${spec}.tsx`,
        `${spec}.vue`,
        `${spec}.js`,
        `${spec}/index.ts`,
        `${spec}/index.tsx`,
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
        `vue/packages/components/${name}.tsx`,
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
          if (/\.tsx?$/u.test(dir) && !dir.endsWith('.d.ts')) files.push(dir)
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
            /\.tsx?$/u.test(entry.name) &&
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

const arrayLiteralValues = (node, source) => {
  if (!node) return null
  if (node.type === 'ArrayExpression') {
    const values = []
    for (const element of node.elements || []) {
      if (!element) continue
      if (element.type === 'StringLiteral') values.push(element.value)
      else if (element.type === 'NumericLiteral') values.push(element.value)
      else if (element.type === 'BooleanLiteral') values.push(element.value)
      else if (element.type === 'NullLiteral') values.push(null)
      else
        values.push(
          `<expr:${sha256(source.slice(element.start, element.end)).slice(0, 12)}>`,
        )
    }
    return values
  }
  return null
}

const extractTypeExpression = (typeNode, source) => {
  if (!typeNode)
    return { runtimeType: null, semanticType: null, nullable: false }
  if (typeNode.type === 'Identifier') {
    return {
      runtimeType: RUNTIME_TYPE_NAMES.has(typeNode.name) ? typeNode.name : null,
      semanticType: RUNTIME_TYPE_NAMES.has(typeNode.name)
        ? null
        : typeNode.name,
      nullable: false,
    }
  }
  if (typeNode.type === 'TSAsExpression') {
    const inner = extractTypeExpression(typeNode.expression, source)
    const semantic = typeText(typeNode.typeAnnotation, source)
    return {
      runtimeType: inner.runtimeType || null,
      semanticType: semantic,
      nullable: /\bnull\b|\bundefined\b/u.test(semantic || ''),
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
      }
    }
    return { runtimeType: null, semanticType: null, nullable: false }
  }
  if (typeNode.type === 'ArrayExpression') {
    const names = (typeNode.elements || []).map((el) =>
      el?.type === 'Identifier' ? el.name : null,
    )
    return {
      runtimeType: 'Array',
      semanticType: names.filter(Boolean).join(' | '),
      nullable: false,
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
    }
  }
  return { runtimeType: null, semanticType: null, nullable: false }
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
        const resolvedNode = unwrapExpression(resolved?.node)
        if (resolvedNode?.type === 'ObjectExpression') {
          const source = this.resolver.readSource(resolved.relPath) || ''
          result.push(
            ...new PropDescriptorParser(
              this.resolver,
              source,
              resolved.relPath,
            ).parseBuildPropsObject(resolvedNode),
          )
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
      const descriptor = this.parsePropValue(property.value, name)
      if (descriptor) result.push(descriptor)
    }
    return result
  }

  propertyName(property) {
    if (property.key?.type === 'Identifier') return property.key.name
    if (property.key?.type === 'StringLiteral') return property.key.value
    return null
  }

  parsePropValue(valueNode, name) {
    if (!valueNode) return null
    valueNode = unwrapExpression(valueNode)
    if (valueNode.type === 'Identifier') {
      if (RUNTIME_TYPE_NAMES.has(valueNode.name)) {
        return {
          name,
          runtimeType: valueNode.name,
          semanticType: null,
          nullable: false,
          values: null,
          default: { kind: 'missing' },
          required: false,
          readonly: false,
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
          default: { kind: 'missing' },
          required: false,
          readonly: false,
        }
      }
      const sub = this.parseFromNode(resolved.node, name, resolved.relPath)
      if (sub) return sub
      return {
        name,
        runtimeType: null,
        semanticType: valueNode.name,
        nullable: false,
        values: null,
        default: { kind: 'missing' },
        required: false,
        readonly: false,
      }
    }
    if (valueNode.type === 'ObjectExpression') {
      return this.parseDescriptorObject(valueNode, name)
    }
    if (
      ['MemberExpression', 'OptionalMemberExpression'].includes(valueNode.type)
    ) {
      const memberName = valueNode.computed
        ? valueNode.property?.type === 'StringLiteral'
          ? valueNode.property.value
          : null
        : valueNode.property?.type === 'Identifier'
          ? valueNode.property.name
          : null
      if (valueNode.object?.type === 'Identifier' && memberName) {
        const resolved = this.resolver.resolveIdentifier(
          valueNode.object.name,
          this.fromRelPath,
        )
        const resolvedNode = unwrapExpression(resolved?.node)
        const propsNode =
          resolvedNode?.type === 'CallExpression' &&
          resolvedNode.callee?.type === 'Identifier' &&
          resolvedNode.callee.name === 'buildProps'
            ? unwrapExpression(resolvedNode.arguments?.[0])
            : resolvedNode
        if (propsNode?.type === 'ObjectExpression') {
          const source = this.resolver.readSource(resolved.relPath) || ''
          const descriptor = new PropDescriptorParser(
            this.resolver,
            source,
            resolved.relPath,
          )
            .parseBuildPropsObject(propsNode)
            .find((candidate) => candidate.name === memberName)
          if (descriptor) return { ...descriptor, name }
        }
      }
    }
    if (
      valueNode.type === 'CallExpression' &&
      valueNode.callee?.type === 'Identifier' &&
      valueNode.callee.name === 'buildProp'
    ) {
      const arg = unwrapExpression(valueNode.arguments?.[0])
      if (arg?.type === 'ObjectExpression')
        return this.parseDescriptorObject(arg, name)
    }
    const typeInfo = extractTypeExpression(valueNode, this.source)
    return {
      name,
      runtimeType: typeInfo.runtimeType,
      semanticType: typeInfo.semanticType,
      nullable: typeInfo.nullable,
      values: null,
      default: { kind: 'missing' },
      required: false,
      readonly: false,
    }
  }

  parseFromNode(node, name, relPath) {
    node = unwrapExpression(node)
    if (node.type === 'Identifier') {
      const source =
        relPath === this.fromRelPath
          ? this.source
          : this.resolver.readSource(relPath) || ''
      return new PropDescriptorParser(
        this.resolver,
        source,
        relPath,
      ).parsePropValue(node, name)
    }
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
      const source =
        relPath === this.fromRelPath
          ? this.source
          : this.resolver.readSource(relPath) || ''
      const typeInfo = extractTypeExpression(node, source)
      return {
        name,
        runtimeType: typeInfo.runtimeType,
        semanticType: typeInfo.semanticType,
        nullable: typeInfo.nullable,
        values: null,
        default: { kind: 'missing' },
        required: false,
        readonly: false,
      }
    }
    return null
  }

  parseDescriptorObject(objectNode, name) {
    let runtimeType = null
    let semanticType = null
    let nullable = false
    let values = null
    let defaultValue = { kind: 'missing' }
    let required = false
    let readonly = false
    for (const property of objectNode.properties || []) {
      if (property.type === 'SpreadElement') {
        const merged = this.parsePropValue(property.argument, name)
        if (merged) {
          runtimeType = merged.runtimeType
          semanticType = merged.semanticType
          nullable = merged.nullable
          values = merged.values
          defaultValue = merged.default
          required = merged.required
          readonly = merged.readonly
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
      } else if (key === 'values') {
        if (property.value.type === 'ArrayExpression')
          values = arrayLiteralValues(property.value, this.source)
        else if (property.value.type === 'Identifier') {
          const resolved = this.resolver.resolveIdentifier(
            property.value.name,
            this.fromRelPath,
          )
          if (resolved?.node?.type === 'ArrayExpression')
            values = arrayLiteralValues(
              resolved.node,
              this.resolver.readSource(resolved.relPath) || this.source,
            )
        }
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
      default: defaultValue,
      required,
      readonly,
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
}) => {
  const resolver = new SemanticResolver(root, moduleSources)
  const componentRel = vueSource ? vueSource.relativePath : null
  const vueModule = componentRel?.endsWith('.vue')
    ? resolver.parseVueModule(componentRel)
    : null
  const tsModule =
    componentRel && !componentRel.endsWith('.vue')
      ? resolver.parseTsModule(componentRel)
      : null

  const props = []
  const emits = []
  const exposed = []
  const slots = vueModule ? parseSlotTags(vueSource.content) : []

  const resolveCallArg = (argNode, fromRel) => {
    if (!argNode) return null
    const unwrapped = unwrapExpression(argNode)
    if (unwrapped.type === 'ObjectExpression')
      return { object: unwrapped, source: resolver.readSource(fromRel) || '' }
    if (unwrapped.type === 'ArrayExpression')
      return { array: unwrapped, source: resolver.readSource(fromRel) || '' }
    if (unwrapped.type === 'Identifier') {
      const resolved = resolver.resolveIdentifier(unwrapped.name, fromRel)
      if (!resolved?.node) return null
      const source = resolver.readSource(resolved.relPath) || ''
      if (resolved.node.type === 'ObjectExpression') {
        return { object: resolved.node, source, relPath: resolved.relPath }
      }
      if (resolved.node.type === 'ArrayExpression') {
        return { array: resolved.node, source, relPath: resolved.relPath }
      }
      if (
        resolved.node.type === 'CallExpression' &&
        resolved.node.callee?.type === 'Identifier' &&
        resolved.node.callee.name === 'buildProps'
      ) {
        const arg = unwrapExpression(resolved.node.arguments?.[0])
        if (arg?.type === 'ObjectExpression') {
          return { object: arg, source, relPath: resolved.relPath }
        }
      }
    }
    return null
  }

  const collectPropsFromObject = (objectNode, source, fromRel) => {
    const parser = new PropDescriptorParser(resolver, source, fromRel)
    return parser.parseBuildPropsObject(objectNode)
  }

  const collectEmitsFromObject = (objectNode, source, fromRel) => {
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
    return result
  }

  const collectEmitsFromArray = (arrayNode) =>
    (arrayNode.elements || [])
      .filter((el) => el?.type === 'StringLiteral')
      .map((el) => ({ name: el.value, payload: [] }))

  const collectExposeFromObject = (objectNode, source, fromRel) => {
    if (!objectNode) return
    for (const property of objectNode.properties || []) {
      if (
        property.type !== 'ObjectProperty' &&
        property.type !== 'ObjectMethod'
      )
        continue
      const name = keyText(property.key, source)
      if (!name) continue
      if (property.type === 'ObjectMethod') {
        exposed.push({ name, ...signatureFromFunction(property, source) })
        continue
      }
      const valueNode = property.value
      if (valueNode.type === 'Identifier') {
        const resolved = resolver.resolveIdentifier(valueNode.name, fromRel)
        if (resolved?.functionNode) {
          const resolvedSource =
            resolved.source || resolver.readSource(resolved.relPath) || ''
          exposed.push({
            name,
            ...signatureFromFunction(resolved.node, resolvedSource),
          })
        } else if (resolved?.node) {
          const resolvedSource =
            resolved.source || resolver.readSource(resolved.relPath) || ''
          const fn = [
            'ArrowFunctionExpression',
            'FunctionExpression',
            'FunctionDeclaration',
          ].includes(resolved.node.type)
            ? resolved.node
            : null
          exposed.push(
            fn
              ? { name, ...signatureFromFunction(fn, resolvedSource) }
              : { name, parameters: [], returnType: null },
          )
        } else {
          exposed.push({ name, parameters: [], returnType: null })
        }
      } else if (
        valueNode.type === 'ArrowFunctionExpression' ||
        valueNode.type === 'FunctionExpression'
      ) {
        exposed.push({ name, ...signatureFromFunction(valueNode, source) })
      } else {
        exposed.push({ name, parameters: [], returnType: null })
      }
    }
  }

  const slotMemberName = (node) => {
    if (
      !node ||
      !['MemberExpression', 'OptionalMemberExpression'].includes(node.type)
    )
      return null
    if (node.object?.type !== 'Identifier' || node.object.name !== 'slots')
      return null
    if (!node.computed && node.property?.type === 'Identifier')
      return node.property.name
    if (node.computed && node.property?.type === 'StringLiteral')
      return node.property.value
    return null
  }

  const collectSetupSlots = (setupNode) => {
    const found = new Map()
    walkNodes(setupNode, (node) => {
      const direct = slotMemberName(node)
      if (direct && !found.has(direct)) found.set(direct, false)
      if (
        node.type === 'CallExpression' ||
        node.type === 'OptionalCallExpression'
      ) {
        const called = slotMemberName(node.callee)
        if (called) found.set(called, true)
      }
    })
    for (const [name, scoped] of found) {
      const current = slots.find((slot) => slot.name === name)
      if (current) current.scoped ||= scoped
      else slots.push({ name, scoped })
    }
  }

  const collectOptionsObject = (optionsNode, source, fromRel) => {
    for (const property of optionsNode.properties || []) {
      if (
        property.type !== 'ObjectProperty' &&
        property.type !== 'ObjectMethod'
      )
        continue
      const name = keyText(property.key, source)
      if (name === 'props' && property.type === 'ObjectProperty') {
        const resolved = resolveCallArg(property.value, fromRel)
        if (resolved?.object) {
          props.push(
            ...collectPropsFromObject(
              resolved.object,
              resolved.source,
              resolved.relPath || fromRel,
            ),
          )
        }
      }
      if (name === 'emits' && property.type === 'ObjectProperty') {
        const resolved = resolveCallArg(property.value, fromRel)
        if (resolved?.object) {
          emits.push(
            ...collectEmitsFromObject(
              resolved.object,
              resolved.source,
              resolved.relPath || fromRel,
            ),
          )
        }
        if (resolved?.array)
          emits.push(...collectEmitsFromArray(resolved.array))
      }
      if (name !== 'setup') continue
      const setupNode =
        property.type === 'ObjectMethod' ? property : property.value
      if (
        !setupNode ||
        ![
          'ObjectMethod',
          'ArrowFunctionExpression',
          'FunctionExpression',
        ].includes(setupNode.type)
      )
        continue
      collectSetupSlots(setupNode)
      walkNodes(setupNode.body, (node) => {
        if (
          (node.type === 'CallExpression' ||
            node.type === 'OptionalCallExpression') &&
          node.callee?.type === 'Identifier' &&
          node.callee.name === 'expose'
        ) {
          const resolved = resolveCallArg(node.arguments?.[0], fromRel)
          if (resolved?.object) {
            collectExposeFromObject(
              resolved.object,
              resolved.source,
              resolved.relPath || fromRel,
            )
          }
        }
      })
    }
  }

  const collectDefineComponentOptions = (ast, source, fromRel) => {
    const defineComponentCalls = []
    walkNodes(ast.program.body, (node) => {
      if (
        node.type === 'CallExpression' &&
        node.callee?.type === 'Identifier' &&
        node.callee.name === 'defineComponent'
      ) {
        const optionsNode = unwrapExpression(node.arguments?.[0])
        if (optionsNode?.type === 'ObjectExpression')
          defineComponentCalls.push(optionsNode)
      }
    })
    for (const optionsNode of defineComponentCalls) {
      collectOptionsObject(optionsNode, source, fromRel)
    }
  }

  if (vueModule) {
    for (const call of vueModule.macroCalls || []) {
      const macro = call.callee.name
      const arg = call.arguments?.[0]
      const fromRel = componentRel
      if (macro === 'defineProps') {
        const resolved = resolveCallArg(arg, fromRel)
        if (resolved?.object) {
          props.push(
            ...collectPropsFromObject(
              resolved.object,
              resolved.source,
              resolved.relPath || fromRel,
            ),
          )
        }
      } else if (macro === 'defineEmits') {
        const resolved = resolveCallArg(arg, fromRel)
        if (resolved?.object) {
          emits.push(
            ...collectEmitsFromObject(
              resolved.object,
              resolved.source,
              resolved.relPath || fromRel,
            ),
          )
        }
        if (resolved?.array)
          emits.push(...collectEmitsFromArray(resolved.array))
      } else if (macro === 'defineExpose' && arg?.type === 'ObjectExpression') {
        collectExposeFromObject(arg, vueModule.content, componentRel)
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
      props.push(...collectPropsFromObject(object, source, componentRel))
    for (const object of emitsObjects)
      emits.push(...collectEmitsFromObject(object, source, componentRel))
    collectDefineComponentOptions(parsed, source, componentRel)
  }

  if (tsModule) {
    collectDefineComponentOptions(tsModule.ast, tsModule.content, componentRel)
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
  const slotsSorted = uniqueBy(slots)

  return {
    semanticProps: propsSorted,
    semanticEmits: emitsSorted,
    semanticExposed: exposedSorted,
    semanticSlots: slotsSorted,
    legacyProps: propsSorted.map((p) => p.name),
    legacyEmits: emitsSorted.map((e) => e.name),
    legacyExposed: exposedSorted.map((e) => e.name),
    legacySlots: slotsSorted,
    componentSource: vueSource
      ? {
          path: vueSource.relativePath,
          hash: sha256(vueSource.content),
        }
      : null,
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
      else if (/\.(ts|tsx|vue)$/u.test(entry.name)) {
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

export const extractPublicValueExports = ({
  root,
  moduleSources,
  moduleName,
}) => {
  const resolver = new SemanticResolver(root, moduleSources)
  const indexRel = `vue/packages/components/${moduleName}/index.ts`
  const indexModule = resolver.parseTsModule(indexRel)
  if (!indexModule) return []
  const values = []
  for (const statement of indexModule.ast.program.body) {
    if (
      statement.type !== 'ExportNamedDeclaration' ||
      !statement.source?.value
    ) {
      continue
    }
    const targetRel = resolver.resolveSpecFile(statement.source.value, indexRel)
    const targetModule = targetRel ? resolver.parseTsModule(targetRel) : null
    if (!targetModule) continue
    for (const specifier of statement.specifiers || []) {
      if (specifier.type !== 'ExportSpecifier') continue
      const localName =
        specifier.local.type === 'Identifier'
          ? specifier.local.name
          : specifier.local.value
      const exportName =
        specifier.exported.type === 'Identifier'
          ? specifier.exported.name
          : specifier.exported.value
      const enumNode = targetModule.ast.program.body
        .map((candidate) =>
          candidate.type === 'ExportNamedDeclaration'
            ? candidate.declaration
            : candidate,
        )
        .find(
          (candidate) =>
            candidate?.type === 'TSEnumDeclaration' &&
            candidate.id.name === localName,
        )
      if (enumNode) {
        values.push({
          name: exportName,
          module: moduleName,
          kind: 'enum',
          source: {
            path: targetRel,
            hash: sha256(targetModule.content),
            symbol: localName,
          },
          values: enumNode.members.map((member) => ({
            name:
              member.id.type === 'Identifier'
                ? member.id.name
                : member.id.value,
            value:
              member.initializer?.type === 'StringLiteral' ||
              member.initializer?.type === 'NumericLiteral'
                ? member.initializer.value
                : null,
          })),
        })
        continue
      }
      const constant = targetModule.consts.get(localName)
      if (
        constant?.type === 'CallExpression' &&
        constant.callee?.type === 'Identifier' &&
        constant.callee.name === 'Symbol'
      ) {
        values.push({
          name: exportName,
          module: moduleName,
          kind: 'sentinel',
          source: {
            path: targetRel,
            hash: sha256(targetModule.content),
            symbol: localName,
          },
          values: [],
        })
      }
    }
  }
  return values.sort((first, second) => first.name.localeCompare(second.name))
}

const exportedAliasTarget = (sources, exportName) => {
  const indexSource = sources.find((source) =>
    source.relativePath.endsWith('/index.ts'),
  )
  if (!indexSource) return null
  let ast
  try {
    ast = babelParse(indexSource.content, {
      sourceType: 'module',
      plugins: ['typescript', 'jsx', 'importAttributes'],
      errorRecovery: true,
    })
  } catch {
    return null
  }
  for (const statement of ast.program.body) {
    if (
      statement.type !== 'ExportNamedDeclaration' ||
      statement.declaration?.type !== 'VariableDeclaration'
    ) {
      continue
    }
    const declaration = statement.declaration.declarations.find(
      (candidate) =>
        candidate.id?.type === 'Identifier' && candidate.id.name === exportName,
    )
    let value = unwrapExpression(declaration?.init)
    if (value?.type === 'Identifier') return value.name
    while (
      value &&
      ['MemberExpression', 'OptionalMemberExpression'].includes(value.type)
    ) {
      value = unwrapExpression(value.object)
    }
    if (value?.type === 'Identifier') return value.name
  }
  return null
}

export const sourceForComponent = (sources, exportName, seen = new Set()) => {
  if (seen.has(exportName)) return null
  seen.add(exportName)
  const toKebab = (value) =>
    value
      .replace(/^El/, '')
      .replace(/^Fsus/, '')
      .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
      .replace(/([A-Z])([A-Z][a-z])/g, '$1-$2')
      .toLowerCase()
  const kebab = toKebab(exportName)
  const suffixes = [
    `/src/${kebab}.vue`,
    `/src/${kebab}.tsx`,
    `/src/components/${kebab}.tsx`,
    `/src/${kebab}.ts`,
  ]
  for (const suffix of suffixes) {
    const exact = sources.find((source) => source.relativePath.endsWith(suffix))
    if (
      exact &&
      (exact.relativePath.endsWith('.vue') ||
        /\bdefineComponent\s*\(/u.test(exact.content))
    ) {
      return exact
    }
  }
  const declared = sources.filter((source) =>
    declaredComponentNames(source).includes(exportName),
  )
  if (declared.length === 1) return declared[0]
  const aliasTarget = exportedAliasTarget(sources, exportName)
  if (aliasTarget) return sourceForComponent(sources, aliasTarget, seen)
  return null
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
