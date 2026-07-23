import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

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
