import {
  collectMarkdownCaptionNodes,
  type MarkdownCaptionValidNode,
} from './markdown-caption-directive'

const escapeText = (value: string) =>
  value.replace(/[&<>"']/g, (char) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] ?? char,
  )

const IMAGE = /^!\[([^\]]*)\]\(\s*([^)\s]*)(?:\s+"([^"]*)")?\s*\)$/

export interface MarkdownCaptionMediaRender {
  readonly tag: 'img'
  readonly alt: string
  readonly src: string
  readonly title?: string
  readonly broken: boolean
  readonly unsupported: boolean
  readonly tabIndex: -1
}

export interface MarkdownCaptionLabelRender {
  readonly tag: 'figcaption'
  readonly text: string
  readonly html: string
  readonly tabIndex: -1
  readonly role: 'note'
}

export interface MarkdownCaptionFigureRender {
  readonly tag: 'figure'
  readonly html: string
  readonly media: MarkdownCaptionMediaRender
  readonly caption: string
  readonly label: MarkdownCaptionLabelRender
  readonly visibleCopy: string
  readonly sourceDirective: string
  readonly mediaRange: { readonly start: number; readonly end: number }
  readonly captionRange: { readonly start: number; readonly end: number }
}

const parseMedia = (line: string): MarkdownCaptionMediaRender => {
  const match = IMAGE.exec(line.trim())
  const alt = match?.[1] ?? ''
  const src = match?.[2] ?? ''
  const title = match?.[3]
  const broken = src.length === 0 || src === '#'
  const unsupported = !broken && !/^[^\s]+$/u.test(src)
  return Object.freeze({
    tag: 'img',
    alt,
    src,
    ...(title ? { title } : {}),
    broken,
    unsupported,
    tabIndex: -1,
  })
}

export const renderMarkdownCaptionFigure = (source: string): readonly MarkdownCaptionFigureRender[] =>
  Object.freeze(
    collectMarkdownCaptionNodes(source).flatMap((node) => {
      if (!node.ok) return []
      const valid = node as MarkdownCaptionValidNode
      const mediaLine = source.slice(valid.mediaRange.start, valid.mediaRange.end)
      const media = parseMedia(mediaLine)
      const captionText = valid.text
      const captionHtml = escapeText(captionText)
      const fallback =
        media.broken || media.unsupported
          ? `<span data-markdown-media-fallback>${escapeText(mediaLine)}</span>`
          : `<img alt="${escapeText(media.alt)}" src="${escapeText(media.src)}" tabindex="-1">`
      const label: MarkdownCaptionLabelRender = Object.freeze({
        tag: 'figcaption',
        text: captionText,
        html: captionHtml,
        tabIndex: -1,
        role: 'note',
      })
      const html = `<figure>${fallback}<figcaption tabindex="-1" dir="auto">${captionHtml}</figcaption></figure>`
      return [
        Object.freeze({
          tag: 'figure' as const,
          html,
          media,
          caption: captionHtml,
          label,
          visibleCopy: captionText,
          sourceDirective: source.slice(valid.ranges.full.start, valid.ranges.full.end),
          mediaRange: valid.mediaRange,
          captionRange: valid.ranges.full,
        }),
      ]
    }),
  )

export type MarkdownCaptionRendererMutationKind =
  | 'title-caption'
  | 'dom-regroup'
  | 'arbitrary-html'
  | 'alt-copy'
  | 'permanent-tab-stop'

export const evaluateMarkdownCaptionRendererMutations = (source: string) => {
  const authority = renderMarkdownCaptionFigure(source)
  const first = authority[0]
  const titleUsed =
    Boolean(first?.media.title) &&
    first?.label.text === first.media.title &&
    first.media.alt !== first.media.title
  const altCopied =
    Boolean(first) &&
    first!.media.alt.length > 0 &&
    first!.label.text === first!.media.alt &&
    !source.includes(`::caption[${first!.media.alt}]`)
  const htmlInjected = Boolean(first?.label.html.includes('<em>') || first?.html.includes('<script'))
  const tabStop = Boolean(first && first.label.tabIndex >= 0)
  return Object.freeze({
    authority,
    mutations: Object.freeze([
      Object.freeze({
        kind: 'title-caption' as const,
        equivalent: Boolean(titleUsed),
        accepted: false,
      }),
      Object.freeze({
        kind: 'dom-regroup' as const,
        equivalent: false,
        accepted: false,
      }),
      Object.freeze({
        kind: 'arbitrary-html' as const,
        equivalent: htmlInjected,
        accepted: false,
      }),
      Object.freeze({
        kind: 'alt-copy' as const,
        equivalent: Boolean(altCopied),
        accepted: false,
      }),
      Object.freeze({
        kind: 'permanent-tab-stop' as const,
        equivalent: tabStop,
        accepted: false,
      }),
    ]),
  })
}
