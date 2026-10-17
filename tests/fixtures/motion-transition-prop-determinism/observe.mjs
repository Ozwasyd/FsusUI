import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'

const root = path.resolve(process.argv[2])
const context = process.argv[3]
const require = createRequire(path.join(root, 'package.json'))
const macroRequire = createRequire(
  require.resolve('unplugin-vue-macros/rollup'),
)
const api = macroRequire('@vue-macros/api')
const { transformBetterDefine } = macroRequire('@vue-macros/better-define/api')
const file = path.join(root, 'vue/packages/motion/components/FsuTransition.vue')
const source = await readFile(file, 'utf8')
const sha256 = (value) => createHash('sha256').update(value).digest('hex')
const versions = Object.fromEntries(
  ['@vue-macros/better-define', '@vue-macros/api', 'vue'].map((name) => [
    name,
    macroRequire(`${name}/package.json`).version,
  ]),
)

let namespace
let warmCount = 0
if (context === 'namespace-readiness') {
  const scope = await api.getTSFile(await api.resolveDts('vue', file))
  const first = api.resolveTSNamespace(scope)
  const publishedBeforeCompletion = Boolean(scope.exports)
  await api.resolveTSNamespace(scope)
  const secondCallHasTransitionProps = Boolean(scope.exports.TransitionProps)
  await first
  namespace = {
    publishedBeforeCompletion,
    secondCallHasTransitionProps,
    completedHasTransitionProps: Boolean(scope.exports.TransitionProps),
  }
} else if (context.endsWith('-namespaces')) {
  // Same real declaration files and cache identities; only scheduling differs.
  const names = ['vue', '@vue/runtime-dom', '@vue/runtime-core']
  const scopes = []
  for (const name of names) {
    scopes.push(await api.getTSFile(await api.resolveDts(name, file)))
  }
  if (context === 'serial-namespaces') {
    for (const scope of scopes) await api.resolveTSNamespace(scope)
  } else {
    assert.equal(context, 'concurrent-namespaces')
    await Promise.all(scopes.map((scope) => api.resolveTSNamespace(scope)))
  }
  namespace = {
    coreExportsBaseTransitionProps: Boolean(
      scopes[2].exports.BaseTransitionProps,
    ),
    domImportsBaseTransitionProps: Boolean(
      scopes[1].declarations.BaseTransitionProps,
    ),
    vueExportsBaseTransitionProps: Boolean(
      scopes[0].exports.BaseTransitionProps,
    ),
  }
} else if (context === 'concurrent-components') {
  const files = await require('fast-glob')('vue/packages/**/*.vue', {
    cwd: root,
    absolute: true,
  })
  assert.ok(files.length > 0)
  const results = await Promise.allSettled(
    files.map(async (input) =>
      transformBetterDefine(await readFile(input, 'utf8'), input, false),
    ),
  )
  const errors = results.flatMap((result, index) =>
    result.status === 'rejected'
      ? [new Error(`${path.relative(root, files[index])}: ${result.reason}`)]
      : [],
  )
  if (errors.length)
    throw new AggregateError(errors, 'Component warm-up failed')
  warmCount = files.length
} else {
  assert.equal(context, 'cold')
}

const rows = []
for (const production of [false, true, false]) {
  const result = await transformBetterDefine(source, file, production)
  assert.ok(result?.code)
  const modeLine = result.code.match(/^\s*mode: ([^\n]+)/m)?.[1]
  assert.ok(modeLine)
  rows.push({
    production,
    modeLine,
    sha256: sha256(result.code),
    code: result.code,
  })
}
process.stdout.write(
  `${JSON.stringify({ context, node: process.version, versions, sourceSha256: sha256(source), warmCount, namespace, rows })}\n`,
)
