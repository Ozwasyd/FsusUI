import { collectMarkdownCaptionNodes } from './markdown-caption-directive'

export const renderMarkdownCaptionFigure = (source: string) =>
  collectMarkdownCaptionNodes(source).flatMap((node) => {
    if (!node.ok) return []
    const caption = node.text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    return [
      Object.freeze({
        tag: 'figure',
        caption,
        mediaRange: node.mediaRange,
      }),
    ]
  })

export const evaluateMarkdownCaptionRendererMutations = (source: string) => {
  const authority = renderMarkdownCaptionFigure(source)
  return Object.freeze({
    authority,
    mutations: Object.freeze([
      Object.freeze({
        kind: 'raw-html-caption' as const,
        equivalent: authority.some((item) => item.caption.includes('<script')),
        accepted: false,
      }),
    ]),
  })
}
