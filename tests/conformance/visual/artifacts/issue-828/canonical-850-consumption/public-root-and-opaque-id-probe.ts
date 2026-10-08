import { describe, expect, it } from 'vitest'
import * as root from '../../element-plus/index'
import { createMarkdownEditorProjection, stabilizeMarkdownEditorProjection, snapshotMarkdownStableProjection, reviveMarkdownStableProjection, resolveMarkdownConsumerIdentity } from '../../element-plus/markdown-runtime'

describe('root2228 exact capability probe', () => {
  it.each(['direct', 'revived'] as const)('%s resolves complete colon document identity and rejects other document/epoch', (mode) => {
    const document = { id: 'fsusblog:viewport:probe', epoch: 17 }
    const original = stabilizeMarkdownEditorProjection(createMarkdownEditorProjection('# Named\n'), document)
    const stable = mode === 'revived' ? reviveMarkdownStableProjection(snapshotMarkdownStableProjection(original)) : original
    expect(stable.nodes).toHaveLength(1)
    const node = stable.nodes[0]!
    expect(node.id).toBe('syn:fsusblog:viewport:probe:17:heading:0')
    expect(stable.resolve(node.id)).toEqual({ status: 'current', node })
    expect(resolveMarkdownConsumerIdentity(stable, node.id)).toEqual({ status: 'current', node })
    expect(stable.resolve('syn:fsusblog:viewport:probe:16:heading:0')).toEqual({ status: 'deleted' })
    expect(stable.resolve('syn:fsusblog:viewport:other:17:heading:0')).toEqual({ status: 'invalid' })
    expect(stable.resolve('syn:fsusblog:viewport:probe:17:heading:999999')).toEqual({ status: 'deleted' })
  })
  it('exposes requested outline tree at the public root', () => { expect((root as Record<string, unknown>).createMarkdownOutlineTree).toBeTypeOf('function') })
  it('exposes requested outline active resolver at the public root', () => { expect((root as Record<string, unknown>).resolveMarkdownOutlineActive).toBeTypeOf('function') })
})
