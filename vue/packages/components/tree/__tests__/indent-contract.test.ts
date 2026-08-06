import { describe, expect, test } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const dirname = path.dirname(fileURLToPath(import.meta.url))

describe('Tree hierarchy indent contract (#296)', () => {
  test('Tree default indent is the shared 24px contract', () => {
    const source = readFileSync(
      path.resolve(dirname, '../src/tree.vue'),
      'utf8',
    )
    expect(source).toMatch(
      /indent:\s*\{\s*type:\s*Number,\s*(?:\/\/[^\n]*\n\s*)*default:\s*24,/,
    )
    expect(source).not.toMatch(
      /indent:\s*\{\s*type:\s*Number,\s*default:\s*18,/,
    )
  })

  test('TreeV2 default indent matches Tree at 24px', () => {
    const virtualTree = readFileSync(
      path.resolve(dirname, '../../tree-v2/src/virtual-tree.ts'),
      'utf8',
    )
    const node = readFileSync(
      path.resolve(dirname, '../../tree-v2/src/tree-node.vue'),
      'utf8',
    )
    expect(virtualTree).toMatch(
      /indent:\s*\{\s*type:\s*Number,\s*(?:\/\/[^\n]*\n\s*)*default:\s*24,/,
    )
    expect(node).toContain('tree?.props.indent ?? 24')
    expect(virtualTree).not.toMatch(
      /indent:\s*\{\s*type:\s*Number,\s*default:\s*16,/,
    )
    expect(node).not.toContain('tree?.props.indent ?? 16')
  })
})
