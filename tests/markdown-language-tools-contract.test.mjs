import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import {
  readMarkdownLanguageToolSources,
  validateMarkdownLanguageToolSources,
} from '../scripts/check-markdown-language-tools-contract.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const mutations = JSON.parse(
  fs.readFileSync(
    path.join(root, 'tests/fixtures/markdown-language-tools/mutations.json'),
    'utf8',
  ),
)
const committed = readMarkdownLanguageToolSources(root)

test('committed Markdown language-tool sources pass the authority contract', () => {
  assert.deepEqual(validateMarkdownLanguageToolSources(committed), [])
})

for (const mutation of mutations) {
  test(`mutation fixture kills ${mutation.name}`, () => {
    const original = committed[mutation.file]
    assert.equal(typeof original, 'string')
    assert.ok(
      original.includes(mutation.find),
      `fixture target not found for ${mutation.name}`,
    )
    const mutated = {
      ...committed,
      [mutation.file]: original.replace(mutation.find, mutation.replace),
    }
    const message = validateMarkdownLanguageToolSources(mutated).join('\n')
    assert.ok(
      message.includes(mutation.expectError),
      `expected ${JSON.stringify(mutation.expectError)} in errors:\n${message}`,
    )
  })
}
