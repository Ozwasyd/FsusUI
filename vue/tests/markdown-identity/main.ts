import {
  createMarkdownAnchorMap,
  createMarkdownEditorProjection,
  createMarkdownOutlineEntries,
  resolveMarkdownConsumerIdentity,
  reviveMarkdownStableProjection,
  snapshotMarkdownStableProjection,
  stabilizeMarkdownEditorProjection,
} from '@ozwasyd/element-plus/markdown-runtime'

export function runIdentityScenario(id: string, revived: boolean) {
  const project: typeof stabilizeMarkdownEditorProjection = (...args) => {
    const projection = stabilizeMarkdownEditorProjection(...args)
    return revived
      ? reviveMarkdownStableProjection(
          structuredClone(snapshotMarkdownStableProjection(projection)),
        )
      : projection
  }
  const source = '# First\n\n#  \n\n# Named\n'
  const identity = { id, epoch: 17 }
  const first = project(createMarkdownEditorProjection(source), identity)
  const ids = first.nodes.map((node) => node.id)
  const anchors = createMarkdownAnchorMap({
    identity,
    source,
    projection: first,
    syntax: first.nodes.map((node) => ({
      id: node.id,
      projectionId: node.id,
      range: node.rawRange,
    })),
  })
  const prefixed = project(
    createMarkdownEditorProjection(`intro\n\n${source}`),
    identity,
    first,
    { from: 0, to: 0, insert: 'intro\n\n' },
  )
  const deleted = project(
    createMarkdownEditorProjection(''),
    identity,
    prefixed,
    { from: 0, to: prefixed.normalizedSource.length, insert: '' },
  )
  const recreated = project(
    createMarkdownEditorProjection('# First\n'),
    identity,
    deleted,
    { from: 0, to: 0, insert: '# First\n' },
  )
  const other = project(
    createMarkdownEditorProjection(source),
    { id: `${id}:other`, epoch: 17 },
    first,
  )
  const nextEpoch = project(
    createMarkdownEditorProjection(source),
    { id, epoch: 18 },
    first,
  )
  const selection = { anchor: 0, focus: 8 }
  return {
    ids,
    statuses: ids.map(
      (nodeId) => resolveMarkdownConsumerIdentity(first, nodeId).status,
    ),
    outline: createMarkdownOutlineEntries(first),
    prefixedIds: prefixed.nodes
      .filter((node) => node.kind === 'heading')
      .map((node) => node.id),
    prefixedStart: prefixed.resolve(ids[0]!).node?.rawRange.start,
    deleted: deleted.resolve(ids[0]!).status,
    recreatedId: recreated.nodes[0]!.id,
    recreatedOld: recreated.resolve(ids[0]!).status,
    nextEpoch: nextEpoch.resolve(ids[0]!).status,
    otherDocument: other.resolve(ids[0]!).status,
    reverseOtherDocument: first.resolve(other.nodes[0]!.id).status,
    invalid: first.resolve('not-an-id').status,
    unknown: first.resolve(`syn:${id}:17:heading:999999`).status,
    reveal: anchors.reveal({ anchorId: ids[0]! }),
    selection: anchors.visualAnchorToSourceSelection(
      anchors.sourceSelectionToVisual(selection),
    ),
  }
}

declare global {
  interface Window {
    runIdentityScenario: typeof runIdentityScenario
  }
}

window.runIdentityScenario = runIdentityScenario
document.querySelector('#ready')!.textContent = 'Public runtime ready'
