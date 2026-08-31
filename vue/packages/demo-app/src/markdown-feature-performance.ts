export const MARKDOWN_FEATURE_ACTIVATION_SCENARIO =
  'markdown-feature-activation'
export const MARKDOWN_HEAVY_LIFECYCLE_SCENARIO =
  'markdown-heavy-feature-lifecycle'

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

export const createMarkdownHeavyLifecycleSource = (blockCount = 3000) =>
  Array.from({ length: blockCount }, (_, index) => {
    const technicalIndex =
      index < 3
        ? index
        : index % 30 === 0 && index / 30 <= 97
          ? index / 30 + 2
          : null
    if (technicalIndex === null) {
      return `Paragraph ${index} with stable lifecycle filler text and Unicode 中文.`
    }
    if (technicalIndex % 3 === 0) {
      return `\`\`\`typescript\nconst heavyNode${technicalIndex}: number = ${technicalIndex}\n\`\`\``
    }
    if (technicalIndex % 3 === 1) {
      return `\`\`\`mermaid\ngraph LR\nA${technicalIndex}-->B${technicalIndex}\n\`\`\``
    }
    return `$$\nheavy_{${technicalIndex}} = ${technicalIndex}^2\n$$`
  }).join('\n\n')

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
