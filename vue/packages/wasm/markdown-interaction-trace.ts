export type MarkdownInteractionBrowser = 'chromium' | 'firefox' | 'webkit'

export interface MarkdownInteractionStep {
  readonly index: number
  readonly action: 'pointer' | 'keyboard' | 'focus' | 'input' | 'paste' | 'assert'
  readonly target: string
  readonly expected?: unknown
  readonly actual?: unknown
  readonly passed: boolean
}

export interface MarkdownInteractionTrace {
  readonly schema: 'fsusui.interaction.v2'
  readonly scenario: string
  readonly contract: string
  readonly browser: MarkdownInteractionBrowser
  readonly candidate: string
  readonly steps: readonly MarkdownInteractionStep[]
  readonly markdown?: {
    readonly direction: string
    readonly revision: number
    readonly history: { readonly undoDepth: number; readonly redoDepth: number }
    readonly documentIdentity: { readonly id: string; readonly epoch: number }
    readonly capability: string
  }
}

export const createMarkdownInteractionTrace = (
  input: Omit<MarkdownInteractionTrace, 'schema'>,
): MarkdownInteractionTrace =>
  Object.freeze({
    schema: 'fsusui.interaction.v2',
    ...input,
    steps: Object.freeze(input.steps.map((step) => Object.freeze(step))),
  })

export const evaluateMarkdownInteractionTraceMutations = (trace: MarkdownInteractionTrace) =>
  Object.freeze({
    mutations: Object.freeze([
      Object.freeze({
        kind: 'no-op-action' as const,
        equivalent: trace.steps.every((step) => step.passed && step.actual === undefined),
        accepted: false,
      }),
      Object.freeze({
        kind: 'mock-only' as const,
        equivalent: false,
        accepted: false,
      }),
      Object.freeze({
        kind: 'metadata-only' as const,
        equivalent: trace.steps.length === 0,
        accepted: false,
      }),
    ]),
  })
