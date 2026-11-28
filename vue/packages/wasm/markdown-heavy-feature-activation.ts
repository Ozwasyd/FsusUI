import { activateMarkdownFeatures } from './markdown-runtime'

import type {
  MarkdownFeatureActivationOptions,
  MarkdownFeatureActivationResult,
  MarkdownFeatureActivationTheme,
  MarkdownFeatureThemeTokens,
} from './markdown-runtime'
import type { MarkdownHeavyFeatureIsolatedRenderFactory } from './markdown-heavy-feature-resource'

type MarkdownHeavyFeatureKind = 'code-highlight' | 'latex' | 'mermaid'

interface MarkdownHeavyFeatureIdentity {
  readonly config: string
  readonly documentEpoch: number | string
  readonly documentKey: string
  readonly featureKind: MarkdownHeavyFeatureKind
  readonly gatewayVersion: string
  readonly locale: string
  readonly nodeId: string
  readonly rendererVersion: string
  readonly revision: number | string
  readonly sourceIdentity: string
  readonly theme: string
}

interface MarkdownHeavyFeatureLifecycle {
  readonly activate: <T>(input: {
    readonly commit: (
      value: T,
      signal: AbortSignal,
    ) => HTMLElement | void | Promise<HTMLElement | void>
    readonly element: HTMLElement
    readonly estimateBytes: (value: T) => number
    readonly identity: MarkdownHeavyFeatureIdentity
    readonly render: (signal: AbortSignal) => Promise<T>
    readonly resources?: Readonly<{
      listeners?: number
      observers?: number
      runtimes?: number
      tasks?: number
    }>
    readonly signal?: AbortSignal
    readonly teardown?: () => void
  }) => Promise<boolean>
  mountStatic: (input: {
    readonly element: HTMLElement
    readonly identity: MarkdownHeavyFeatureIdentity
  }) => boolean
}

interface MarkdownHeavyFeatureActivationOptions extends MarkdownFeatureActivationOptions {
  readonly heavyLifecycle: MarkdownHeavyFeatureLifecycle
  readonly isolatedRenderFactory?: MarkdownHeavyFeatureIsolatedRenderFactory
  readonly resolveHeavyFeatureIdentity: (input: {
    readonly element: HTMLElement
    readonly kind: MarkdownHeavyFeatureKind
    readonly source: string
    readonly theme: MarkdownFeatureActivationTheme
    readonly tokens: Readonly<MarkdownFeatureThemeTokens>
  }) => MarkdownHeavyFeatureIdentity | null
  readonly scheduleHeavyFeatureCommit?: (input: {
    readonly key: string
    readonly run: () => HTMLElement | void
    readonly signal: AbortSignal
  }) => Promise<HTMLElement | void>
}

export const activateMarkdownHeavyFeatures = (
  options: MarkdownHeavyFeatureActivationOptions,
): Promise<MarkdownFeatureActivationResult> =>
  activateMarkdownFeatures(options as MarkdownFeatureActivationOptions)
