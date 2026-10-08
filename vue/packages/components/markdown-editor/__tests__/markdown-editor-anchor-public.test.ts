import { describe, expect, it } from 'vitest'

import {
  currentMarkdownAnchors,
  planMarkdownAnchorEdit,
  planMarkdownAnchorInsert,
  planMarkdownAnchorRemove,
} from '../index'
import * as publicApi from '../../../element-plus'
import * as commands from '../src/markdown-editor-anchor-commands'

describe('markdown anchor public commands', () => {
  it.each([
    'currentMarkdownAnchors',
    'planMarkdownAnchorInsert',
    'planMarkdownAnchorEdit',
    'planMarkdownAnchorRemove',
  ] as const)(
    'exports the existing %s function through the package root',
    (name) => {
      expect(publicApi[name]).toBe(commands[name])
    },
  )

  it('plans exact BOM/CRLF source ranges through the public commands', () => {
    const source = '\uFEFFParagraph ^intro\r\n'
    const [anchor] = currentMarkdownAnchors(source)
    expect(anchor).toBeDefined()
    expect(planMarkdownAnchorEdit(source, anchor!, 'renamed')).toEqual({
      changes: [
        {
          from: source.indexOf('intro'),
          to: source.indexOf('\r'),
          insert: 'renamed',
        },
      ],
      history: 'separate',
      origin: 'command',
    })
    expect(planMarkdownAnchorRemove(anchor!, source)).toEqual({
      changes: [
        {
          from: source.indexOf(' ^intro'),
          to: source.indexOf('\r'),
          insert: '',
        },
      ],
      history: 'separate',
      origin: 'command',
    })
    expect(
      planMarkdownAnchorInsert('```\r\ncode\r\n```', 14, 'code', {
        placement: 'following-line',
      }).changes,
    ).toEqual([{ from: 14, to: 14, insert: '\r\n^code' }])
  })

  it.each(['bad_name', '章节', 'a'.repeat(65), 'intro\n', 'intro\r\n'])(
    'rejects invalid %j in insert and edit planners',
    (id) => {
      expect(() => planMarkdownAnchorInsert('Paragraph', 9, id)).toThrow(
        'Invalid anchor id',
      )
      const source = 'Paragraph ^intro'
      const [anchor] = currentMarkdownAnchors(source)
      expect(() => planMarkdownAnchorEdit(source, anchor!, id)).toThrow(
        'Invalid anchor id',
      )
    },
  )
})
