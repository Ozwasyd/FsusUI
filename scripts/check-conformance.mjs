import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
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
  'dialog',
  'tabs',
  'menu',
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
    'packages/theme-chalk/src/generated/tokens.css',
    'packages/theme-chalk/src/generated/tokens.scss',
    'packages/theme-chalk/src/generated/tokens.json',
    'dotnet/FsusUI.Avalonia.Themes/Generated/FsusTokens.axaml',
    'dotnet/FsusUI.Avalonia/Generated/FsusTokens.g.cs',
    'docs/theme/generated/tokens.md',
  ]) {
    assert(hash.outputs?.[artifact], `token hash must include ${artifact}`)
    assert(exists(artifact), `${artifact} must exist`)
  }
  const webTokenBridge = read(
    'packages/theme-chalk/src/common/fsus-tokens.scss',
  )
  assertIncludes(
    webTokenBridge,
    "@use '../generated/tokens'",
    'packages/theme-chalk/src/common/fsus-tokens.scss',
  )
  console.log('conformance:tokens passed')
}

const checkContracts = () => {
  const file = 'spec/components/avalonia-first-subset.yaml'
  const contract = read(file)
  const webMappingFile = 'docs/api/web-contract-mapping.md'
  const webMapping = read(webMappingFile).toLowerCase()
  for (const component of requiredComponents) {
    assertIncludes(contract, `id: ${component}`, file)
    assertIncludes(webMapping, component, webMappingFile)
  }
  for (const key of [
    'props:',
    'states:',
    'keyboard:',
    'accessibility:',
    'tokens:',
  ]) {
    assertIncludes(contract, key, file)
  }
  console.log('conformance:contracts passed')
}

const checkInteractions = () => {
  const file = 'tests/conformance/interactions/basic-controls.yaml'
  const webFile = 'tests/conformance/interactions/web-first-subset.yaml'
  const traces = read(file)
  const webTraces = read(webFile)
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
  console.log('conformance:interactions passed')
}

const checkVisual = () => {
  for (const file of [
    'tests/conformance/visual/thresholds.md',
    'tests/conformance/visual/avalonia-demo-baseline.md',
    'tests/conformance/visual/web-demo-baseline.md',
    'tests/conformance/visual/icon-alignment.md',
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
  for (const icon of ['search', 'settings', 'warning', 'chevron-right']) {
    assertIncludes(icons, icon, 'tests/conformance/visual/icon-alignment.md')
  }
  console.log('conformance:visual passed')
}

const checkA11y = () => {
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
