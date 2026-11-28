import { describe, expect, it } from 'vitest'

import {
  formatMarkdownTable,
  insertMarkdownTable,
} from '../src/markdown-editor-table'

describe('markdown editor leftover table planner', () => {
  it('inserts a 2 by 2 Markdown table as one source fragment', () => {
    expect(insertMarkdownTable({ rows: 2, columns: 2 })).toBe(
      [
        '| Column 1 | Column 2 |',
        '| --- | --- |',
        '|  |  |',
        '|  |  |',
      ].join('\n'),
    )
  })

  it('keeps surrounding prose, :---: alignment, and escaped cells', () => {
    const source = `before\n\n| name | note |\n| --- | :---: |\n| a\\|b | \`x | y\` |\n\nafter\n`
    const formatted = formatMarkdownTable(source)
    expect(formatted).toContain('before')
    expect(formatted).toContain('after')
    expect(formatted).toContain('| --- | :---: |')
    expect(formatted).toContain('a\\|b')
    expect(formatted).toContain('`x | y`')
  })
})
