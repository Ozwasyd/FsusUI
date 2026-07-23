import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { URL } from 'node:url'

const source = readFileSync(
  new URL(
    '../vue/packages/demo-app/src/sections/FormSection.vue',
    import.meta.url,
  ),
  'utf8',
)

test('production form fixtures cover real field compositions', () => {
  for (const fixture of [
    'full-width',
    'short-values',
    'inline-pair',
    'upload',
    'states',
  ]) {
    assert.match(source, new RegExp(`data-form-fixture="${fixture}"`))
  }
  for (const taskCopy of [
    'Publish an editorial update',
    'Choose who can read this update',
    'Checking release policy',
  ]) {
    assert.match(source, new RegExp(taskCopy))
  }
  assert.doesNotMatch(source, />\\s*(?:Item \\d+|Option [A-Z])\\s*</)
})

test('production form fixture owns responsive width and rhythm contracts', () => {
  for (const contract of [
    'max-width: 640px;',
    'margin-bottom: 8px;',
    'margin-bottom: 16px;',
    'margin-top: 28px;',
    'grid-template-columns: repeat(2, minmax(0, 1fr));',
    'grid-template-columns: minmax(160px, 180px) minmax(220px, 240px);',
    '@media (max-width: 479px)',
    'grid-template-columns: minmax(0, 1fr);',
  ]) {
    assert.ok(source.includes(contract), `missing contract: ${contract}`)
  }
})

test('production form fixture exposes locale and state stress cases', () => {
  for (const contract of [
    "'data-form-language'",
    'data-testid="form-language-en"',
    'data-testid="form-language-zh-CN"',
    "'data-testid': 'form-validation-toggle'",
    "'data-form-state': 'empty'",
    "'data-form-state': 'disabled'",
    "'data-form-state': 'loading'",
    'task-copy-stress--long-label',
    'task-copy-stress--long-helper',
    'task-copy-stress--error',
    '发布一条编辑更新',
    'Publish an editorial update',
  ]) {
    assert.ok(source.includes(contract), `missing stress contract: ${contract}`)
  }

  for (const geometryContract of [
    '.task-form-fixture :deep(.el-input-number)',
    'grid-column: 1 / -1;',
    'overflow-wrap: anywhere;',
    'white-space: normal;',
  ]) {
    assert.ok(
      source.includes(geometryContract),
      `missing geometry stress contract: ${geometryContract}`,
    )
  }
})
