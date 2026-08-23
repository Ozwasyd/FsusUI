import {
  convertMarkdownHtmlImportSnapshot,
  evaluateMarkdownHtmlConversionMutations as evaluateWasmHtmlConversionMutations,
} from '../../../wasm/markdown-html-convert'

export interface MarkdownHtmlConversion {
  readonly markdown: string
  readonly loss: readonly string[]
}

export const convertSanitizedHtmlToMarkdown = (html: string): MarkdownHtmlConversion => {
  const converted = convertMarkdownHtmlImportSnapshot({ html, explicit: true })
  return Object.freeze({
    markdown: converted.markdown.replace(/\n+$/, ''),
    loss: Object.freeze([
      ...new Set(converted.losses.map((item) => item.code.replace(/^(?:tag|attr):/, ''))),
    ]),
  })
}

export const evaluateMarkdownHtmlConversionMutations = (html: string) =>
  evaluateWasmHtmlConversionMutations(html)
