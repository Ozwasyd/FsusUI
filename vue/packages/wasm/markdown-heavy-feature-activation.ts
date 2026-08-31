import { activateMarkdownFeatures } from './markdown-runtime'

import type {
  MarkdownFeatureActivationOptions,
  MarkdownFeatureActivationResult,
  MarkdownFeatureActivationTheme,
  MarkdownFeatureThemeTokens,
} from './markdown-runtime'
import type {
  MarkdownHeavyFeatureIdentity,
  MarkdownHeavyFeatureKind,
  MarkdownHeavyFeatureLifecycle,
} from '../hooks/use-markdown-heavy-feature-lifecycle'
import type { MarkdownHeavyFeatureIsolatedRenderFactory } from './markdown-heavy-feature-resource'

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
