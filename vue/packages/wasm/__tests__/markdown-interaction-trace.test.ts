import { describe, expect, it } from 'vitest'

import {
  createMarkdownInteractionTrace,
  evaluateMarkdownInteractionTraceMutations,
} from '../markdown-interaction-trace'

describe('markdown interaction trace', () => {
  it('records public steps with markdown document identity', () => {
    const trace = createMarkdownInteractionTrace({
      scenario: 'editor-click',
      contract: 'ElMarkdownEditor',
      browser: 'chromium',
      candidate: 'local',
      steps: [
        {
          index: 0,
          action: 'pointer',
          target: 'toolbar.bold',
          expected: 'bold',
          actual: 'bold',
          passed: true,
        },
      ],
      markdown: {
        direction: 'none',
        revision: 2,
        history: { undoDepth: 1, redoDepth: 0 },
        documentIdentity: { id: 'doc', epoch: 1 },
        capability: 'supported',
      },
    })
    expect(trace.schema).toBe('fsusui.interaction.v2')
    expect(trace.markdown?.revision).toBe(2)
    expect(
      evaluateMarkdownInteractionTraceMutations(trace).mutations.every(
        (mutation) => mutation.accepted === false,
      ),
    ).toBe(true)
  })
})
