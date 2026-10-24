import { MagicString } from 'vue/compiler-sfc'
import { inspectGeneratedCode } from './generated-code'
import { frozenStringReads } from './frozen-strings'
import type { Plugin } from 'rollup'

export const FrozenStringRecords = (): Plugin => {
  const foldFrozen = frozenStringReads()
  return {
    name: 'element-plus-frozen-string-records',
    renderChunk(code, chunk, options, meta) {
      if (
        options.format !== 'es' ||
        !options.preserveModules ||
        !code.includes('import')
      )
        return null
      const analysis = inspectGeneratedCode(code)
      const output = new MagicString(code, { filename: chunk.fileName })
      if (!foldFrozen(this, analysis, chunk, meta.chunks, output)) return null
      return {
        code: output.toString(),
        map: output.generateMap({ hires: true, includeContent: true }),
      }
    },
  }
}
