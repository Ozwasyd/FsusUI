export type MarkdownXssDomInvariants = {
  allowedNamespaces?: string[]
  forbidSelectors?: string[]
}

const forbiddenElements = new Set([
  'base',
  'embed',
  'form',
  'foreignobject',
  'iframe',
  'object',
  'script',
])
const urlAttributes = new Set([
  'action',
  'data',
  'formaction',
  'href',
  'poster',
  'src',
  'xlink:href',
])
const dangerousProtocol = /^(?:data|file|javascript|vbscript):/iu
const isUrlProtocolSeparator = (character: string) => {
  const codePoint = character.codePointAt(0) ?? 0
  return (
    codePoint <= 0x20 ||
    codePoint === 0x7f ||
    codePoint === 0x85 ||
    codePoint === 0xa0
  )
}

export const auditMarkdownXssHtml = (
  document: Document,
  html: string,
  invariants?: MarkdownXssDomInvariants,
) => {
  const template = document.createElement('template')
  template.innerHTML = html
  const violations: string[] = []
  const allowedNamespaces = new Set(
    invariants?.allowedNamespaces ?? [
      'http://www.w3.org/1999/xhtml',
      'http://www.w3.org/2000/svg',
      'http://www.w3.org/1998/Math/MathML',
    ],
  )
  for (const element of template.content.querySelectorAll('*')) {
    const tag = element.localName.toLowerCase()
    if (forbiddenElements.has(tag)) violations.push(`forbidden-element:${tag}`)
    if (!allowedNamespaces.has(element.namespaceURI ?? '')) {
      violations.push(`unknown-namespace:${element.namespaceURI ?? 'null'}`)
    }
    for (const attribute of element.getAttributeNames()) {
      const lower = attribute.toLowerCase()
      const value = element.getAttribute(attribute) ?? ''
      if (lower.startsWith('on')) violations.push(`event-attribute:${lower}`)
      if (lower === 'srcdoc') violations.push('forbidden-attribute:srcdoc')
      if (!urlAttributes.has(lower)) continue
      const normalized = [...value]
        .filter((character) => !isUrlProtocolSeparator(character))
        .join('')
        .toLowerCase()
      if (dangerousProtocol.test(normalized)) {
        violations.push(`dangerous-url:${normalized.split(':', 1)[0]}:`)
      } else if (
        normalized.startsWith('//') ||
        /^https?:/u.test(normalized)
      ) {
        violations.push(`external-url:${normalized}`)
      }
    }
  }
  for (const selector of invariants?.forbidSelectors ?? []) {
    try {
      if (template.content.querySelector(selector)) {
        violations.push(`forbidden-selector:${selector}`)
      }
    } catch {
      violations.push(`invalid-selector:${selector}`)
    }
  }
  return [...new Set(violations)].sort()
}

export const inspectMarkdownXssPreservation = (
  document: Document,
  html: string,
  preserve: { selectors: string[]; text: string[] },
) => {
  const template = document.createElement('template')
  template.innerHTML = html
  const text = template.content.textContent ?? ''
  return {
    missingSelectors: preserve.selectors.filter(
      (selector) => !template.content.querySelector(selector),
    ),
    missingText: preserve.text.filter((value) => !text.includes(value)),
  }
}

type CanonicalNode =
  | { kind: 'text'; value: string }
  | {
      attributes: Array<[string, string]>
      children: CanonicalNode[]
      kind: 'element'
      namespace: string
      tag: string
    }

const ignoredComponentClasses = new Set([
  'markdown-renderer__loading-pulse',
  'markdown-renderer__virtual-spacer',
])

const projectNode = (node: Node): CanonicalNode | null => {
  if (node.nodeType === node.TEXT_NODE) {
    const value = node.textContent ?? ''
    return value ? { kind: 'text', value } : null
  }
  if (node.nodeType !== node.ELEMENT_NODE) return null
  const element = node as Element
  if (
    [...element.classList].some((className) =>
      ignoredComponentClasses.has(className),
    )
  ) {
    return null
  }
  return {
    attributes: element
      .getAttributeNames()
      .filter(
        (name) =>
          !name.startsWith('data-fsus-render-') &&
          !name.startsWith('data-markdown-') &&
          name !== 'aria-busy' &&
          name !== 'data-markdown-renderer',
      )
      .map(
        (name) =>
          [name, element.getAttribute(name) ?? ''] as [string, string],
      )
      .sort(([left], [right]) => left.localeCompare(right)),
    children: Array.from(element.childNodes)
      .map(projectNode)
      .filter((child): child is CanonicalNode => child !== null),
    kind: 'element',
    namespace: element.namespaceURI ?? '',
    tag: element.localName,
  }
}

export const canonicalMarkdownXssDomProjection = (
  document: Document,
  html: string,
) => {
  const template = document.createElement('template')
  template.innerHTML = html
  const renderer = template.content.querySelector('[data-markdown-renderer]')
  const virtualUnits = renderer
    ? Array.from(
        renderer.querySelectorAll(':scope > .markdown-renderer__virtual-unit'),
      )
    : []
  const committedContainer =
    renderer && virtualUnits.length === 0
      ? Array.from(renderer.children).find(
          (element) =>
            element.localName === 'div' &&
            ![...element.classList].some((className) =>
              ignoredComponentClasses.has(className),
            ),
        )
      : undefined
  const roots =
    virtualUnits.length > 0
      ? virtualUnits.flatMap((unit) => Array.from(unit.childNodes))
      : committedContainer
        ? Array.from(committedContainer.childNodes)
        : Array.from(template.content.childNodes)
  return roots
    .map(projectNode)
    .filter((node): node is CanonicalNode => node !== null)
}
