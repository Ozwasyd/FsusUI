import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const read = (relativePath) =>
  fs.readFileSync(path.join(root, relativePath), 'utf8')

const assert = (condition, message) => {
  if (!condition) throw new Error(message)
}

const assertEquals = (actual, expected, message) => {
  assert(actual === expected, `${message}: expected ${expected}, got ${actual}`)
}

const assertIncludes = (content, expected, file) => {
  assert(content.includes(expected), `${file} must include ${expected}`)
}

const assertNotIncludes = (content, expected, file) => {
  assert(!content.includes(expected), `${file} must not include ${expected}`)
}

const escapeRegExp = (value) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`)

const assertMappingStatus = (content, component, status) => {
  const pattern = new RegExp(
    String.raw`\|\s*${escapeRegExp(component)}\s*\|[^\n]*\|\s*${status}\s*\|`,
  )
  assert(
    pattern.test(content),
    `docs/api/web-contract-mapping.md must mark ${component} as ${status}`,
  )
}

try {
  const source = JSON.parse(read('spec/tokens/tokens.json'))
  const tokens = new Map(source.tokens.map((token) => [token.name, token]))
  const token = (name) => {
    const result = tokens.get(name)
    assert(result, `Missing token ${name}`)
    return result
  }

  const actionPrimary = token('color.action.primary')
  assertEquals(actionPrimary.value, '#2A599C', 'Scholarly Blue token drift')
  assert(
    !actionPrimary.aliases?.includes('--el-color-primary'),
    'color.action.primary must not alias --el-color-primary',
  )
  assert(
    actionPrimary.aliases?.includes('--fsus-scholarly-blue'),
    'color.action.primary must alias --fsus-scholarly-blue',
  )
  assertEquals(token('color.text.primary').value, '#0F0F11', 'Ink token drift')
  assertEquals(
    token('color.surface.raised').value,
    '#F7F7F8',
    'Page surface token drift',
  )
  assertEquals(
    token('color.border.subtle').value,
    '#E4E4E7',
    'Border token drift',
  )
  assertEquals(
    token('radius.control.md').value,
    '6px',
    'Control radius token drift',
  )
  assertEquals(
    token('radius.surface.md').value,
    '12px',
    'Surface radius token drift',
  )
  assertEquals(
    token('shadow.overlay.md').value,
    'none',
    'Default panel shadow token drift',
  )
  assertEquals(
    token('density.control.default.y').value,
    '44px',
    'Default control density token drift',
  )
  assertEquals(
    token('density.control.compact.y').value,
    '40px',
    'Compact control density token drift',
  )

  const design = read('docs/design.md')
  for (const expected of [
    '| Small control | `4px`',
    '| Control       | `6px`',
    '| Popover       | `10px`',
    '| Panel         | `12px`',
    '| Control radius         | `6px`',
    '| Small control radius   | `4px`',
    '| Backdrop blur          | `0px`',
    '| Panel shadow           | `none`',
    'glass/SaaS-first',
    '--fsus-shadow-panel: none',
  ]) {
    assertIncludes(design, expected, 'docs/design.md')
  }
  for (const stale of [
    '| Control radius         | `8px`',
    '| Panel radius           | `24px`',
    '--fsus-backdrop-blur: 40px',
    '--fsus-backdrop-blur-overlay: 16px',
  ]) {
    assertNotIncludes(design, stale, 'docs/design.md')
  }

  const themeDocs = read('docs/theme/tokens.md')
  for (const expected of [
    '--el-color-primary: var(--fsus-ink);',
    '--fsus-radius-control: 6px;',
    '--fsus-radius-panel: 12px;',
    '--fsus-backdrop-blur: 0px;',
    '--fsus-shadow-panel: none;',
    'Element Plus compatibility primary mapped to Ink by default.',
    'Accent for links, active states, focus rings, and selection.',
  ]) {
    assertIncludes(themeDocs, expected, 'docs/theme/tokens.md')
  }
  for (const stale of [
    '--el-color-primary: #2a599c;',
    '--fsus-backdrop-blur: 12px;',
    'Primary action and emphasis color.',
  ]) {
    assertNotIncludes(themeDocs, stale, 'docs/theme/tokens.md')
  }

  const webMapping = read('docs/api/web-contract-mapping.md')
  for (const component of [
    'button',
    'textarea',
    'dialog',
    'tabs',
    'dropdown',
    'table',
    'public-shell',
  ]) {
    assertMappingStatus(webMapping, component, 'partial')
  }
  assertIncludes(
    webMapping,
    'Scholarly Blue active/focus indicators',
    'docs/api/web-contract-mapping.md',
  )

  const runtimeTokens = read('packages/theme-chalk/src/common/fsus-tokens.scss')
  for (const expected of [
    '--el-color-primary: var(--fsus-ink);',
    '--fsus-radius-control: 6px;',
    '--fsus-radius-control-small: 4px;',
    '--fsus-radius-panel: 12px;',
    '--fsus-radius-popover: 10px;',
    '--fsus-backdrop-blur: 0px;',
    '--fsus-shadow-panel: none;',
  ]) {
    assertIncludes(
      runtimeTokens,
      expected,
      'packages/theme-chalk/src/common/fsus-tokens.scss',
    )
  }

  const generatedCss = read('packages/theme-chalk/src/generated/tokens.css')
  assertIncludes(
    generatedCss,
    '--fsus-scholarly-blue: var(--fsus-color-action-primary);',
    'packages/theme-chalk/src/generated/tokens.css',
  )
  assertNotIncludes(
    generatedCss,
    '--el-color-primary: var(--fsus-color-action-primary);',
    'packages/theme-chalk/src/generated/tokens.css',
  )

  console.log('design-source-drift check passed')
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
}
