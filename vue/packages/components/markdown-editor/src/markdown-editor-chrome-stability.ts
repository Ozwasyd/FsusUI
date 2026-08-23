export const retainMarkdownEditorInstance = <T extends { readonly id: string }>(
  previous: T,
  nextChrome: string,
  nextMode: string,
): T & { readonly chrome: string; readonly mode: string } =>
  Object.freeze({
    ...previous,
    chrome: nextChrome,
    mode: nextMode,
  })

export const evaluateMarkdownChromeStabilityMutations = () =>
  Object.freeze({
    mutations: Object.freeze([
      Object.freeze({ kind: 'remount' as const, equivalent: false, accepted: false }),
    ]),
  })
