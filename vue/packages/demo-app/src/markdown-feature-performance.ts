export const MARKDOWN_FEATURE_ACTIVATION_SCENARIO =
  'markdown-feature-activation'

const requiredFeatureKinds = Object.freeze([
  'code-highlight',
  'latex',
  'mermaid',
] as const)

export interface MarkdownFeatureActivationSummary {
  readonly activated: readonly Readonly<{
    count: number
    kind: string
  }>[]
  readonly errors: readonly unknown[]
}

export const hasCompleteMarkdownFeatureActivation = (
  summary: MarkdownFeatureActivationSummary,
) => {
  if (summary.errors.length > 0) return false
  const counts = new Map<string, number>()
  for (const { count, kind } of summary.activated) {
    counts.set(kind, (counts.get(kind) ?? 0) + count)
  }
  return requiredFeatureKinds.every((kind) => counts.get(kind) === 1)
}

export const createMarkdownFeatureActivationSource = (revision: number) =>
  [
    `# Feature activation ${revision}`,
    '',
    '```mermaid',
    'sequenceDiagram',
    `  Alice->>Bob: revision ${revision}`,
    '```',
    '',
    '$$',
    String.raw`\begin{aligned}`,
    `activation_{${revision}} &= mermaid + katex + shiki \\\\`,
    String.raw`\end{aligned}`,
    '$$',
    '',
    '```typescript',
    `const activationRevision: number = ${revision}`,
    '```',
  ].join('\n')

type PendingActivation = {
  reject: (error: Error) => void
  resolve: (revision: number) => void
  revision: number
}

export class MarkdownFeatureActivationSequence {
  #pending: PendingActivation | null = null
  #revision = 0

  begin() {
    if (this.#pending) {
      throw new Error('markdown_feature_activation_already_pending')
    }
    const revision = ++this.#revision
    const completion = new Promise<number>((resolve, reject) => {
      this.#pending = { reject, resolve, revision }
    })
    return Object.freeze({ completion, revision })
  }

  complete(summary: MarkdownFeatureActivationSummary) {
    if (!hasCompleteMarkdownFeatureActivation(summary)) return false
    const pending = this.#pending
    this.#pending = null
    pending?.resolve(pending.revision)
    return true
  }

  fail(error: unknown) {
    const pending = this.#pending
    this.#pending = null
    pending?.reject(
      error instanceof Error
        ? error
        : new Error('markdown_feature_activation_failed'),
    )
  }
}
