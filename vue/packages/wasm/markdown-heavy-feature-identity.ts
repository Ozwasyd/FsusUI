import {
  createMarkdownEditorProjection,
  type MarkdownEditorProjectionResult,
} from './markdown-editor-projection'
import {
  deriveMarkdownEditorChange,
  stabilizeMarkdownEditorProjection,
  type MarkdownStableProjection,
} from './markdown-syntax-identity'

export type MarkdownHeavyFeatureProjectionKind =
  | 'code-highlight'
  | 'latex'
  | 'mermaid'

export interface MarkdownHeavyFeatureProjectionSnapshot {
  readonly nodeIds: Readonly<
    Record<MarkdownHeavyFeatureProjectionKind, readonly string[]>
  >
}

export interface MarkdownHeavyFeatureProjectionTracker {
  project(input: {
    readonly documentEpoch: number | string
    readonly documentKey: string
    readonly source: string
  }): MarkdownHeavyFeatureProjectionSnapshot | null
}

const nodesByKind = (projection: MarkdownStableProjection) => ({
  'code-highlight': Object.freeze(
    projection.nodes.filter((node) => node.kind === 'code').map(({ id }) => id),
  ),
  latex: Object.freeze(
    projection.nodes
      .filter((node) => node.kind === 'latex')
      .map(({ id }) => id),
  ),
  mermaid: Object.freeze(
    projection.nodes
      .filter((node) => node.kind === 'mermaid')
      .map(({ id }) => id),
  ),
})

export const createMarkdownHeavyFeatureProjectionTracker =
  (): MarkdownHeavyFeatureProjectionTracker => {
    let previousProjection: MarkdownStableProjection | undefined
    let previousDocument: Readonly<{ epoch: number; id: string }> | null = null

    return Object.freeze({
      project(input) {
        if (!Number.isInteger(input.documentEpoch)) return null
        const documentIdentity = Object.freeze({
          epoch: input.documentEpoch as number,
          id: input.documentKey,
        })
        if (
          previousDocument?.id !== documentIdentity.id ||
          previousDocument?.epoch !== documentIdentity.epoch
        ) {
          previousProjection = undefined
        }

        const nextProjection: MarkdownEditorProjectionResult =
          createMarkdownEditorProjection(input.source)
        const change = previousProjection
          ? deriveMarkdownEditorChange(
              previousProjection.normalizedSource,
              nextProjection.identity.normalizedSource,
            )
          : undefined
        const projection = stabilizeMarkdownEditorProjection(
          nextProjection,
          documentIdentity,
          previousProjection,
          change,
        )
        previousProjection = projection
        previousDocument = documentIdentity

        return Object.freeze({
          nodeIds: Object.freeze(nodesByKind(projection)),
        })
      },
    })
  }
