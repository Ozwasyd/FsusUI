import { MagicString } from 'vue/compiler-sfc'
import type { Plugin } from 'rollup'

// Named bindings within one external import have no evaluation order. Keep
// module declaration order, binding identities, comments and source maps.
export const CanonicalExternalImports = (): Plugin => ({
  name: 'element-plus-canonical-external-imports',
  renderChunk(code, chunk, options) {
    if (options.format !== 'es') return null
    const program = this.parse(code)
    const output = new MagicString(code, { filename: chunk.fileName })
    let changed = false
    for (const statement of program.body) {
      if (
        statement.type !== 'ImportDeclaration' ||
        typeof statement.source.value !== 'string' ||
        !this.getModuleInfo(statement.source.value)?.isExternal
      )
        continue
      const bindings = statement.specifiers
        .filter((node) => node.type === 'ImportSpecifier')
        .map((node) => node as typeof node & { start: number; end: number })
      if (bindings.length < 2) continue
      const span = code.slice(bindings[0].start, bindings.at(-1)!.end)
      if (/\/\*|\/\//u.test(span)) continue
      const key = (node: (typeof bindings)[number]) =>
        `${node.imported.type === 'Identifier' ? node.imported.name : node.imported.value}:${node.local.name}`
      const sorted = [...bindings].sort((a, b) =>
        key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0,
      )
      for (let index = 0; index < bindings.length; index++) {
        if (bindings[index] === sorted[index]) continue
        output.overwrite(
          bindings[index].start,
          bindings[index].end,
          code.slice(sorted[index].start, sorted[index].end),
        )
        changed = true
      }
    }
    return changed
      ? {
          code: output.toString(),
          map: options.sourcemap
            ? output.generateMap({ hires: true, includeContent: true })
            : null,
        }
      : null
  },
})
