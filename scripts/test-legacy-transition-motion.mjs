import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { compile } from 'sass'
import { validateLegacyTransitionContract } from './legacy-transition-contract.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const themeRoot = path.join(root, 'vue/packages/theme-chalk/src')
const read = (relative) => readFileSync(path.join(root, relative), 'utf8')
const css = (file) =>
  compile(path.join(themeRoot, file), {
    loadPaths: [themeRoot],
    style: 'expanded',
  }).css
const baseline = {
  root,
  registry: JSON.parse(read('spec/motion/legacy-transition-registry.json')),
  transitionCss: css('common/transition.scss'),
  uploadCss: css('upload.scss'),
  motionSource: read('vue/packages/theme-chalk/src/motion.scss'),
  aliasesSource: read('vue/packages/motion/presets/index.ts'),
}

assert.deepEqual(validateLegacyTransitionContract(baseline), [])

const mutations = [
  [
    'axis scale X',
    {
      transitionCss: `${baseline.transitionCss}\n.el-zoom-in-center-enter-from { transform: scaleX(0); }`,
    },
  ],
  [
    'axis scale Y',
    {
      transitionCss: `${baseline.transitionCss}\n.el-zoom-in-center-enter-from { transform: scaleY(0); }`,
    },
  ],
  [
    'strong scale .45',
    {
      transitionCss: baseline.transitionCss.replace(
        'scale: 0.98',
        'scale: 0.45',
      ),
    },
  ],
  [
    'scale below contract',
    {
      transitionCss: baseline.transitionCss.replace(
        'scale: 0.98',
        'scale: 0.95',
      ),
    },
  ],
  [
    'list displacement 30px',
    {
      transitionCss: baseline.transitionCss.replace(
        'translateY(-8px)',
        'translateY(-30px)',
      ),
    },
  ],
  [
    'unregistered duration',
    {
      transitionCss: baseline.transitionCss.replace(
        'var(--fsus-motion-control, 220ms)',
        '500ms',
      ),
    },
  ],
  [
    'transition none',
    {
      transitionCss: baseline.transitionCss.replace(
        /transition:\s*opacity/u,
        'transition: none; /* opacity',
      ),
    },
  ],
  [
    'second visual owner',
    {
      motionSource: `${baseline.motionSource}\n.el-zoom-in-center-enter-from { opacity: 0; }`,
    },
  ],
  [
    'wrong placement',
    {
      transitionCss: baseline.transitionCss.replace(
        'translate: 6px 0',
        'translate: -6px 0',
      ),
    },
  ],
  [
    'stagger',
    {
      transitionCss: `${baseline.transitionCss}\n.el-list-enter-active { transition-delay: 25ms; /* stagger */ }`,
    },
  ],
  [
    'missing consumer',
    {
      registry: {
        ...baseline.registry,
        recipes: baseline.registry.recipes.map((recipe) =>
          recipe.id === 'legacy-inline-feedback'
            ? { ...recipe, consumers: recipe.consumers.slice(1) }
            : recipe,
        ),
      },
    },
  ],
]

for (const [name, mutation] of mutations) {
  const failures = validateLegacyTransitionContract({
    ...baseline,
    ...mutation,
  })
  assert.ok(failures.length > 0, `${name} mutation survived`)
}

console.log(
  `legacy transition mutation corpus passed (${mutations.length} independent mutants killed).`,
)
