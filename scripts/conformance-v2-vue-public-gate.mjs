#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { enrichComponentWithSemantics } from './vue-semantic-baseline.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const baseline = JSON.parse(
  fs.readFileSync(path.join(root, 'spec/baselines/vue-current.json'), 'utf8'),
)
const expected = baseline.components.find(
  (component) => component.name === 'ElMarkdownEditor',
)
if (!expected) throw new Error('ElMarkdownEditor Vue baseline missing')

const actual = enrichComponentWithSemantics({ root, component: expected })
for (const field of ['props', 'emits', 'exposed']) {
  const wanted = expected.semantic?.[field] ?? []
  const current = actual.semantic[field]
  if (JSON.stringify(current) !== JSON.stringify(wanted)) {
    throw new Error(
      `Vue public ${field} drift expected=${JSON.stringify(wanted)} actual=${JSON.stringify(current)}`,
    )
  }
}
console.log('Contract V2 Vue public semantic gate passed')
