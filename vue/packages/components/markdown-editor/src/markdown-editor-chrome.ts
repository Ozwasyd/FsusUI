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
    toolbar: options.toolbar ?? !minimal,
    status: options.status ?? framed,
    modeSwitcher: options.modeSwitcher ?? !minimal,
    actions: options.actions ?? framed,
    rootBorder: framed,
  })
}

export type MarkdownEditorChromeMutationKind =
  | 'second-root'
  | 'hidden-spacer'
  | 'duplicate-dom'

export const evaluateMarkdownEditorChromeMutations = (
  chrome: MarkdownEditorChromeRegionChrome,
) => {
  const authority = resolveMarkdownEditorChromeRegions(chrome)
  return Object.freeze({
    authority,
    mutations: Object.freeze([
      Object.freeze({
        kind: 'second-root' as const,
        equivalent: false,
        accepted: false,
      }),
      Object.freeze({
        kind: 'hidden-spacer' as const,
        equivalent: authority.rootBorder && chrome === 'minimal',
        accepted: false,
      }),
      Object.freeze({
        kind: 'duplicate-dom' as const,
        equivalent: false,
        accepted: false,
      }),
    ]),
  })
}
