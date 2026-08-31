import { describe, expect, it } from 'vitest'

import {
  assertMarkdownInteractionTrace,
  createMarkdownInteractionTrace,
  evaluateMarkdownInteractionTraceMutations,
  validateMarkdownInteractionTrace,
} from '../markdown-interaction-trace'

const createTrace = () => {
  const browserIdentity = {
    name: 'chromium' as const,
    project: 'chromium',
    version: '128.0.0',
  }

  return createMarkdownInteractionTrace({
    scenario: 'scenario.v2.el-markdown-editor.editor-click',
    contract: 'spec/components/contracts/v2/contract-v2.json',
    contractRegistry: {
      source: 'spec/components/contracts/v2/contract-v2.json',
      schemaVersion: 2,
      registryVersion: '2.0.0',
    },
    baseline: 'baseline-sha',
    browser: 'chromium',
    browserIdentity,
    candidate: 'candidate-sha',
    runtime: {
      component: 'ElMarkdownEditor',
      mount: 'vue',
      realBrowser: true,
    },
    steps: [
      {
        index: 0,
        action: 'pointer',
        target: 'toolbar.bold',
        contract: 'component-v2.el-markdown-editor',
        scenario: 'scenario.v2.el-markdown-editor.output.command',
        artifact: 'markdown-editor.chromium.interaction-trace.json',
        expected: { emittedEvents: ['markdown.command'], value: '**bold**' },
        actual: { emittedEvents: ['markdown.command'], value: '**bold**' },
        passed: true,
      },
    ],
    nativeImeEvidence: {
      automated: false,
      issueRefs: ['#319', '#320'],
    },
    markdown: {
      direction: 'none',
      revision: 2,
      history: { undoDepth: 1, redoDepth: 0 },
      documentIdentity: { id: 'doc', epoch: 1 },
      capability: 'supported',
    },
  })
}

describe('markdown interaction trace', () => {
  it('binds every public step to scenario, contract, candidate, baseline, and browser identity', () => {
    const trace = createTrace()
    expect(trace.schema).toBe('fsusui.interaction.v2')
    expect(trace.steps[0]).toMatchObject({
      scenario: 'scenario.v2.el-markdown-editor.output.command',
      contract: 'component-v2.el-markdown-editor',
      baseline: trace.baseline,
      candidate: trace.candidate,
      browserIdentity: trace.browserIdentity,
    })
    expect(trace.markdown).toMatchObject({
      revision: 2,
      direction: 'none',
      history: { undoDepth: 1, redoDepth: 0 },
      documentIdentity: { id: 'doc', epoch: 1 },
      capability: 'supported',
    })
    expect(validateMarkdownInteractionTrace(trace)).toEqual({
      accepted: true,
      issues: [],
    })
    expect(assertMarkdownInteractionTrace(trace)).toBe(trace)
  })

  it('rejects a step that is not bound to its Contract V2 component scenario', () => {
    const trace = createTrace()
    const drifted = {
      ...trace,
      steps: [
        {
          ...trace.steps[0],
          scenario: 'scenario.v2.el-input.output.input',
        },
      ],
    }

    expect(validateMarkdownInteractionTrace(drifted)).toMatchObject({
      accepted: false,
      issues: [
        expect.stringContaining('Contract V2 scenario binding is invalid'),
      ],
    })
  })

  it('kills no-op, uncaptured-event, mock-only, and metadata-only runners', () => {
    const report = evaluateMarkdownInteractionTraceMutations(createTrace())
    expect(report.mutations.map((mutation) => mutation.kind)).toEqual([
      'no-op-action',
      'uncaptured-event',
      'mock-only',
      'metadata-only',
    ])
    for (const mutation of report.mutations) {
      expect(mutation.accepted).toBe(false)
      expect(mutation.equivalent).toBe(false)
      expect(mutation.issues.length).toBeGreaterThan(0)
    }
  })

  it('reports exact failed step, action, expected, and actual evidence', () => {
    const trace = createTrace()
    const failed = {
      ...trace,
      steps: [
        {
          ...trace.steps[0],
          actual: { emittedEvents: [], value: 'bold' },
          passed: false,
        },
      ],
    }
    expect(() => assertMarkdownInteractionTrace(failed)).toThrow(
      /step 0 action pointer target toolbar\.bold: expected and actual behavior differ; expected=.*actual=/,
    )
  })
})
