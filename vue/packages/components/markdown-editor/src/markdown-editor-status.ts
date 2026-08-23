import {
  calculateMarkdownEditorMetrics,
  defaultMarkdownEditorLocaleText,
  resolveMarkdownEditorLocaleText,
  type MarkdownEditorLocaleTextOverride,
} from './markdown-editor'

type MarkdownEditorStatusDensity = 'none' | 'minimal' | 'detailed'

export const resolveMarkdownEditorStatus = (
  source: string,
  density: MarkdownEditorStatusDensity,
  localeText?: MarkdownEditorLocaleTextOverride,
  selection?: { readonly start: number; readonly end: number },
) => {
  const copy = resolveMarkdownEditorLocaleText(localeText ?? defaultMarkdownEditorLocaleText)
  const metrics = calculateMarkdownEditorMetrics(source, { selection, includeBytes: density === 'detailed' })
  return Object.freeze({
    density,
    visible: density !== 'none',
    metrics,
    charactersLabel: copy.metrics.characters,
    wordsLabel: copy.metrics.words,
  })
}

export const evaluateMarkdownEditorStatusMutations = () =>
  Object.freeze({
    mutations: Object.freeze([
      Object.freeze({ kind: 'product-read-time' as const, equivalent: false, accepted: false }),
    ]),
  })
