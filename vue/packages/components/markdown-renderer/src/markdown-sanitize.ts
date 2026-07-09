import type {
  MarkdownRenderChunk,
  MarkdownRuntimeChunkResult,
  MarkdownRuntimeHtmlResult,
  MarkdownRuntimeRenderResult,
} from '@element-plus/wasm'

const unsafeElementNames = new Set([
  'base',
  'embed',
  'iframe',
  'link',
  'meta',
  'object',
  'script',
  'style',
])

const urlAttributeNames = new Set([
  'action',
  'formaction',
  'href',
  'poster',
  'src',
  'xlink:href',
])

const dangerousUrlProtocolRe = /^(?:javascript|vbscript):/i
const dataUrlRe = /^data:/i
const safeDataImageRe = /^data:image\/(?:gif|jpeg|jpg|png|webp);base64,/i

const hasUnsafeStyleValue = (value: string) =>
  /(?:expression\s*\(|url\s*\(\s*['"]?\s*(?:javascript|vbscript|data):)/i.test(
    value,
  )

const stripUrlControlChars = (value: string) =>
  Array.from(value)
    .filter((char) => {
      const code = char.charCodeAt(0)
      return code > 31 && code !== 127 && !/\s/.test(char)
    })
    .join('')

const isUnsafeUrlValue = (value: string) => {
  const normalized = stripUrlControlChars(value)

  if (dangerousUrlProtocolRe.test(normalized)) return true
  return dataUrlRe.test(normalized) && !safeDataImageRe.test(normalized)
}

const sanitizeHtmlWithDom = (html: string) => {
  const template = document.createElement('template')
  template.innerHTML = html

  for (const element of Array.from(template.content.querySelectorAll('*'))) {
    const name = element.tagName.toLowerCase()

    if (unsafeElementNames.has(name)) {
      element.remove()
      continue
    }

    for (const attribute of Array.from(element.attributes)) {
      const attributeName = attribute.name.toLowerCase()
      const value = attribute.value.trim()

      if (attributeName.startsWith('on') || attributeName === 'srcdoc') {
        element.removeAttribute(attribute.name)
        continue
      }

      if (
        urlAttributeNames.has(attributeName) &&
        isUnsafeUrlValue(value)
      ) {
        element.removeAttribute(attribute.name)
        continue
      }

      if (attributeName === 'style' && hasUnsafeStyleValue(value)) {
        element.removeAttribute(attribute.name)
      }
    }
  }

  return template.innerHTML
}

const sanitizeHtmlWithoutDom = (html: string) =>
  html
    .replace(
      /<\s*(script|style|iframe|object|embed|link|meta|base)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi,
      '',
    )
    .replace(
      /<\s*(script|style|iframe|object|embed|link|meta|base)\b[^>]*\/?\s*>/gi,
      '',
    )
    .replace(/\s+on[\w:-]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/\s+srcdoc\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(
      /\s+(href|src|poster|action|formaction|xlink:href)\s*=\s*(["']?)\s*((?:java|vb)script|data):[^"'\s>]*/gi,
      '',
    )
    .replace(
      /\s+style\s*=\s*(["'])(?=[^"']*(?:expression\s*\(|url\s*\(\s*['"]?\s*(?:javascript|vbscript|data):))[^"']*\1/gi,
      '',
    )

export const sanitizeMarkdownHtml = (html: string) => {
  if (!html) return html

  return typeof document === 'undefined'
    ? sanitizeHtmlWithoutDom(html)
    : sanitizeHtmlWithDom(html)
}

export const sanitizeMarkdownChunk = (
  chunk: MarkdownRenderChunk,
): MarkdownRenderChunk => {
  const html = sanitizeMarkdownHtml(chunk.html)
  return html === chunk.html ? chunk : { ...chunk, html }
}

export const sanitizeMarkdownHtmlResult = (
  result: MarkdownRuntimeHtmlResult,
): MarkdownRuntimeHtmlResult => {
  const html = sanitizeMarkdownHtml(result.html)
  return html === result.html ? result : { ...result, html }
}

export const sanitizeMarkdownRenderResult = <
  TResult extends MarkdownRuntimeChunkResult | MarkdownRuntimeRenderResult,
>(
  result: TResult,
): TResult => {
  const html = sanitizeMarkdownHtml(result.html)
  const hasChunks = 'chunks' in result
  const chunks = hasChunks
    ? (result as MarkdownRuntimeChunkResult).chunks.map(sanitizeMarkdownChunk)
    : undefined
  const chunksChanged =
    chunks &&
    chunks.some(
      (chunk, index) =>
        chunk !== (result as MarkdownRuntimeChunkResult).chunks[index],
    )

  if (html === result.html && !chunksChanged) {
    return result
  }

  return {
    ...result,
    html,
    ...(chunks ? { chunks } : {}),
  } as TResult
}
