import path from 'node:path'
import { inspectGeneratedCode } from './generated-code'
import type { MagicString } from 'vue/compiler-sfc'
import type { GeneratedNode } from './generated-code'
import type { PluginContext, RenderedChunk } from 'rollup'

type FrozenExports = Map<string, Map<string, string>>
const nameOf = (node: { type: string; name?: string; value?: unknown }) =>
  node.type === 'Identifier'
    ? node.name
    : typeof node.value === 'string'
      ? node.value
      : undefined

// Fold only own string data properties of literal, frozen records. The original
// binding read remains, preserving initialization/TDZ behavior. Public records
// and their descriptors are retained in the library module.
export const frozenStringReads = () => {
  const cache = new Map<string, { code: string; values: FrozenExports }>()
  const exportsOf = (context: PluginContext, id: string): FrozenExports => {
    const info = context.getModuleInfo(id)
    if (!info?.code || info.isExternal || !info.code.includes('Object.freeze'))
      return new Map()
    const cached = cache.get(id)
    if (cached?.code === info.code) return cached.values
    const analysis = inspectGeneratedCode(info.code)
    const result: FrozenExports = new Map()
    cache.set(id, { code: info.code, values: result })
    if (analysis.hasEval) return result
    const exported = new Map<string, string>()
    for (const statement of analysis.program.body) {
      if (statement.type !== 'ExportNamedDeclaration' || statement.source)
        continue
      if (statement.declaration?.type === 'VariableDeclaration')
        for (const variable of statement.declaration.declarations) {
          if (variable.id.type === 'Identifier')
            exported.set(variable.id.name, variable.id.name)
        }
      for (const specifier of statement.specifiers) {
        const name = nameOf(specifier.exported)
        const local = nameOf(specifier.local)
        if (name && local) exported.set(name, local)
      }
    }
    const scope = analysis.scopes.scopes.find(
      (scope) => scope.type === 'module',
    )
    for (const [name, local] of exported) {
      const binding = scope?.set.get(local)
      const definition = binding?.defs[0]
      if (
        binding?.defs.length !== 1 ||
        definition?.node.type !== 'VariableDeclarator' ||
        definition.parent?.type !== 'VariableDeclaration' ||
        definition.parent.kind !== 'const'
      )
        continue
      const call = definition.node.init
      if (
        call?.type !== 'CallExpression' ||
        call.optional ||
        call.arguments.length !== 1 ||
        call.callee.type !== 'MemberExpression' ||
        call.callee.computed ||
        call.callee.optional ||
        call.callee.object.type !== 'Identifier' ||
        call.callee.object.name !== 'Object' ||
        call.callee.property.type !== 'Identifier' ||
        call.callee.property.name !== 'freeze'
      )
        continue
      const native = analysis.references.get(call.callee.object)
      if (
        !native ||
        (native.resolved &&
          (native.resolved.scope.type !== 'global' ||
            native.resolved.defs.length !== 0))
      )
        continue
      const object = call.arguments[0]
      if (object.type !== 'ObjectExpression') continue
      const values = new Map<string, string>()
      let valid = true
      for (const property of object.properties) {
        if (
          property.type !== 'Property' ||
          property.computed ||
          property.method ||
          property.kind !== 'init' ||
          property.value.type !== 'Literal' ||
          typeof property.value.value !== 'string'
        ) {
          valid = false
          break
        }
        const key = nameOf(property.key)
        if (!key || key === '__proto__' || key === '__v_isRef') {
          valid = false
          break
        }
        values.set(key, property.value.value)
      }
      if (valid) result.set(name, values)
    }
    return result
  }
  return (
    context: PluginContext,
    analysis: ReturnType<typeof inspectGeneratedCode>,
    chunk: RenderedChunk,
    chunks: Record<string, RenderedChunk>,
    output: MagicString,
  ) => {
    if (analysis.hasEval) return false
    let changed = false
    for (const node of analysis.nodes) {
      if (node.type !== 'MemberExpression' || node.optional) continue
      let argument
      if (node.object.type === 'Identifier') {
        argument = node.object
      } else {
        const call = node.object
        if (
          call.type !== 'CallExpression' ||
          call.optional ||
          call.callee.type !== 'Identifier' ||
          call.arguments.length !== 1 ||
          call.arguments[0].type !== 'Identifier'
        )
          continue
        const helper = analysis.references.get(call.callee)?.resolved?.defs[0]
        if (
          helper?.type !== 'ImportBinding' ||
          helper.node.type !== 'ImportSpecifier' ||
          nameOf(helper.node.imported) !== 'unref' ||
          helper.parent?.type !== 'ImportDeclaration' ||
          helper.parent.source.value !== 'vue'
        )
          continue
        argument = call.arguments[0]
      }
      const imported = analysis.references.get(argument)?.resolved?.defs[0]
      if (
        imported?.type !== 'ImportBinding' ||
        imported.node.type !== 'ImportSpecifier' ||
        imported.parent?.type !== 'ImportDeclaration' ||
        typeof imported.parent.source.value !== 'string' ||
        !imported.parent.source.value.startsWith('.')
      )
        continue
      let current: GeneratedNode = node
      let read = true
      for (
        let parent = analysis.parents.get(current);
        parent;
        parent = analysis.parents.get(current)
      ) {
        const container = parent.node
        if (
          (container.type === 'AssignmentExpression' &&
            parent.key === 'left') ||
          container.type === 'UpdateExpression' ||
          (container.type === 'UnaryExpression' &&
            container.operator === 'delete') ||
          ((container.type === 'ForInStatement' ||
            container.type === 'ForOfStatement') &&
            parent.key === 'left')
        ) {
          read = false
          break
        }
        if (
          container.type.endsWith('Statement') ||
          container.type === 'Program'
        )
          break
        current = container
      }
      if (!read) continue
      const key =
        !node.computed && node.property.type === 'Identifier'
          ? node.property.name
          : node.computed &&
              node.property.type === 'Literal' &&
              typeof node.property.value === 'string'
            ? node.property.value
            : undefined
      const exported = nameOf(imported.node.imported)
      if (!key || !exported) continue
      const file = path.posix.normalize(
        path.posix.join(
          path.posix.dirname(chunk.fileName),
          imported.parent.source.value,
        ),
      )
      const owner = chunks[file]
      const id = owner?.facadeModuleId
      if (!owner?.isEntry || !id || !owner.exports.includes(exported)) continue
      const value = exportsOf(context, id).get(exported)?.get(key)
      if (value === undefined) continue
      output.overwrite(
        node.range![0],
        node.range![1],
        `(${argument.name},${JSON.stringify(value)})`,
      )
      changed = true
    }
    return changed
  }
}
