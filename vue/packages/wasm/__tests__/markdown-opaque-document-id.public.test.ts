import { describe, expect, it } from 'vitest'

import {
  createMarkdownEditorProjection,
  createMarkdownAnchorMap,
  stabilizeMarkdownEditorProjection,
  snapshotMarkdownStableProjection,
  reviveMarkdownStableProjection,
  resolveMarkdownConsumerIdentity,
} from '../../element-plus/markdown-runtime'

describe('public stable projection opaque document IDs (#850)', () => {
  describe.each(['direct', 'revived'] as const)('%s projection', (mode) => {
    const project: typeof stabilizeMarkdownEditorProjection = (...args) => {
      const stable = stabilizeMarkdownEditorProjection(...args)
      return mode === 'revived'
        ? reviveMarkdownStableProjection(
            snapshotMarkdownStableProjection(stable),
          )
        : stable
    }
    it.each([
      'doc-a',
      'document:N',
      'workspace:article:tab',
      ':document:N:',
      '文章:😀:tab',
    ])(
      'preserves canonical encoding and current/deleted/invalid statuses for %s',
      (id) => {
        const document = { id, epoch: 17 }
        const source = '# First\n\n#  \n\n# Named\n'
        const first = project(createMarkdownEditorProjection(source), document)
        expect(first.nodes).toHaveLength(3)
        expect(first.nodes.map((node) => node.id)).toEqual([
          `syn:${id}:17:heading:0`,
          `syn:${id}:17:heading:1`,
          `syn:${id}:17:heading:2`,
        ])
        for (const node of first.nodes) {
          expect(first.resolve(node.id)).toEqual({ status: 'current', node })
          expect(resolveMarkdownConsumerIdentity(first, node.id)).toEqual({
            status: 'current',
            node,
          })
        }
        const anchors = createMarkdownAnchorMap({
          identity: document,
          source,
          projection: first,
          syntax: first.nodes.map((node) => ({
            id: node.id,
            projectionId: node.id,
            range: node.rawRange,
          })),
        })
        expect(anchors.reveal({ anchorId: first.nodes[0]!.id })).toMatchObject({
          documentIdentity: document,
          range: { start: 0, end: 8 },
        })
        const selection = { anchor: 0, focus: 8 }
        expect(
          anchors.visualAnchorToSourceSelection(
            anchors.sourceSelectionToVisual(selection),
          ),
        ).toEqual(selection)
        const prefixed = project(
          createMarkdownEditorProjection(`intro\n\n${source}`),
          document,
          first,
          { from: 0, to: 0, insert: 'intro\n\n' },
        )
        expect(
          prefixed.nodes
            .filter((node) => node.kind === 'heading')
            .map((node) => node.id),
        ).toEqual(first.nodes.map((node) => node.id))
        expect(prefixed.resolve(first.nodes[0]!.id).node?.rawRange.start).toBe(
          7,
        )
        const deleted = project(
          createMarkdownEditorProjection(''),
          document,
          prefixed,
          { from: 0, to: prefixed.normalizedSource.length, insert: '' },
        )
        expect(deleted.resolve(first.nodes[0]!.id)).toEqual({
          status: 'deleted',
        })
        const recreated = project(
          createMarkdownEditorProjection('# First\n'),
          document,
          deleted,
          { from: 0, to: 0, insert: '# First\n' },
        )
        expect(recreated.nodes[0]!.id).not.toBe(first.nodes[0]!.id)
        expect(recreated.resolve(first.nodes[0]!.id)).toEqual({
          status: 'deleted',
        })
        const newEpoch = project(
          createMarkdownEditorProjection(source),
          { id, epoch: 18 },
          first,
        )
        expect(newEpoch.resolve(first.nodes[0]!.id)).toEqual({
          status: 'deleted',
        })
        const otherDocument = project(
          createMarkdownEditorProjection(source),
          { id: `${id}:other`, epoch: 17 },
          first,
        )
        expect(otherDocument.resolve(first.nodes[0]!.id)).toEqual({
          status: 'invalid',
        })
        expect(first.resolve(otherDocument.nodes[0]!.id)).toEqual({
          status: 'invalid',
        })
        expect(first.resolve('not-an-id')).toEqual({ status: 'invalid' })
        expect(first.resolve(`other:${id}:17:heading:0`)).toEqual({
          status: 'invalid',
        })
        expect(first.resolve(`syn:${id}`)).toEqual({ status: 'invalid' })
        expect(first.resolve(`syn:${id}:17:heading:999999`)).toEqual({
          status: 'deleted',
        })
      },
    )
  })
})
