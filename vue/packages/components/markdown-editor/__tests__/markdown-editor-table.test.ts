import { describe, expect, it } from 'vitest'

import {
  formatMarkdownTable,
  insertMarkdownTable,
} from '../src/markdown-editor-table'

describe('markdown editor leftover table planner', () => {
  it('inserts a 2 by 2 Markdown table as one source fragment', () => {
    expect(insertMarkdownTable({ rows: 2, columns: 2 })).toBe(
      [
        '| Column | Column |',
        '| --- | --- |',
        '|  |  |',
        '|  |  |',
      ].join('\n'),
    )
  })

  it('formats a pipe table without rewriting escaped cells', () => {
    const source = '| name | note |\n| --- | :---: |\n| a\\|b | `x | y` |'
    const formatted = formatMarkdownTable(source)
    expect(formatted).toContain('a\\|b')
    expect(formatted.split('\n')[0]).toMatch(/^\| name /)
  })
})
