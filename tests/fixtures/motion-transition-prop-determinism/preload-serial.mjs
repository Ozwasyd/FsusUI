import { createRequire } from 'node:module'
import path from 'node:path'

// Diagnostic producer context only; this is not a build integration repair.
if (process.argv.some((value) => value.endsWith('/gulp.js'))) {
  const root = process.env.MOTION_REPRO_ROOT
  const require = createRequire(path.join(root, 'package.json'))
  const api = require('@vue-macros/api')
  const file = path.join(
    root,
    'vue/packages/motion/components/FsuTransition.vue',
  )
  const scopes = []
  for (const name of ['vue', '@vue/runtime-dom', '@vue/runtime-core']) {
    scopes.push(await api.getTSFile(await api.resolveDts(name, file)))
  }
  for (const scope of scopes) await api.resolveTSNamespace(scope)
  if (!scopes[1].declarations.BaseTransitionProps) {
    throw new Error('Serial namespace preflight failed')
  }
  process.stdout.write(
    '[Motion reproduction] serial namespace context established through API0.13.4\n',
  )
}
