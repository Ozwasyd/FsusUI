export type MarkdownInteractionBrowser = 'chromium' | 'firefox' | 'webkit'

export type MarkdownInteractionAction =
  | 'pointer'
  | 'keyboard'
  | 'focus'
  | 'input'
  | 'paste'
  | 'drop'
  | 'open'
  | 'close'
  | 'exposed'
  | 'assert'

export interface MarkdownInteractionBrowserIdentity {
  readonly name: MarkdownInteractionBrowser
  readonly project: string
  readonly version: string
}

export interface MarkdownInteractionRuntime {
  readonly component: string
  readonly mount: 'vue' | 'mock' | 'metadata'
  readonly realBrowser: boolean
}

export interface MarkdownInteractionStep {
  readonly index: number
  readonly action: MarkdownInteractionAction
  readonly target: string
  readonly scenario?: string
  readonly contract?: string
  readonly baseline?: string
  readonly candidate?: string
  readonly browserIdentity?: MarkdownInteractionBrowserIdentity
  readonly expected?: unknown
  readonly actual?: unknown
  readonly passed: boolean
  readonly artifact?: string
}

export interface MarkdownInteractionTrace {
  readonly schema: 'fsusui.interaction.v2'
  readonly scenario: string
  readonly contract: string
  readonly baseline: string
  readonly browser: MarkdownInteractionBrowser
  readonly browserIdentity: MarkdownInteractionBrowserIdentity
  readonly candidate: string
  readonly runtime: MarkdownInteractionRuntime
  readonly steps: readonly MarkdownInteractionStep[]
  readonly nativeImeEvidence?: {
    readonly automated: false
    readonly issueRefs: readonly ['#319', '#320']
  }
  readonly markdown?: {
    readonly direction: string
    readonly revision: number
    readonly history: { readonly undoDepth: number; readonly redoDepth: number }
    readonly documentIdentity: { readonly id: string; readonly epoch: number }
    readonly capability: string
  }
}

export type MarkdownInteractionTraceInput = Omit<
  MarkdownInteractionTrace,
  'schema' | 'steps'
> & {
  readonly steps: readonly MarkdownInteractionStep[]
}

export type MarkdownInteractionTraceMutationKind =
  | 'no-op-action'
  | 'uncaptured-event'
  | 'mock-only'
  | 'metadata-only'

export interface MarkdownInteractionTraceValidation {
  readonly accepted: boolean
  readonly issues: readonly string[]
}

const json = (value: unknown) => {
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0

const includesEventEvidence = (value: unknown) =>
  /"(?:event|emitted|emittedEvents)"\s*:/.test(json(value))

const stepIssue = (step: MarkdownInteractionStep, reason: string) =>
  `step ${step.index} action ${step.action} target ${step.target}: ${reason}; expected=${json(
    step.expected,
  )}; actual=${json(step.actual)}`

export const createMarkdownInteractionTrace = (
  input: MarkdownInteractionTraceInput,
): MarkdownInteractionTrace => {
  const steps = input.steps.map((step) =>
    Object.freeze({
      ...step,
      scenario: step.scenario ?? input.scenario,
      contract: step.contract ?? input.contract,
      baseline: step.baseline ?? input.baseline,
      candidate: step.candidate ?? input.candidate,
      browserIdentity: step.browserIdentity ?? input.browserIdentity,
    }),
  )

  return Object.freeze({
    schema: 'fsusui.interaction.v2',
    ...input,
    browserIdentity: Object.freeze({ ...input.browserIdentity }),
    runtime: Object.freeze({ ...input.runtime }),
    steps: Object.freeze(steps),
    ...(input.nativeImeEvidence
      ? {
          nativeImeEvidence: Object.freeze({
            automated: false as const,
            issueRefs: Object.freeze(['#319', '#320'] as const),
          }),
        }
      : {}),
    ...(input.markdown
      ? {
          markdown: Object.freeze({
            ...input.markdown,
            documentIdentity: Object.freeze({
              ...input.markdown.documentIdentity,
            }),
            history: Object.freeze({ ...input.markdown.history }),
          }),
        }
      : {}),
  })
}

export const validateMarkdownInteractionTrace = (
  trace: MarkdownInteractionTrace,
): MarkdownInteractionTraceValidation => {
  const issues: string[] = []

  if (trace.schema !== 'fsusui.interaction.v2') {
    issues.push(`unsupported schema ${String(trace.schema)}`)
  }
  for (const [field, value] of [
    ['scenario', trace.scenario],
    ['contract', trace.contract],
    ['baseline', trace.baseline],
    ['candidate', trace.candidate],
  ] as const) {
    if (!isNonEmptyString(value)) issues.push(`${field} must be non-empty`)
  }
  if (
    trace.browserIdentity.name !== trace.browser ||
    !isNonEmptyString(trace.browserIdentity.project) ||
    !isNonEmptyString(trace.browserIdentity.version)
  ) {
    issues.push('browser identity must bind name, project, and version')
  }
  if (
    trace.runtime.mount !== 'vue' ||
    trace.runtime.realBrowser !== true ||
    !isNonEmptyString(trace.runtime.component)
  ) {
    issues.push('runtime must be a real Vue component mount')
  }
  if (trace.steps.length === 0) issues.push('trace must include steps')
  if (!trace.steps.some((step) => step.action !== 'assert')) {
    issues.push('trace must include at least one executed action')
  }

  for (const [position, step] of trace.steps.entries()) {
    if (step.index !== position) {
      issues.push(stepIssue(step, `index must be ${position}`))
    }
    if (
      step.scenario !== trace.scenario ||
      step.contract !== trace.contract ||
      step.baseline !== trace.baseline ||
      step.candidate !== trace.candidate ||
      step.browserIdentity?.name !== trace.browserIdentity.name ||
      step.browserIdentity?.project !== trace.browserIdentity.project ||
      step.browserIdentity?.version !== trace.browserIdentity.version
    ) {
      issues.push(stepIssue(step, 'identity binding drift'))
    }
    if (step.action !== 'assert' && step.actual === undefined) {
      issues.push(stepIssue(step, 'executed action is missing actual evidence'))
    }
    if (
      includesEventEvidence(step.expected) &&
      !includesEventEvidence(step.actual)
    ) {
      issues.push(stepIssue(step, 'expected emitted event was not captured'))
    }
    if (!step.passed) {
      issues.push(stepIssue(step, 'expected and actual behavior differ'))
    }
  }

  if (trace.markdown) {
    if (!isNonEmptyString(trace.markdown.direction)) {
      issues.push('markdown selection direction must be present')
    }
    if (!Number.isInteger(trace.markdown.revision)) {
      issues.push('markdown revision must be an integer')
    }
    if (
      !Number.isInteger(trace.markdown.history.undoDepth) ||
      !Number.isInteger(trace.markdown.history.redoDepth)
    ) {
      issues.push('markdown history depths must be integers')
    }
    if (
      !isNonEmptyString(trace.markdown.documentIdentity.id) ||
      !Number.isInteger(trace.markdown.documentIdentity.epoch)
    ) {
      issues.push('markdown document identity and epoch must be present')
    }
    if (!isNonEmptyString(trace.markdown.capability)) {
      issues.push('markdown capability must be present')
    }
    if (
      trace.nativeImeEvidence?.automated !== false ||
      trace.nativeImeEvidence.issueRefs[0] !== '#319' ||
      trace.nativeImeEvidence.issueRefs[1] !== '#320'
    ) {
      issues.push('native IME cells must reference #319 and #320 evidence')
    }
  }

  return Object.freeze({
    accepted: issues.length === 0,
    issues: Object.freeze(issues),
  })
}

export const assertMarkdownInteractionTrace = (
  trace: MarkdownInteractionTrace,
) => {
  const validation = validateMarkdownInteractionTrace(trace)
  if (!validation.accepted) {
    throw new Error(
      `Interaction trace rejected:\n${validation.issues.join('\n')}`,
    )
  }
  return trace
}

const mutableClone = (trace: MarkdownInteractionTrace) =>
  JSON.parse(JSON.stringify(trace)) as MarkdownInteractionTrace

const mutationResult = (
  kind: MarkdownInteractionTraceMutationKind,
  trace: MarkdownInteractionTrace,
) => {
  const validation = validateMarkdownInteractionTrace(trace)
  return Object.freeze({
    kind,
    equivalent: false,
    accepted: validation.accepted,
    issues: validation.issues,
  })
}

export const evaluateMarkdownInteractionTraceMutations = (
  trace: MarkdownInteractionTrace,
) => {
  const noOp = mutableClone(trace)
  const noOpIndex = noOp.steps.findIndex((step) => step.action !== 'assert')
  if (noOpIndex >= 0) {
    const steps = [...noOp.steps]
    steps[noOpIndex] = {
      ...steps[noOpIndex],
      actual: undefined,
      passed: false,
    }
    ;(noOp as { steps: readonly MarkdownInteractionStep[] }).steps = steps
  }

  const uncapturedEvent = mutableClone(trace)
  const eventIndex = uncapturedEvent.steps.findIndex((step) =>
    includesEventEvidence(step.expected),
  )
  if (eventIndex >= 0) {
    const steps = [...uncapturedEvent.steps]
    steps[eventIndex] = {
      ...steps[eventIndex],
      actual: { emittedEvents: [] },
      passed: false,
    }
    ;(uncapturedEvent as { steps: readonly MarkdownInteractionStep[] }).steps =
      steps
  } else if (uncapturedEvent.steps.length > 0) {
    const steps = [...uncapturedEvent.steps]
    steps[0] = { ...steps[0], actual: undefined, passed: false }
    ;(uncapturedEvent as { steps: readonly MarkdownInteractionStep[] }).steps =
      steps
  }

  const mockOnly = mutableClone(trace)
  ;(mockOnly as { runtime: MarkdownInteractionRuntime }).runtime = {
    ...mockOnly.runtime,
    mount: 'mock',
  }

  const metadataOnly = mutableClone(trace)
  ;(metadataOnly as { steps: readonly MarkdownInteractionStep[] }).steps = [
    {
      index: 0,
      action: 'assert',
      target: 'scenario.metadata',
      scenario: metadataOnly.scenario,
      contract: metadataOnly.contract,
      baseline: metadataOnly.baseline,
      candidate: metadataOnly.candidate,
      browserIdentity: metadataOnly.browserIdentity,
      expected: { metadata: 'present' },
      actual: { metadata: 'present' },
      passed: true,
    },
  ]

  return Object.freeze({
    mutations: Object.freeze([
      mutationResult('no-op-action', noOp),
      mutationResult('uncaptured-event', uncapturedEvent),
      mutationResult('mock-only', mockOnly),
      mutationResult('metadata-only', metadataOnly),
    ]),
  })
}
