import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  createMarkdownEditorPositionMap,
  MarkdownEditorTransactionStore,
} from '../src/markdown-editor-transaction'

import type {
  MarkdownEditorChange,
  MarkdownEditorDocumentIdentity,
  MarkdownEditorSelection,
  MarkdownEditorTransaction,
} from '../src/markdown-editor-transaction'

interface VectorOperation {
  readonly kind: 'dispatch' | 'redo' | 'switchDocument' | 'undo'
  readonly changes?: readonly MarkdownEditorChange[]
  readonly expectedRevision?: number
  readonly externalUpdate?: 'rebase' | 'reset'
  readonly history?: 'merge' | 'separate' | 'skip'
  readonly identity?: MarkdownEditorDocumentIdentity
  readonly mergeDirection?: 'backward' | 'forward' | 'none'
  readonly origin?: MarkdownEditorTransaction['origin']
  readonly selection?: MarkdownEditorSelection
  readonly timestampMilliseconds?: number
  readonly value?: string
}

interface ExpectedTrace {
  readonly accepted: boolean
  readonly beforeRevision: number
  readonly identity?: MarkdownEditorDocumentIdentity
  readonly reason?: string
  readonly redoDepth: number
  readonly revision: number
  readonly selection: MarkdownEditorSelection
  readonly undoDepth: number
  readonly value: string
}

interface ScenarioVector {
  readonly expectedTrace: readonly ExpectedTrace[]
  readonly id: string
  readonly identity: MarkdownEditorDocumentIdentity
  readonly initialSelection: MarkdownEditorSelection
  readonly initialValue: string
  readonly operations: readonly VectorOperation[]
}

interface PositionMapVector {
  readonly changes: readonly MarkdownEditorChange[]
  readonly id: string
  readonly points?: readonly {
    readonly association: -1 | 1
    readonly expected: number
    readonly offset: number
  }[]
  readonly ranges?: readonly {
    readonly end: number
    readonly expected: {
      readonly deleted: boolean
      readonly partiallyDeleted: boolean
      readonly range?: { readonly end: number; readonly start: number }
    }
    readonly start: number
  }[]
}

const vectors = JSON.parse(
  readFileSync(
    resolve(
      process.cwd(),
      'spec/avalonia/markdown-editor-transaction-vectors.json',
    ),
    'utf8',
  ),
) as {
  readonly positionMaps: readonly PositionMapVector[]
  readonly scenarios: readonly ScenarioVector[]
}

const traceResult = (
  result: ReturnType<MarkdownEditorTransactionStore['dispatch']>,
  includeIdentity: boolean,
) => ({
  accepted: result.accepted,
  beforeRevision: result.beforeRevision,
  ...(includeIdentity ? { identity: result.documentIdentity } : {}),
  ...(result.reason ? { reason: result.reason } : {}),
  redoDepth: result.history.redoDepth,
  revision: result.revision,
  selection: result.selection,
  undoDepth: result.history.undoDepth,
  value: result.value,
})

describe('MarkdownEditor shared Web/Avalonia vectors', () => {
  for (const scenario of vectors.scenarios) {
    it(`produces the frozen trace for ${scenario.id}`, () => {
      const store = new MarkdownEditorTransactionStore(
        scenario.initialValue,
        scenario.initialSelection,
        scenario.identity,
      )
      const trace = scenario.operations.map((operation, index) => {
        const includeIdentity =
          scenario.expectedTrace[index].identity !== undefined
        if (operation.kind === 'switchDocument') {
          store.switchDocument(
            operation.identity ?? scenario.identity,
            operation.value ?? '',
            operation.selection,
          )
          return {
            accepted: true,
            beforeRevision: store.revision,
            ...(includeIdentity ? { identity: store.documentIdentity } : {}),
            reason: 'document-switch',
            redoDepth: store.history.redoDepth,
            revision: store.revision,
            selection: store.selection,
            undoDepth: store.history.undoDepth,
            value: store.value,
          }
        }
        if (operation.kind === 'undo') {
          return traceResult(store.undo(), includeIdentity)
        }
        if (operation.kind === 'redo') {
          return traceResult(store.redo(), includeIdentity)
        }
        const transaction: MarkdownEditorTransaction = {
          changes: operation.changes ?? [],
          documentIdentity: operation.identity ?? store.documentIdentity,
          expectedRevision: operation.expectedRevision,
          externalUpdate: operation.externalUpdate,
          history: operation.history ?? 'separate',
          origin: operation.origin ?? 'programmatic',
          selection: operation.selection,
        }
        return traceResult(
          store.dispatch(transaction, {
            mergeDirection: operation.mergeDirection,
            now: operation.timestampMilliseconds,
          }),
          includeIdentity,
        )
      })

      expect(trace).toEqual(scenario.expectedTrace)
    })
  }

  for (const vector of vectors.positionMaps) {
    it(`maps the frozen positions for ${vector.id}`, () => {
      const positionMap = createMarkdownEditorPositionMap(vector.changes)
      for (const point of vector.points ?? []) {
        expect(positionMap.map(point.offset, point.association)).toBe(
          point.expected,
        )
      }
      for (const range of vector.ranges ?? []) {
        expect(
          positionMap.mapRange({ start: range.start, end: range.end }),
        ).toEqual(range.expected)
      }
    })
  }
})
