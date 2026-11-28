import { resolveMarkdownEditorChromeRegions } from './markdown-editor-chrome'
import { type MarkdownEditorMode } from './markdown-editor-live-contract'
import { resolveMarkdownLiveSurface } from './markdown-editor-live-surface'

export const MARKDOWN_EDITOR_CHROME_VARIANTS = ['framed', 'embedded', 'minimal'] as const
export const MARKDOWN_EDITOR_MODE_VARIANTS = ['source', 'live', 'split', 'preview'] as const

export type MarkdownEditorChromeVariant = (typeof MARKDOWN_EDITOR_CHROME_VARIANTS)[number]
export type MarkdownEditorModeVariant = (typeof MARKDOWN_EDITOR_MODE_VARIANTS)[number]

export interface MarkdownEditorChromeGeometry {
  readonly chrome: MarkdownEditorChromeVariant
  readonly mode: MarkdownEditorModeVariant
  readonly instanceKey: 'document'
  readonly scrollContainer: 'body'
  readonly rootBorder: boolean
  readonly toolbar: boolean
  readonly status: boolean
  readonly splitSeparator: boolean
  readonly secondDocumentSurface: boolean
  readonly emptyMinimalHeight: boolean
  readonly focusRing: 'control-focus-visible'
  readonly inputVisible: boolean
  readonly rendererVisible: boolean
  readonly dualLiveOverlay: boolean
  readonly previewAccessibleName: boolean
}

export const resolveMarkdownEditorChromeGeometry = (
  chrome: MarkdownEditorChromeVariant,
  mode: MarkdownEditorModeVariant,
): MarkdownEditorChromeGeometry => {
  const regions = resolveMarkdownEditorChromeRegions(chrome)
  const surface = resolveMarkdownLiveSurface({
    documentIdentity: { id: 'doc', epoch: 1 },
    mode: mode as MarkdownEditorMode,
    revision: 1,
    source: '# Title\n',
  })
  return Object.freeze({
    chrome,
    mode,
    instanceKey: 'document',
    scrollContainer: 'body',
    rootBorder: regions.rootBorder,
    toolbar: regions.toolbar,
    status: regions.status,
    splitSeparator: mode === 'split',
    secondDocumentSurface: false,
    emptyMinimalHeight: chrome === 'minimal' ? false : true,
    focusRing: 'control-focus-visible',
    inputVisible: surface.inputVisible,
    rendererVisible: surface.rendererVisible,
    dualLiveOverlay: mode === 'live' && surface.inputVisible && surface.rendererVisible,
    previewAccessibleName: true,
  })
}

export const listMarkdownEditorChromeModeCombinations = () =>
  Object.freeze(
    MARKDOWN_EDITOR_CHROME_VARIANTS.flatMap((chrome) =>
      MARKDOWN_EDITOR_MODE_VARIANTS.map((mode) => resolveMarkdownEditorChromeGeometry(chrome, mode)),
    ),
  )

export interface MarkdownEditorChromeSwitchSnapshot {
  readonly instanceId: string
  readonly epoch: number
  readonly selection: { readonly start: number; readonly end: number; readonly direction: string }
  readonly history: { readonly undoDepth: number; readonly redoDepth: number }
  readonly scrollTop: number
}

export const planMarkdownEditorChromeSwitch = (
  before: MarkdownEditorChromeSwitchSnapshot,
  next: { readonly chrome: MarkdownEditorChromeVariant; readonly mode: MarkdownEditorModeVariant },
) =>
  Object.freeze({
    chrome: next.chrome,
    mode: next.mode,
    rebuilt: false,
    instanceId: before.instanceId,
    epoch: before.epoch,
    selection: before.selection,
    history: before.history,
    scrollTop: before.scrollTop,
  })

export const retainMarkdownEditorInstance = <
  T extends Readonly<Record<string, unknown>>,
>(
  instance: T,
  chrome: MarkdownEditorChromeVariant,
  mode: MarkdownEditorModeVariant,
) => Object.freeze({ ...instance, chrome, mode })

export type MarkdownEditorChromeStabilityMutationKind =
  | 'root-vif-rebuild'
  | 'dual-scroll-container'
  | 'separator-card'
  | 'border-dependent-focus'

export const evaluateMarkdownEditorChromeStabilityMutations = (sources: {
  readonly vue: string
  readonly scss: string
}) => {
  const rootVif = /<section\b[^>]*\bv-if\b/.test(sources.vue)
  const live = resolveMarkdownEditorChromeGeometry('framed', 'live')
  const previewTag = sources.vue.match(/<el-markdown-renderer[\s\S]{0,280}>/)?.[0] ?? ''
  const previewRule = sources.scss.match(/e\(preview\)\s*\{[^}]+\}/g) ?? []
  const previewCard =
    /\bcard\b/.test(previewTag) ||
    previewRule.some((rule) => /box-shadow:\s+(?!none\b)/.test(rule))
  const textareaFocus = sources.scss.includes('focus-visible')
  const embeddedBorderless =
    sources.scss.includes('chrome-embedded') && sources.scss.includes('border: 0')
  return Object.freeze({
    mutations: Object.freeze([
      Object.freeze({
        kind: 'root-vif-rebuild' as const,
        equivalent: rootVif,
        accepted: false,
      }),
      Object.freeze({
        kind: 'dual-scroll-container' as const,
        equivalent: live.dualLiveOverlay,
        accepted: false,
      }),
      Object.freeze({
        kind: 'separator-card' as const,
        equivalent: Boolean(previewCard),
        accepted: false,
      }),
      Object.freeze({
        kind: 'border-dependent-focus' as const,
        equivalent: !textareaFocus || !embeddedBorderless,
        accepted: false,
      }),
    ]),
  })
}
