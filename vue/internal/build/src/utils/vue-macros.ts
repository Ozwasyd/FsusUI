import path from 'node:path'
import { createRequire } from 'node:module'
import { epRoot, projRoot } from '@element-plus/build-utils'
import type VueMacros from 'unplugin-vue-macros/rollup'

const buildRequire = createRequire(
  path.join(projRoot, 'vue/internal/build/package.json'),
)
const macroEntry = buildRequire.resolve('unplugin-vue-macros/rollup')
const macroRequire = createRequire(macroEntry)
const apiRequire = createRequire(
  macroRequire.resolve('@vue-macros/better-define'),
)
const factory: typeof VueMacros = buildRequire(macroEntry)
const api = apiRequire('@vue-macros/api') as {
  resolveDts(id: string, importer: string): Promise<string | undefined>
  getTSFile(file: string): Promise<unknown>
  resolveTSNamespace(scope: unknown): Promise<void>
}
let initialized: Promise<void> | undefined

// The pinned macro resolver publishes its namespace before its async imports
// finish. Complete Vue's shared type graph before parallel SFC transforms can
// observe that partial cache. Load the factory and API from the same CJS graph.
export const createVueMacros = async (
  options: Parameters<typeof VueMacros>[0],
) => {
  initialized ??= (async () => {
    const entry = await api.resolveDts('vue', path.join(epRoot, 'index.ts'))
    if (!entry) throw new Error('Cannot resolve the Vue macro type owner.')
    await api.resolveTSNamespace(await api.getTSFile(entry))
  })()
  await initialized
  return factory(options)
}
