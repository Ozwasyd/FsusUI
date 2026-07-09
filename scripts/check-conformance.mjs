import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const requiredComponents = [
  'button',
  'icon-button',
  'input',
  'textarea',
  'checkbox',
  'radio',
  'switch',
  'form',
  'card',
  'divider',
  'tag',
  'badge',
  'alert',
  'dialog',
  'tabs',
  'menu',
]

const interactionComponents = [
  'button',
  'input',
  'checkbox',
  'radio',
  'switch',
  'form',
  'dialog',
  'tabs',
  'menu',
]

const complexComponents = [
  'data-table',
  'virtual-list',
  'log-viewer',
  'terminal-panel',
  'markdown-viewer',
  'markdown-editor',
  'file-manager',
  'tree',
  'tree-table',
  'code-block',
]

const read = (relativePath) =>
  fs.readFileSync(path.join(root, relativePath), 'utf8')

const exists = (relativePath) => fs.existsSync(path.join(root, relativePath))

const assert = (condition, message) => {
  if (!condition) throw new Error(message)
}

const assertIncludes = (content, expected, file) => {
  assert(content.includes(expected), `${file} must include ${expected}`)
}

const checkTokens = () => {
  const hash = JSON.parse(read('generated/tokens.hash.json'))
  assert(
    hash.source === 'spec/tokens/tokens.json',
    'token hash source mismatch',
  )
  assert(
    hash.note?.includes('Do not edit manually.'),
    'token hash must mark generated metadata',
  )
  for (const artifact of [
    'vue/packages/theme-chalk/src/generated/tokens.css',
    'vue/packages/theme-chalk/src/generated/tokens.scss',
    'vue/packages/theme-chalk/src/generated/tokens.json',
    'dotnet/FsusUI.Avalonia.Themes/Generated/FsusTokens.axaml',
    'dotnet/FsusUI.Avalonia/Generated/FsusTokens.g.cs',
    'docs/theme/generated/tokens.md',
  ]) {
    assert(hash.outputs?.[artifact], `token hash must include ${artifact}`)
    assert(exists(artifact), `${artifact} must exist`)
  }
  const webTokenBridge = read(
    'vue/packages/theme-chalk/src/common/fsus-tokens.scss',
  )
  assertIncludes(
    webTokenBridge,
    "@use '../generated/tokens'",
    'vue/packages/theme-chalk/src/common/fsus-tokens.scss',
  )
  console.log('conformance:tokens passed')
}

const checkContracts = () => {
  execFileSync(
    process.execPath,
    ['scripts/component-contract-registry.mjs', '--check'],
    {
      cwd: root,
      stdio: 'inherit',
    },
  )
  const webMappingFile = 'docs/api/web-contract-mapping.md'
  const webMapping = read(webMappingFile).toLowerCase()
  for (const component of requiredComponents) {
    assertIncludes(webMapping, component, webMappingFile)
  }
  const complexSpecFile = 'spec/components/complex-components-roadmap.yaml'
  const complexDocsFile = 'docs/avalonia/complex-components-roadmap.md'
  const complexSpec = read(complexSpecFile)
  const complexDocs = read(complexDocsFile).toLowerCase()
  for (const component of complexComponents) {
    assertIncludes(complexSpec, `id: ${component}`, complexSpecFile)
    assertIncludes(
      complexDocs,
      component.replaceAll('-', '').toLowerCase(),
      complexDocsFile,
    )
  }
  assertIncludes(
    complexDocs,
    'does not imply parity',
    'docs/avalonia/complex-components-roadmap.md',
  )
  console.log('conformance:contracts passed')
}

const checkInteractions = () => {
  execFileSync(
    process.execPath,
    ['scripts/interaction-conformance.mjs', 'check'],
    {
      cwd: root,
      stdio: 'inherit',
    },
  )
  const file = 'tests/conformance/interactions/basic-controls.yaml'
  const webFile = 'tests/conformance/interactions/web-first-subset.yaml'
  const avaloniaMotionFile =
    'tests/conformance/interactions/avalonia-motion.yaml'
  const avaloniaOverlayFile =
    'tests/conformance/interactions/avalonia-overlay.yaml'
  const traces = read(file)
  const webTraces = read(webFile)
  const avaloniaMotionTraces = read(avaloniaMotionFile)
  const avaloniaOverlayTraces = read(avaloniaOverlayFile)
  for (const component of interactionComponents) {
    assertIncludes(traces, `component: ${component}`, file)
  }
  for (const component of ['button', 'icon-button', 'input']) {
    assertIncludes(webTraces, `component: ${component}`, webFile)
  }
  for (const step of ['pointerover', 'focus', 'keyboard', 'assert']) {
    assertIncludes(traces, step, file)
    assertIncludes(webTraces, step, webFile)
  }
  assertIncludes(webTraces, 'web-table-actions-motion-safe', webFile)
  for (const term of ['reduced', 'disabled', 'terminal', 'focusTarget']) {
    assertIncludes(avaloniaMotionTraces, term, avaloniaMotionFile)
  }
  for (const term of [
    'modalStack',
    'restoredFocus',
    'cancellable',
    'dpiAware',
  ]) {
    assertIncludes(avaloniaOverlayTraces, term, avaloniaOverlayFile)
  }
  console.log('conformance:interactions passed')
}

const checkVisual = () => {
  execFileSync(process.execPath, ['scripts/visual-conformance.mjs', 'check'], {
    cwd: root,
    stdio: 'inherit',
  })
  for (const file of [
    'tests/conformance/visual/thresholds.md',
    'tests/conformance/visual/avalonia-demo-baseline.md',
    'tests/conformance/visual/web-demo-baseline.md',
    'tests/conformance/visual/icon-alignment.md',
    'tests/conformance/visual/icon-baselines.json',
  ]) {
    assert(exists(file), `${file} must exist`)
  }
  const thresholds = read('tests/conformance/visual/thresholds.md')
  for (const term of [
    'color delta',
    'spacing delta',
    'radius delta',
    'text baseline',
  ]) {
    assertIncludes(thresholds, term, 'tests/conformance/visual/thresholds.md')
  }
  const icons = read('tests/conformance/visual/icon-alignment.md')
  const baseline = JSON.parse(
    read('tests/conformance/visual/icon-baselines.json'),
  )
  assert(
    baseline.viewport === '0 0 1024 1024',
    'icon baseline viewport mismatch',
  )
  for (const icon of ['search', 'settings', 'warning', 'chevron-right']) {
    assertIncludes(icons, icon, 'tests/conformance/visual/icon-alignment.md')
    const baselineIcon = baseline.icons?.find((entry) => entry.id === icon)
    assert(baselineIcon, `icon baseline must include ${icon}`)
    assert(
      baselineIcon.avaloniaResourceKey?.startsWith('FsusIcon'),
      `${icon} must include an Avalonia resource key`,
    )
    assert(
      baselineIcon.vueComponent,
      `${icon} must include a Vue component mapping`,
    )
  }
  console.log('conformance:visual passed')
}

const checkA11y = () => {
  execFileSync(
    process.execPath,
    ['scripts/accessibility-conformance.mjs', 'check'],
    {
      cwd: root,
      stdio: 'inherit',
    },
  )
  const file = 'tests/conformance/accessibility/first-subset.md'
  const content = read(file)
  for (const component of [
    'Button',
    'Input',
    'Checkbox',
    'Dialog',
    'Tabs',
    'Menu',
  ]) {
    assertIncludes(content, component, file)
  }
  for (const term of [
    'accessible name',
    'focus order',
    'disabled',
    'keyboard',
    'Icon-only button',
  ]) {
    assertIncludes(content, term, file)
  }
  console.log('conformance:a11y passed')
}

const checkPlatformOverrides = () => {
  execFileSync(process.execPath, ['scripts/check-platform-overrides.mjs'], {
    cwd: root,
    stdio: 'inherit',
  })
  for (const file of [
    'spec/platform-overrides/README.md',
    'tests/conformance/platform-overrides/metadata.md',
  ]) {
    assert(exists(file), `${file} must exist`)
  }
  const metadata = read('tests/conformance/platform-overrides/metadata.md')
  for (const field of ['id', 'reason', 'test policy', 'owner', 'review date']) {
    assertIncludes(
      metadata,
      field,
      'tests/conformance/platform-overrides/metadata.md',
    )
  }
  console.log('conformance:platform-overrides passed')
}

const checks = {
  tokens: checkTokens,
  contracts: checkContracts,
  interactions: checkInteractions,
  visual: checkVisual,
  a11y: checkA11y,
  'platform-overrides': checkPlatformOverrides,
}

const command = process.argv[2] ?? 'all'

try {
  if (command === 'all') {
    for (const check of Object.values(checks)) check()
  } else {
    const check = checks[command]
    assert(check, `Unknown conformance check ${command}`)
    check()
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
}
