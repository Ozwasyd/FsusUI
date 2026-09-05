import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { compile } from 'sass'
import { assertLegacyTransitionContract } from './legacy-transition-contract.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const themeRoot = path.join(root, 'vue/packages/theme-chalk/src')
const read = (relative) => readFileSync(path.join(root, relative), 'utf8')
const css = (file) =>
  compile(path.join(themeRoot, file), {
    loadPaths: [themeRoot],
    style: 'expanded',
  }).css

assertLegacyTransitionContract({
  root,
  registry: JSON.parse(read('spec/motion/legacy-transition-registry.json')),
  transitionCss: css('common/transition.scss'),
  uploadCss: css('upload.scss'),
  motionSource: read('vue/packages/theme-chalk/src/motion.scss'),
  aliasesSource: read('vue/packages/motion/presets/index.ts'),
})

console.log(
  'legacy transition contract passed (registry, consumers, states, placements, terminal modes).',
)
