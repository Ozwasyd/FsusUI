export type MarkdownEditorChromeRegionChrome = 'framed' | 'embedded' | 'minimal'

export interface MarkdownEditorChromeRegions {
  readonly chrome: MarkdownEditorChromeRegionChrome
  readonly toolbar: boolean
  readonly status: boolean
  readonly modeSwitcher: boolean
  readonly actions: boolean
  readonly rootBorder: boolean
}

export const resolveMarkdownEditorChromeRegions = (
  chrome: MarkdownEditorChromeRegionChrome,
  options: {
    readonly toolbar?: boolean
    readonly status?: boolean
    readonly modeSwitcher?: boolean
    readonly actions?: boolean
  } = {},
): MarkdownEditorChromeRegions => {
  const framed = chrome === 'framed'
  const minimal = chrome === 'minimal'
  return Object.freeze({
    chrome,
    toolbar: !minimal && (options.toolbar ?? true),
    status: framed && (options.status ?? true),
    modeSwitcher: !minimal && (options.modeSwitcher ?? true),
    actions: framed && (options.actions ?? true),
    rootBorder: framed,
  })
}

export type MarkdownEditorChromeMutationKind =
  | 'second-root'
  | 'hidden-spacer'
  | 'duplicate-dom'
  | 'multi-template'
  | 'borderless'
  | 'private-selector'
  | 'write-mode'

export const evaluateMarkdownEditorChromeMutations = (
  chrome: MarkdownEditorChromeRegionChrome,
  extras: {
    readonly borderless?: boolean
    readonly privateSelector?: boolean
    readonly templates?: number
    readonly writeMode?: boolean
  } = {},
) => {
  const authority = resolveMarkdownEditorChromeRegions(chrome)
  const hiddenSpacer = authority.toolbar === false && extras.templates === 1
  return Object.freeze({
    authority,
    mutations: Object.freeze([
      Object.freeze({
        kind: 'second-root' as const,
        equivalent: extras.templates === 2,
        accepted: false,
      }),
      Object.freeze({
        kind: 'hidden-spacer' as const,
        equivalent: Boolean(hiddenSpacer && chrome === 'minimal' && authority.rootBorder),
        accepted: false,
      }),
      Object.freeze({
        kind: 'duplicate-dom' as const,
        equivalent: extras.templates === 2,
        accepted: false,
      }),
      Object.freeze({
        kind: 'multi-template' as const,
        equivalent: (extras.templates ?? 1) !== 1,
        accepted: false,
      }),
      Object.freeze({
        kind: 'borderless' as const,
        equivalent: extras.borderless === true,
        accepted: false,
      }),
      Object.freeze({
        kind: 'private-selector' as const,
        equivalent: extras.privateSelector === true,
        accepted: false,
      }),
      Object.freeze({
        kind: 'write-mode' as const,
        equivalent: extras.writeMode === true,
        accepted: false,
      }),
    ]),
  })
}
