import {
  planMarkdownLanguageToolReplacement,
  resolveMarkdownLanguageToolCapability,
} from './markdown-editor-language-tools'

export const bindMarkdownWebLanguageTools = (textarea: {
  spellcheck?: boolean
  autocapitalize?: string
}) => {
  const capability = resolveMarkdownLanguageToolCapability({ spellcheck: true })
  textarea.spellcheck = capability.spellcheck
  return capability
}

export const applyMarkdownSpellReplacement = (from: number, to: number, insert: string) =>
  planMarkdownLanguageToolReplacement(from, to, insert)
