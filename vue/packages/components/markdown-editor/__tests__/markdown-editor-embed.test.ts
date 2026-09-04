import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { describe, expect, it } from 'vitest'

import {
  getMarkdownXssSourceAttackFragment,
} from '../../../../tests/support/markdown-xss-corpus'

import MarkdownEditor from '../src/markdown-editor.vue'

import {
  collectMarkdownEmbedNodes,
  commitMarkdownEmbedHeightChange,
  evaluateMarkdownEmbedUiMutations,
  formatMarkdownEmbedDirective,
  parseMarkdownEmbedLine,
  planMarkdownEmbedEdit,
  planMarkdownEmbedInsert,
  planMarkdownEmbedPresentation,
  planMarkdownEmbedRemove,
  presentMarkdownEmbed,
  resolveMarkdownEmbedAtomic,
  runMarkdownEmbedAction,
  runMarkdownEmbedEdit,
  runMarkdownEmbedInsert,
  runMarkdownEmbedRemove,
  type MarkdownEmbedValidNode,
} from '../src/markdown-editor-embed'
import type { MarkdownEditorCommandContext } from '../src/markdown-editor'
import type { MarkdownEmbedResult } from '../../../wasm/markdown-embed-provider'

const makeContext = (
  value: string,
  selection = { direction: 'none' as const, end: value.length, start: value.length },
): MarkdownEditorCommandContext => ({
  dispatch: {
    dispatch: () => ({
      accepted: true,
      beforeRevision: 0,
      documentIdentity: { epoch: 1, id: 'embed-doc' },
      history: {
        canRedo: false,
        canUndo: false,
        redoDepth: 0,
        retainedUnits: 0,
        undoDepth: 0,
      },
      revision: 1,
      selection,
      value,
    }),
  },
  documentIdentity: { epoch: 1, id: 'embed-doc' },
  mode: 'live',
  readonly: false,
  revision: 1,
  selection,
  signal: new AbortController().signal,
  value,
})

describe('markdown embed safe presentation and atomic interaction', () => {
  it('formats, parses, and edits embed directives through transactions', () => {
    const directive = formatMarkdownEmbedDirective('note-1', 'article')
    expect(directive).toBe('::embed[target="note-1" mode="article"]')

    const parsed = parseMarkdownEmbedLine(directive, 0)
    expect(parsed.ok).toBe(true)
    if (parsed.ok) {
      expect(parsed.target).toBe('note-1')
      expect(parsed.mode).toBe('article')
    }

    const context = makeContext('initial text\n')
    const inserted = runMarkdownEmbedInsert(context, 'spec-1', 'heading')
    expect(inserted.transaction?.origin).toBe('command')
    expect(inserted.transaction?.history).toBe('separate')
    expect(inserted.transaction?.changes[0]?.insert).toContain('::embed[target="spec-1" mode="heading"]')

    const nodes = collectMarkdownEmbedNodes('::embed[target="doc-a" mode="block"]\n')
    expect(nodes).toHaveLength(1)
    const validNode = nodes[0] as MarkdownEmbedValidNode
    expect(validNode.ok).toBe(true)

    const edited = runMarkdownEmbedEdit(context, validNode, 'doc-b', 'article')
    expect(edited.transaction?.changes[0]?.insert).toBe('::embed[target="doc-b" mode="article"]')

    const removed = runMarkdownEmbedRemove(context, validNode)
    expect(removed.transaction?.changes[0]?.insert).toBe('')
  })

  it('presents resolved embeds safely without card chrome or script injection', () => {
    const nodes = collectMarkdownEmbedNodes('::embed[target="safe-doc" mode="article"]\n')
    const node = nodes[0] as MarkdownEmbedValidNode

    const resolvedResult: MarkdownEmbedResult = {
      documentIdentity: { epoch: 1, id: 'embed-doc' },
      excerpt: `<p>Safe summary ${getMarkdownXssSourceAttackFragment('mxss-raw-script-basic')}${getMarkdownXssSourceAttackFragment('mxss-container-iframe-srcdoc')}</p>`,
      mode: 'article',
      nodeId: 'syn:embed:0',
      requestId: 'r1',
      revision: 1,
      status: 'resolved',
      target: 'safe-doc',
      title: 'Safe Document',
      version: 1,
    }

    const presentation = planMarkdownEmbedPresentation(node, resolvedResult)
    expect(presentation.visible).toBe(true)
    expect(presentation.card).toBe(false)
    expect(presentation.hasNestedScroll).toBe(false)
    expect(presentation.title).toBe('Safe Document')
    expect(presentation.excerpt).not.toContain('<script>')
    expect(presentation.excerpt).not.toContain('<iframe>')
    expect(presentation.allowedActions).toContain('source-reveal')
    expect(presentation.allowedActions).toContain('open-source')
    expect(presentation.allowedActions).toContain('copy')
    expect(presentation.accessibility.role).toBe('region')
    expect(presentation.accessibility.tabStop).toBe(false)

    // WASM presentation helper compatibility
    const wasmPres = presentMarkdownEmbed(resolvedResult)
    expect(wasmPres.visible).toBe(true)
    expect(wasmPres.card).toBe(false)
    expect(wasmPres.tabStop).toBe(false)
  })

  it('supports local failure states with retry and open-source operations', () => {
    const nodes = collectMarkdownEmbedNodes('::embed[target="error-doc" mode="heading"]\n')
    const node = nodes[0] as MarkdownEmbedValidNode

    const failureStates = [
      'forbidden',
      'missing',
      'cycle',
      'depth-exceeded',
      'size-exceeded',
      'time-exceeded',
      'mode-mismatch',
      'stale',
      'rejected',
    ] as const

    for (const status of failureStates) {
      const failedResult: MarkdownEmbedResult = {
        documentIdentity: { epoch: 1, id: 'embed-doc' },
        mode: 'heading',
        nodeId: 'syn:embed:0',
        requestId: `r-${status}`,
        revision: 1,
        status,
        target: 'error-doc',
        version: 1,
      }
      const plan = planMarkdownEmbedPresentation(node, failedResult)
      expect(plan.visible).toBe(true)
      expect(plan.status).toBe(status)
      expect(plan.allowedActions).toContain('source-reveal')
      expect(plan.allowedActions).toContain('retry')
      expect(plan.allowedActions).toContain('open-source')
      expect(plan.card).toBe(false)
    }
  })

  it('binds atomic interaction primitive: caret, copy, delete, and focus return (#335)', () => {
    const source = '::embed[target="note" mode="article"]\n'
    const context = makeContext(source, { direction: 'none', end: 0, start: 0 })
    const nodes = collectMarkdownEmbedNodes(source)
    const node = nodes[0] as MarkdownEmbedValidNode

    // Caret before
    const before = resolveMarkdownEmbedAtomic(context, node, 'caret-before')
    expect(before.kind).toBe('embed')
    expect(before.selection.start).toBe(0)
    expect(before.accessibility.tabStop).toBe(false)

    // Caret after
    const after = resolveMarkdownEmbedAtomic(context, node, 'caret-after')
    expect(after.selection.start).toBeGreaterThanOrEqual(node.ranges.full.end)

    // Select node
    const select = resolveMarkdownEmbedAtomic(context, node, 'select-node')
    expect(select.selection.start).toBe(node.ranges.full.start)
    expect(select.selection.end).toBeGreaterThanOrEqual(node.ranges.full.end)

    // Copy exact
    const copyExact = resolveMarkdownEmbedAtomic(context, node, 'copy-source')
    expect((copyExact.copy as any)?.text).toContain('::embed[target="note" mode="article"]')

    // Copy visible
    const copyVisible = resolveMarkdownEmbedAtomic(context, node, 'copy-visible')
    expect(copyVisible.copy).toBeTruthy()

    // Delete
    const del = resolveMarkdownEmbedAtomic(context, node, 'delete')
    expect(del.transaction).toBeTruthy()
    expect(del.transaction?.changes[0]?.to).toBeGreaterThanOrEqual(node.ranges.full.end)

    // Actions via runMarkdownEmbedAction
    const revealAction = runMarkdownEmbedAction(context, node, 'source-reveal')
    expect(revealAction.action).toBe('source-reveal')
    if (revealAction.action === 'source-reveal') {
      expect(revealAction.target).toBe('note')
      expect(revealAction.focusReturn).toBe('editor')
      expect(revealAction.selection.start).toBe(0)
    }

    const openAction = runMarkdownEmbedAction(context, node, 'open-source')
    expect(openAction.action).toBe('open-source')

    const retryAction = runMarkdownEmbedAction(context, node, 'retry')
    expect(retryAction.action).toBe('retry')

    const copyAction = runMarkdownEmbedAction(context, node, 'copy')
    expect(copyAction.action).toBe('copy')
    if (copyAction.action === 'copy') {
      expect(copyAction.exactMarkdown).toBe('::embed[target="note" mode="article"]')
    }
  })

  it('anchors layout across height changes and yields to user scroll (#336)', () => {
    const source = 'line 1\n::embed[target="note" mode="article"]\nline 2\n'
    const nodes = collectMarkdownEmbedNodes(source)
    const node = nodes[0] as MarkdownEmbedValidNode

    // Layout stability when embed resolves and height expands
    const stability = commitMarkdownEmbedHeightChange({
      currentIdentity: { epoch: 1, id: 'embed-doc' },
      currentRevision: 1,
      documentIdentity: { epoch: 1, id: 'embed-doc' },
      nextHeight: 120,
      node,
      previousCaret: 0,
      previousHeight: 24,
      revision: 1,
      source,
    })
    expect(stability.action).toBe('restore')
    expect(stability.sourceUnchanged).toBe(true)

    // User scrolling yields layout anchoring
    const userScrollStability = commitMarkdownEmbedHeightChange({
      currentIdentity: { epoch: 1, id: 'embed-doc' },
      currentRevision: 1,
      documentIdentity: { epoch: 1, id: 'embed-doc' },
      nextHeight: 120,
      node,
      previousCaret: 0,
      previousHeight: 24,
      revision: 1,
      source,
      userScrolling: true,
    })
    expect(userScrollStability.action).toBe('yield')

    // Stale revision rejects
    const staleStability = commitMarkdownEmbedHeightChange({
      currentIdentity: { epoch: 1, id: 'embed-doc' },
      currentRevision: 2,
      documentIdentity: { epoch: 1, id: 'embed-doc' },
      nextHeight: 120,
      node,
      previousCaret: 0,
      previousHeight: 24,
      revision: 1,
      source,
    })
    expect(staleStability.action).toBe('reject-stale')
  })

  it('kills iframe, second editor, innerHTML, mode-card, and source expansion mutations', () => {
    const report = evaluateMarkdownEmbedUiMutations()
    expect(report.mutations.length).toBe(5)
    for (const mutation of report.mutations) {
      expect(mutation.accepted).toBe(false)
      expect(mutation.equivalent).toBe(false)
    }
  })

  it('resolves and renders consumer embed results through the production component', async () => {
    const source = 'Before\n\n::embed[target="safe-doc" mode="article"]\n\nAfter'
    const wrapper = mount(MarkdownEditor, {
      props: {
        defaultMode: 'preview',
        embedProvider: async (request) => ({
          ...request,
          excerpt: `Safe summary ${getMarkdownXssSourceAttackFragment('mxss-raw-script-basic')}`,
          status: 'resolved',
          title: 'Safe Document',
        }),
        modelValue: source,
      },
    })
    await nextTick()
    await nextTick()

    const embed = wrapper.find('.el-markdown-embed')
    expect(embed.exists()).toBe(true)
    expect(embed.text()).toContain('Safe Document')
    expect(embed.text()).toContain('Safe summary')
    expect(embed.text()).not.toContain('__FSUS_XSS__')
    expect(wrapper.html()).not.toContain('<script>')
    expect(embed.text()).toContain('打开来源')

    const sourceReveal = embed
      .findAll<HTMLButtonElement>('.el-markdown-embed__action')
      .find((button) => button.text() === '显示源码')
    expect(sourceReveal).toBeTruthy()
    await sourceReveal!.trigger('click')
    await nextTick()
    expect(wrapper.find('textarea').attributes('hidden')).toBeUndefined()
  })

  it('keeps live mode on the single input surface while exposing controlled embed presentation', async () => {
    const source =
      'Before\n\n::embed[target="safe-doc" mode="article"]\n\nAfter'
    const wrapper = mount(MarkdownEditor, {
      props: {
        defaultMode: 'live',
        embedProvider: async (request) => ({
          ...request,
          excerpt: 'Safe live summary',
          status: 'resolved',
          title: 'Safe Live Document',
        }),
        modelValue: source,
      },
    })
    await nextTick()
    await nextTick()

    expect(wrapper.find('textarea').isVisible()).toBe(true)
    expect(wrapper.find('.el-markdown-editor__preview').exists()).toBe(false)
    expect(wrapper.find('.el-markdown-editor__live-embeds').exists()).toBe(true)
    const embed = wrapper.find('.el-markdown-embed')
    expect(embed.text()).toContain('Safe Live Document')
    expect(embed.text()).toContain('Safe live summary')
    expect(embed.find('.el-markdown-editor').exists()).toBe(false)
    expect(embed.attributes('tabindex')).toBeUndefined()
  })
})
