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

const assertTableRow = (content, cells, file) => {
  const pattern = new RegExp(
    `${cells.map((cell) => String.raw`\|\s*${escapeRegExp(cell)}\s*`).join('')}\\|`,
    'u',
  )
  assert(
    pattern.test(content),
    `${file} must include table row ${cells.join(' | ')}`,
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
  assertEquals(
    actionPrimary.modeValues?.dark?.value,
    '#4B79CC',
    'Dark Scholarly Blue token drift',
  )
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
    token('color.text.primary').modeValues?.dark?.value,
    '#F0F0F4',
    'Dark Ink token drift',
  )
  assertEquals(
    token('color.surface.base').modeValues?.dark?.value,
    '#121214',
    'Dark Paper token drift',
  )
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
  assertEquals(
    token('component.button.padding.x').value,
    '{space.4}',
    'Button padding token drift',
  )
  assertEquals(
    token('component.dialog.padding').value,
    '24px',
    'Dialog padding token drift',
  )
  assertEquals(
    token('component-state.button.primary.background.default').value,
    '{color.text.primary}',
    'Primary Button must use Ink',
  )
  assertEquals(
    token('component-state.button.primary.background.hover').value,
    '{color.action.primary}',
    'Primary Button hover must use Scholarly Blue',
  )

  const design = read('docs/design.md')
  for (const row of [
    ['Small control', '`4px`'],
    ['Control', '`6px`'],
    ['Popover', '`10px`'],
    ['Panel', '`12px`'],
    ['Control radius', '`6px`'],
    ['Small control radius', '`4px`'],
    ['Backdrop blur', '`0px`'],
    ['Panel shadow', '`none`'],
  ]) {
    assertTableRow(design, row, 'docs/design.md')
  }
  for (const expected of [
    'glass/SaaS-first',
    '--fsus-shadow-panel: none',
    'Platform-neutral canonical source',
    '`400`、`500`、`700`',
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
    '--el-color-primary: var(--fsus-scholarly-blue);',
    '--fsus-button-primary-bg: var(--fsus-ink);',
    '--fsus-button-primary-text: var(--fsus-paper);',
    '--fsus-radius-control: 6px;',
    '--fsus-radius-panel: 12px;',
    '--fsus-backdrop-blur: 0px;',
    '--fsus-shadow-panel: none;',
    'Element Plus interaction primary mapped to Scholarly Blue.',
    'Accent for links, active states, focus rings, and selection.',
  ]) {
    assertIncludes(themeDocs, expected, 'docs/theme/tokens.md')
  }
  for (const stale of [
    '--el-color-primary: #2a599c;',
    '--el-color-primary: var(--fsus-ink);',
    'Element Plus compatibility primary mapped to Ink by default.',
    '--fsus-backdrop-blur: 12px;',
    'Primary action and emphasis color.',
  ]) {
    assertNotIncludes(themeDocs, stale, 'docs/theme/tokens.md')
  }

  const webMapping = read('docs/api/web-contract-mapping.md')
  for (const component of [
    'button',
    'dialog',
    'dropdown',
    'table',
    'textarea',
    'tabs',
    'public-shell',
  ]) {
    assertMappingStatus(webMapping, component, 'matching')
  }
  assertIncludes(
    webMapping,
    'active/focus indicators use Scholarly Blue',
    'docs/api/web-contract-mapping.md',
  )

  const runtimeTokens = read(
    'vue/packages/theme-chalk/src/common/fsus-tokens.scss',
  )
  for (const expected of [
    '--el-color-primary: var(--fsus-scholarly-blue);',
    '--fsus-button-primary-bg: var(--fsus-ink);',
    '--fsus-button-primary-text: var(--fsus-paper);',
    '--fsus-radius-control: 6px;',
    '--fsus-radius-control-small: 4px;',
    '--fsus-radius-panel: 12px;',
    '--fsus-radius-popover: 10px;',
    '--fsus-backdrop-blur: 0px;',
    '--fsus-shadow-panel: none;',
    '--fsus-component-button-padding-x: #{generated.$fsus-component-button-padding-x};',
    '--fsus-component-dialog-padding: #{generated.$fsus-component-dialog-padding};',
  ]) {
    assertIncludes(
      runtimeTokens,
      expected,
      'vue/packages/theme-chalk/src/common/fsus-tokens.scss',
    )
  }

  const generatedCss = read('vue/packages/theme-chalk/src/generated/tokens.css')
  assertIncludes(
    generatedCss,
    '--fsus-scholarly-blue: var(--fsus-color-action-primary);',
    'vue/packages/theme-chalk/src/generated/tokens.css',
  )
  assertNotIncludes(
    generatedCss,
    '--el-color-primary: var(--fsus-color-action-primary);',
    'vue/packages/theme-chalk/src/generated/tokens.css',
  )
  for (const expected of [
    '--fsus-component-button-padding-x: 16px;',
    '--fsus-component-dialog-padding: 24px;',
    '--fsus-component-state-button-primary-background-default: #0F0F11;',
    '--fsus-color-surface-base: #121214;',
    '--fsus-component-state-button-primary-background-default: #F0F0F4;',
  ]) {
    assertIncludes(
      generatedCss,
      expected,
      'vue/packages/theme-chalk/src/generated/tokens.css',
    )
  }

  const webTheme = read('vue/packages/theme-chalk/src/fsus-theme.scss')
  for (const expected of [
    'padding: 0 var(--fsus-component-button-padding-x);',
    'background: var(--fsus-component-state-button-primary-background-default);',
    'background: var(--fsus-component-state-button-primary-background-hover);',
  ]) {
    assertIncludes(
      webTheme,
      expected,
      'vue/packages/theme-chalk/src/fsus-theme.scss',
    )
  }

  const avaloniaTokens = read(
    'dotnet/FsusUI.Avalonia.Themes/Generated/FsusTokens.axaml',
  )
  for (const expected of [
    '<Thickness x:Key="FsusComponentButtonPaddingX">16</Thickness>',
    '<Thickness x:Key="FsusComponentDialogPadding">24</Thickness>',
    '<SolidColorBrush x:Key="FsusComponentStateButtonPrimaryBackgroundDefault" Color="#0F0F11" />',
  ]) {
    assertIncludes(
      avaloniaTokens,
      expected,
      'dotnet/FsusUI.Avalonia.Themes/Generated/FsusTokens.axaml',
    )
  }

  const avaloniaDark = read(
    'dotnet/FsusUI.Avalonia.Themes/Themes/FsusDark.axaml',
  )
  assertIncludes(
    avaloniaDark,
    'x:Key="FsusThemeBackgroundBrush" Color="#121214"',
    'dotnet/FsusUI.Avalonia.Themes/Themes/FsusDark.axaml',
  )
  const avaloniaButton = read(
    'dotnet/FsusUI.Avalonia.Themes/Themes/Controls/Button.axaml',
  )
  for (const expected of [
    'Property="Padding" Value="16,6"',
    'FsusComponentStateButtonPrimaryBackgroundDefault',
    'FsusComponentStateButtonPrimaryBackgroundHover',
  ]) {
    assertIncludes(
      avaloniaButton,
      expected,
      'dotnet/FsusUI.Avalonia.Themes/Themes/Controls/Button.axaml',
    )
  }

  console.log('design-source-drift check passed')
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
}
