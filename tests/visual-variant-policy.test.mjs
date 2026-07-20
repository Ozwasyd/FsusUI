import assert from 'node:assert/strict'
import test from 'node:test'

import {
  readVisualVariantPolicyInputs,
  validateVisualVariantOwnership,
} from '../scripts/check-visual-variant-policy.mjs'
import {
  buildVisualUrl,
  resolveVisualVariant,
  visualProjectTestIgnore,
} from '../scripts/visual-variant.mjs'

const baseline = readVisualVariantPolicyInputs()

test('resolves every project-owned visual dimension from one helper', () => {
  assert.deepEqual(resolveVisualVariant('desktop-light'), {
    theme: 'light',
    compact: false,
    viewportClass: 'desktop',
  })
  assert.deepEqual(resolveVisualVariant('mobile-dark'), {
    theme: 'dark',
    compact: true,
    viewportClass: 'mobile',
  })
  assert.equal(
    buildVisualUrl('form', 'mobile-dark', { state: 'focus' }),
    '/?visual=form&theme=dark&compact=1&state=focus',
  )
  assert.throws(
    () => resolveVisualVariant('tablet-light'),
    /Unknown visual project/u,
  )
})

test('selects desktop, mobile, and cross-theme specs before workers launch', () => {
  assert(visualProjectTestIgnore('mobile-dark').includes('**/audit.spec.ts'))
  assert(
    visualProjectTestIgnore('desktop-dark').includes(
      '**/public-shell-mobile-nav.spec.ts',
    ),
  )
  assert(
    visualProjectTestIgnore('desktop-dark').includes(
      '**/theme-scale-contract.spec.ts',
    ),
  )
  assert(
    !visualProjectTestIgnore('desktop-light').includes(
      '**/theme-scale-contract.spec.ts',
    ),
  )
})

test('accepts the repository visual ownership baseline', () => {
  assert.deepEqual(validateVisualVariantOwnership(baseline), [])
})

const expectMutationRejected = (name, file, mutate, expected) => {
  test(name, () => {
    const specs = new Map(baseline.specs)
    specs.set(file, mutate(specs.get(file)))
    const violations = validateVisualVariantOwnership({ ...baseline, specs })
    assert(
      violations.some((violation) => violation.includes(expected)),
      violations.join('\n'),
    )
  })
}

expectMutationRejected(
  'rejects an unregistered nested theme dimension',
  'capture-all.spec.ts',
  (source) => `${source}\nfor (const theme of ['light', 'dark']) void theme\n`,
  'not a registered cross-theme contract',
)

expectMutationRejected(
  'rejects a shared hand-written screenshot path',
  'capture-all.spec.ts',
  (source) =>
    `${source}\nconst unsafe = 'screenshots/shared.png'\nvoid unsafe\n`,
  'hand-written shared screenshot directory',
)

expectMutationRejected(
  'rejects local project-name parsing',
  'material-contract.spec.ts',
  (source) =>
    `${source}\nconst dark = projectName.includes('dark')\nvoid dark\n`,
  'local project-name parsing',
)

test('rejects removal of pre-launch project selection', () => {
  const previewConfig = baseline.previewConfig.replace(
    "testIgnore: visualProjectTestIgnore('mobile-light'),",
    '',
  )
  const violations = validateVisualVariantOwnership({
    ...baseline,
    previewConfig,
  })
  assert(
    violations.some((violation) =>
      violation.includes(
        'mobile-light must use canonical spec ownership selection',
      ),
    ),
    violations.join('\n'),
  )
})
