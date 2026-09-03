export type MarkdownFeatureOutputKind = 'code-highlight' | 'latex' | 'mermaid'

export { MARKDOWN_FEATURE_OUTPUT_GATEWAY_VERSION } from './markdown-feature-output-gateway-version'

export type FeatureRenderOutput =
  | Readonly<{ kind: 'code-highlight'; payload: string }>
  | Readonly<{ kind: 'latex'; payload: string }>
  | Readonly<{ kind: 'mermaid'; payload: string; rootId: string }>

export type MarkdownFeatureOutputCommitMode =
  | 'replace-children'
  | 'replace-element'

export interface MarkdownFeatureOutputCommitOptions {
  mode?: MarkdownFeatureOutputCommitMode
  nonce?: string | null
}

interface MarkdownFeatureTrustedTypesPolicy {
  createHTML: (input: string) => object
}

interface MarkdownFeatureTrustedTypesFactory {
  createPolicy: (
    name: string,
    rules: Readonly<{ createHTML: (input: string) => string }>,
  ) => MarkdownFeatureTrustedTypesPolicy
}

type MarkdownFeatureTrustedTypesWindow = Window &
  Readonly<{ trustedTypes?: MarkdownFeatureTrustedTypesFactory }>

const MARKDOWN_FEATURE_TRUSTED_TYPES_POLICY_NAME = 'fsusui-markdown-feature'
const markdownFeatureTrustedTypesPolicies = new WeakMap<
  Window,
  MarkdownFeatureTrustedTypesPolicy
>()

const toMarkdownFeatureParsingHtml = (document: Document, payload: string) => {
  const ownerWindow =
    document.defaultView as MarkdownFeatureTrustedTypesWindow | null
  const trustedTypes = ownerWindow?.trustedTypes
  if (!trustedTypes) return payload

  let policy = markdownFeatureTrustedTypesPolicies.get(ownerWindow)
  try {
    if (!policy) {
      policy = trustedTypes.createPolicy(
        MARKDOWN_FEATURE_TRUSTED_TYPES_POLICY_NAME,
        { createHTML: (input) => input },
      )
      markdownFeatureTrustedTypesPolicies.set(ownerWindow, policy)
    }
  } catch (cause) {
    throw new Error('markdown_feature_trusted_types_policy_unavailable', {
      cause,
    })
  }
  return policy.createHTML(payload)
}

type FeatureNamespace =
  | 'http://www.w3.org/1998/Math/MathML'
  | 'http://www.w3.org/1999/xhtml'
  | 'http://www.w3.org/2000/svg'

interface FeatureOutputPolicy {
  classTokens: Readonly<{
    descendantForbiddenPrefixes: readonly string[]
    elements: Readonly<Record<string, readonly string[]>>
    preserveUnlistedDescendants: boolean
    root: readonly string[]
  }>
  elements: Readonly<Record<string, readonly string[]>>
  namespace: FeatureNamespace
  namespaceElements?: Readonly<Record<FeatureNamespace, readonly string[]>>
  styleProperties: readonly string[]
  urlAttributes: Readonly<Record<string, 'local-fragment'>>
}

export const CODE_HIGHLIGHT_OUTPUT_POLICY = Object.freeze({
  classTokens: Object.freeze({
    descendantForbiddenPrefixes: Object.freeze([]),
    elements: Object.freeze({
      code: Object.freeze([]),
      span: Object.freeze(['line']),
    }),
    preserveUnlistedDescendants: false,
    root: Object.freeze(['github-dark', 'github-light', 'shiki']),
  }),
  elements: Object.freeze({
    code: Object.freeze(['class']),
    pre: Object.freeze(['class', 'style', 'tabindex']),
    span: Object.freeze(['class', 'style']),
  }),
  namespace: 'http://www.w3.org/1999/xhtml',
  styleProperties: Object.freeze([
    'background',
    'background-color',
    'color',
    'font-style',
    'font-weight',
    'text-decoration',
  ]),
  urlAttributes: Object.freeze({}),
}) satisfies FeatureOutputPolicy

export const LATEX_OUTPUT_POLICY = Object.freeze({
  classTokens: Object.freeze({
    descendantForbiddenPrefixes: Object.freeze([]),
    elements: Object.freeze({}),
    preserveUnlistedDescendants: false,
    root: Object.freeze(['katex']),
  }),
  elements: Object.freeze({
    annotation: Object.freeze(['encoding']),
    math: Object.freeze(['aria-hidden', 'class', 'display', 'xmlns']),
    menclose: Object.freeze(['notation']),
    merror: Object.freeze([]),
    mfrac: Object.freeze(['linethickness']),
    mi: Object.freeze(['mathvariant']),
    mmultiscripts: Object.freeze([]),
    mn: Object.freeze([]),
    mo: Object.freeze([
      'accent',
      'fence',
      'form',
      'largeop',
      'movablelimits',
      'separator',
      'stretchy',
    ]),
    mover: Object.freeze(['accent']),
    mpadded: Object.freeze(['depth', 'height', 'lspace', 'voffset', 'width']),
    mphantom: Object.freeze([]),
    mroot: Object.freeze([]),
    mrow: Object.freeze([]),
    ms: Object.freeze([]),
    mspace: Object.freeze(['depth', 'height', 'width']),
    msqrt: Object.freeze([]),
    mstyle: Object.freeze([
      'displaystyle',
      'mathcolor',
      'mathsize',
      'scriptlevel',
    ]),
    msub: Object.freeze([]),
    msubsup: Object.freeze([]),
    msup: Object.freeze([]),
    mtable: Object.freeze(['columnalign', 'columnspacing', 'rowspacing']),
    mtd: Object.freeze(['columnalign', 'rowalign']),
    mtext: Object.freeze([]),
    mtr: Object.freeze(['rowalign']),
    munder: Object.freeze(['accentunder']),
    munderover: Object.freeze(['accent', 'accentunder']),
    semantics: Object.freeze([]),
    span: Object.freeze(['aria-hidden', 'class']),
  }),
  namespace: 'http://www.w3.org/1999/xhtml',
  namespaceElements: Object.freeze({
    'http://www.w3.org/1998/Math/MathML': Object.freeze([
      'annotation',
      'math',
      'menclose',
      'merror',
      'mfrac',
      'mi',
      'mmultiscripts',
      'mn',
      'mo',
      'mover',
      'mpadded',
      'mphantom',
      'mroot',
      'mrow',
      'ms',
      'mspace',
      'msqrt',
      'mstyle',
      'msub',
      'msubsup',
      'msup',
      'mtable',
      'mtd',
      'mtext',
      'mtr',
      'munder',
      'munderover',
      'semantics',
    ]),
    'http://www.w3.org/1999/xhtml': Object.freeze(['span']),
    'http://www.w3.org/2000/svg': Object.freeze([]),
  }),
  styleProperties: Object.freeze([]),
  urlAttributes: Object.freeze({}),
}) satisfies FeatureOutputPolicy

export const MERMAID_OUTPUT_POLICY = Object.freeze({
  classTokens: Object.freeze({
    descendantForbiddenPrefixes: Object.freeze([
      'el-',
      'fsus-',
      'is-',
      'markdown-renderer',
    ]),
    elements: Object.freeze({}),
    preserveUnlistedDescendants: true,
    root: Object.freeze([
      'classDiagram',
      'erDiagram',
      'flowchart',
      'statediagram',
    ]),
  }),
  elements: Object.freeze({
    a: Object.freeze([
      'aria-label',
      'class',
      'href',
      'id',
      'role',
      'transform',
    ]),
    circle: Object.freeze([
      'class',
      'cx',
      'cy',
      'fill',
      'id',
      'r',
      'stroke',
      'stroke-width',
      'style',
      'transform',
    ]),
    clipPath: Object.freeze(['id']),
    defs: Object.freeze([]),
    desc: Object.freeze([]),
    ellipse: Object.freeze([
      'class',
      'cx',
      'cy',
      'fill',
      'id',
      'rx',
      'ry',
      'stroke',
      'stroke-width',
      'style',
      'transform',
    ]),
    g: Object.freeze([
      'aria-label',
      'class',
      'fill',
      'id',
      'role',
      'stroke',
      'style',
      'transform',
    ]),
    line: Object.freeze([
      'class',
      'marker-end',
      'marker-start',
      'stroke',
      'stroke-dasharray',
      'stroke-linecap',
      'stroke-width',
      'style',
      'transform',
      'x1',
      'x2',
      'y1',
      'y2',
    ]),
    marker: Object.freeze([
      'class',
      'id',
      'markerHeight',
      'markerUnits',
      'markerWidth',
      'orient',
      'refX',
      'refY',
      'viewBox',
    ]),
    mask: Object.freeze(['id', 'maskUnits']),
    path: Object.freeze([
      'class',
      'd',
      'fill',
      'id',
      'marker-end',
      'marker-start',
      'stroke',
      'stroke-dasharray',
      'stroke-linecap',
      'stroke-linejoin',
      'stroke-width',
      'style',
      'transform',
    ]),
    pattern: Object.freeze([
      'height',
      'id',
      'patternUnits',
      'viewBox',
      'width',
      'x',
      'y',
    ]),
    polygon: Object.freeze([
      'class',
      'fill',
      'id',
      'points',
      'stroke',
      'stroke-width',
      'style',
      'transform',
    ]),
    polyline: Object.freeze([
      'class',
      'fill',
      'id',
      'points',
      'stroke',
      'stroke-width',
      'style',
      'transform',
    ]),
    rect: Object.freeze([
      'class',
      'fill',
      'height',
      'id',
      'rx',
      'ry',
      'stroke',
      'stroke-width',
      'style',
      'transform',
      'width',
      'x',
      'y',
    ]),
    style: Object.freeze(['nonce', 'type']),
    symbol: Object.freeze(['clip-rule', 'fill-rule', 'height', 'id', 'width']),
    svg: Object.freeze([
      'aria-label',
      'aria-labelledby',
      'aria-roledescription',
      'class',
      'height',
      'id',
      'preserveAspectRatio',
      'role',
      'style',
      'viewBox',
      'width',
      'xmlns',
    ]),
    text: Object.freeze([
      'alignment-baseline',
      'class',
      'dominant-baseline',
      'dy',
      'fill',
      'font-family',
      'font-size',
      'font-style',
      'font-weight',
      'id',
      'style',
      'text-anchor',
      'transform',
      'x',
      'y',
    ]),
    title: Object.freeze([]),
    tspan: Object.freeze([
      'class',
      'dy',
      'fill',
      'font-family',
      'font-size',
      'font-style',
      'font-weight',
      'style',
      'text-anchor',
      'x',
      'y',
    ]),
    use: Object.freeze([
      'class',
      'fill',
      'height',
      'href',
      'style',
      'transform',
      'width',
      'x',
      'y',
    ]),
  }),
  namespace: 'http://www.w3.org/2000/svg',
  styleProperties: Object.freeze([
    'alignment-baseline',
    'dominant-baseline',
    'fill',
    'fill-opacity',
    'filter',
    'font-family',
    'font-size',
    'font-style',
    'font-weight',
    'max-width',
    'opacity',
    'stroke',
    'stroke-dasharray',
    'stroke-dashoffset',
    'stroke-linecap',
    'stroke-linejoin',
    'stroke-opacity',
    'stroke-width',
    'text-anchor',
  ]),
  urlAttributes: Object.freeze({
    href: 'local-fragment',
    'marker-end': 'local-fragment',
    'marker-start': 'local-fragment',
  }),
}) satisfies FeatureOutputPolicy

interface CompiledFeatureOutputClassPolicy {
  readonly descendantForbiddenPrefixes: readonly string[]
  readonly elements: ReadonlyMap<string, ReadonlySet<string>>
  readonly preserveUnlistedDescendants: boolean
  readonly root: ReadonlySet<string>
}

interface CompiledFeatureOutputPolicy {
  readonly classTokens: CompiledFeatureOutputClassPolicy
  readonly elements: ReadonlyMap<string, ReadonlySet<string>>
  readonly namespace: FeatureNamespace
  readonly namespaceElements?: Readonly<
    Record<FeatureNamespace, readonly string[]>
  >
  readonly styleProperties: ReadonlySet<string>
  readonly urlAttributes: Readonly<Record<string, 'local-fragment'>>
}

const compileStringSet = (
  values: readonly string[],
  lowercase = false,
): ReadonlySet<string> => {
  const lookup = new Set<string>()
  for (const value of values) {
    lookup.add(lowercase ? value.toLowerCase() : value)
  }
  return lookup
}

const compileStringSetMap = (
  values: Readonly<Record<string, readonly string[]>>,
  lowercase = false,
): ReadonlyMap<string, ReadonlySet<string>> => {
  const lookup = new Map<string, ReadonlySet<string>>()
  for (const [key, entries] of Object.entries(values)) {
    lookup.set(key, compileStringSet(entries, lowercase))
  }
  return lookup
}

const compileFeatureOutputPolicy = (
  policy: FeatureOutputPolicy,
): CompiledFeatureOutputPolicy =>
  Object.freeze({
    classTokens: Object.freeze({
      descendantForbiddenPrefixes:
        policy.classTokens.descendantForbiddenPrefixes,
      elements: compileStringSetMap(policy.classTokens.elements),
      preserveUnlistedDescendants:
        policy.classTokens.preserveUnlistedDescendants,
      root: compileStringSet(policy.classTokens.root),
    }),
    elements: compileStringSetMap(policy.elements, true),
    namespace: policy.namespace,
    namespaceElements: policy.namespaceElements,
    styleProperties: compileStringSet(policy.styleProperties),
    urlAttributes: policy.urlAttributes,
  })

const compiledPolicies: Readonly<
  Record<MarkdownFeatureOutputKind, CompiledFeatureOutputPolicy>
> = Object.freeze({
  'code-highlight': compileFeatureOutputPolicy(CODE_HIGHLIGHT_OUTPUT_POLICY),
  latex: compileFeatureOutputPolicy(LATEX_OUTPUT_POLICY),
  mermaid: compileFeatureOutputPolicy(MERMAID_OUTPUT_POLICY),
})

const hasForbiddenControlCharacter = (value: string) => {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index)
    if (
      code === 0x7f ||
      (code < 0x20 && code !== 0x09 && code !== 0x0a && code !== 0x0d)
    ) {
      return true
    }
  }
  return false
}
const hasForbiddenCssSyntax = (value: string) =>
  hasForbiddenControlCharacter(value) || /[\\{}]|\/\*|\*\//u.test(value)
const forbiddenCssValuePattern =
  /(?:url|image|image-set|cross-fade|element|expression|behavior|-moz-binding)\s*\(|@|(?:javascript|vbscript|data)\s*:/iu
const forbiddenLayoutCssProperties = new Set([
  'bottom',
  'height',
  'inset',
  'left',
  'pointer-events',
  'position',
  'right',
  'top',
  'width',
  'z-index',
])
const forbiddenViewportCssUnitPattern =
  /(?:^|[^A-Za-z])(?:\d+(?:\.\d*)?|\.\d+)\s*(?:%|dvh|dvw|lvh|lvw|svh|svw|vh|vmax|vmin|vw)(?=$|[^A-Za-z])/iu
const allowedCssFunctions = new Set([
  'calc',
  'clamp',
  'drop-shadow',
  'hsl',
  'hsla',
  'linear-gradient',
  'matrix',
  'matrix3d',
  'max',
  'min',
  'rgb',
  'rgba',
  'rotate',
  'rotate3d',
  'scale',
  'scale3d',
  'skew',
  'translate',
  'translate3d',
])

const isSafeCssValue = (value: string) => {
  if (
    !value ||
    hasForbiddenCssSyntax(value) ||
    forbiddenCssValuePattern.test(value)
  ) {
    return false
  }

  for (const match of value.matchAll(/([A-Za-z][\w-]*)\s*\(/gu)) {
    if (!allowedCssFunctions.has(match[1]!.toLowerCase())) return false
  }
  return true
}

const isSafeCssDeclaration = (property: string, value: string) => {
  if (
    forbiddenLayoutCssProperties.has(property) ||
    forbiddenViewportCssUnitPattern.test(value) ||
    !isSafeCssValue(value)
  ) {
    return false
  }
  if (property !== 'max-width') return true
  const match = /^(\d+(?:\.\d+)?)px$/u.exec(value)
  return match !== null && Number(match[1]) <= 4096
}

const sanitizeStyle = (
  value: string,
  allowedProperties: ReadonlySet<string>,
) => {
  const declarations: string[] = []

  for (const declaration of value.split(';')) {
    const separator = declaration.indexOf(':')
    if (separator <= 0) continue
    const property = declaration.slice(0, separator).trim().toLowerCase()
    const propertyValue = declaration.slice(separator + 1).trim()
    if (
      !allowedProperties.has(property) ||
      !propertyValue ||
      !isSafeCssDeclaration(property, propertyValue)
    ) {
      continue
    }
    declarations.push(`${property}:${propertyValue}`)
  }

  return declarations.join(';')
}

const isLocalFragmentReference = (value: string) => {
  const normalized = value.trim()
  if (
    hasForbiddenCssSyntax(normalized) ||
    /[\s\u0085\u00a0]/u.test(normalized)
  ) {
    return false
  }
  if (/^url\(/iu.test(normalized)) {
    return /^url\(['"]?#[A-Za-z_][\w:.-]*['"]?\)$/u.test(normalized)
  }
  return /^#[A-Za-z_][\w:.-]*$/u.test(normalized)
}

const findCssBlockEnd = (css: string, openingBrace: number) => {
  let depth = 1
  let quote = ''
  for (let index = openingBrace + 1; index < css.length; index += 1) {
    const char = css[index]!
    if (quote) {
      if (char === quote) quote = ''
      continue
    }
    if (char === '"' || char === "'") {
      quote = char
      continue
    }
    if (char === '{') depth += 1
    if (char === '}') {
      depth -= 1
      if (depth === 0) return index
    }
  }
  return -1
}

const isRootScopedSelectorList = (selectorList: string, rootId: string) => {
  if (
    hasForbiddenCssSyntax(selectorList) ||
    /[+~]|:has\s*\(|:host(?:-context)?\b/iu.test(selectorList)
  ) {
    return false
  }

  const rootSelector = `#${rootId}`
  return selectorList.split(',').every((selector) => {
    const normalized = selector.trim()
    if (!normalized.startsWith(rootSelector)) return false
    const boundary = normalized[rootSelector.length]
    return (
      boundary === undefined || boundary === '[' || /[\s.:>#]/u.test(boundary)
    )
  })
}

const sanitizeMermaidStyleSheet = (
  css: string,
  rootId: string,
  allowedProperties: ReadonlySet<string>,
) => {
  if (
    hasForbiddenControlCharacter(css) ||
    /\\|\/\*|\*\//u.test(css) ||
    css.includes('</')
  ) {
    return ''
  }

  const rules: string[] = []
  let cursor = 0
  while (cursor < css.length) {
    while (cursor < css.length && /\s/u.test(css[cursor]!)) cursor += 1
    if (cursor >= css.length) break

    const openingBrace = css.indexOf('{', cursor)
    if (openingBrace < 0) return ''
    const prelude = css.slice(cursor, openingBrace).trim()
    const closingBrace = findCssBlockEnd(css, openingBrace)
    if (!prelude || closingBrace < 0) return ''

    if (!prelude.startsWith('@')) {
      const declarationBlock = css.slice(openingBrace + 1, closingBrace)
      if (
        declarationBlock.includes('{') ||
        declarationBlock.includes('}') ||
        !isRootScopedSelectorList(prelude, rootId)
      ) {
        return ''
      }
      const declarations = sanitizeStyle(declarationBlock, allowedProperties)
      if (declarations) rules.push(`${prelude}{${declarations}}`)
    }

    cursor = closingBrace + 1
  }

  return rules.join('')
}

const isAllowedElementNamespace = (
  element: Element,
  policy: CompiledFeatureOutputPolicy,
) => {
  if (!policy.namespaceElements) {
    return element.namespaceURI === policy.namespace
  }
  const namespace = element.namespaceURI
  if (
    namespace !== 'http://www.w3.org/1998/Math/MathML' &&
    namespace !== 'http://www.w3.org/1999/xhtml' &&
    namespace !== 'http://www.w3.org/2000/svg'
  ) {
    return false
  }
  return policy.namespaceElements[namespace].includes(element.localName)
}

const sanitizeClassTokens = (
  element: Element,
  policy: CompiledFeatureOutputPolicy,
  isRoot: boolean,
) => {
  const classPolicy = policy.classTokens
  const exactTokens = isRoot
    ? classPolicy.root
    : classPolicy.elements.get(element.localName)
  const forbiddenPrefixes = classPolicy.descendantForbiddenPrefixes

  for (const token of Array.from(element.classList)) {
    const normalized = token.toLowerCase()
    const forbidden =
      !isRoot &&
      forbiddenPrefixes.some((prefix) => normalized.startsWith(prefix))
    const keep = exactTokens
      ? exactTokens.has(token)
      : classPolicy.preserveUnlistedDescendants && !forbidden
    if (!keep) element.classList.remove(token)
  }
  if (element.classList.length === 0) {
    element.removeAttribute('class')
  }
}

const sanitizeElement = (
  element: Element,
  policy: CompiledFeatureOutputPolicy,
  isRoot: boolean,
) => {
  const tag = element.localName
  const allowedAttributes = policy.elements.get(tag)
  const declaredNamespace = element.getAttribute('xmlns')
  if (
    !allowedAttributes ||
    !isAllowedElementNamespace(element, policy) ||
    (declaredNamespace !== null && declaredNamespace !== element.namespaceURI)
  ) {
    element.remove()
    return
  }

  for (const attribute of Array.from(element.attributes)) {
    const name = attribute.name.toLowerCase()
    const value = attribute.value.trim()
    const hasUnknownNamespace =
      attribute.namespaceURI !== null &&
      attribute.namespaceURI !== 'http://www.w3.org/2000/xmlns/'

    if (
      hasUnknownNamespace ||
      name.startsWith('on') ||
      name === 'srcdoc' ||
      !allowedAttributes.has(name)
    ) {
      element.removeAttributeNode(attribute)
      continue
    }

    if (
      name === 'xmlns' &&
      value !== 'http://www.w3.org/2000/svg' &&
      value !== 'http://www.w3.org/1998/Math/MathML'
    ) {
      element.removeAttributeNode(attribute)
      continue
    }
    if (name === 'xmlns') continue

    if (name === 'class') {
      sanitizeClassTokens(element, policy, isRoot)
      continue
    }

    if (name === 'style') {
      const style = sanitizeStyle(value, policy.styleProperties)
      if (style) element.setAttribute('style', style)
      else element.removeAttributeNode(attribute)
      continue
    }

    const urlPolicy = policy.urlAttributes[name]
    if (urlPolicy === 'local-fragment') {
      if (!isLocalFragmentReference(value)) {
        element.removeAttributeNode(attribute)
      }
      continue
    }

    if (
      hasForbiddenControlCharacter(value) ||
      /[\\{};]/u.test(value) ||
      /(?:url|image|image-set|cross-fade|element|expression|behavior|-moz-binding)\s*\(|(?:javascript|vbscript|data|https?)\s*:|^\/\//iu.test(
        value,
      )
    ) {
      element.removeAttributeNode(attribute)
    }
  }

  if (tag === 'style') {
    element.removeAttribute('nonce')
  }
}

const sanitizeFeatureOutput = (
  fragment: DocumentFragment,
  policy: CompiledFeatureOutputPolicy,
) => {
  for (const element of Array.from(fragment.querySelectorAll('*')).reverse()) {
    sanitizeElement(element, policy, element.parentNode === fragment)
  }
  return fragment
}

const getSingleElementRoot = (fragment: DocumentFragment) => {
  const roots = Array.from(fragment.children)
  const hasNonWhitespaceSibling = Array.from(fragment.childNodes).some(
    (node) =>
      node.nodeType === Node.TEXT_NODE && Boolean(node.textContent?.trim()),
  )
  if (roots.length !== 1 || hasNonWhitespaceSibling) return null
  return roots[0] ?? null
}

const validateCodeHighlightRoot = (root: Element) => {
  if (
    root.namespaceURI !== 'http://www.w3.org/1999/xhtml' ||
    root.localName !== 'pre' ||
    root.children.length !== 1 ||
    root.firstElementChild?.localName !== 'code'
  ) {
    return false
  }
  const structuralElements = root.querySelectorAll('pre,code')
  const hasTheme =
    Number(root.classList.contains('github-light')) +
      Number(root.classList.contains('github-dark')) ===
    1
  return (
    root.classList.length === 2 &&
    root.classList.contains('shiki') &&
    hasTheme &&
    structuralElements.length === 1 &&
    structuralElements[0] === root.firstElementChild
  )
}

const validateLatexRoot = (root: Element) =>
  root.namespaceURI === 'http://www.w3.org/1999/xhtml' &&
  root.localName === 'span' &&
  root.classList.length === 1 &&
  root.classList.contains('katex') &&
  root.querySelector('math')?.namespaceURI ===
    'http://www.w3.org/1998/Math/MathML'

const extractLocalFragmentId = (value: string) => {
  const normalized = value.trim()
  const match = /^url\(['"]?(#[A-Za-z_][\w:.-]*)['"]?\)$/u.exec(normalized)
  return (match?.[1] ?? normalized).slice(1)
}

const sanitizeMermaidRoot = (
  root: Element,
  rootId: string,
  nonce?: string | null,
) => {
  if (
    !/^fsus-markdown-mermaid-[A-Za-z0-9_-]+$/u.test(rootId) ||
    root.namespaceURI !== 'http://www.w3.org/2000/svg' ||
    root.localName !== 'svg' ||
    root.getAttribute('id') !== rootId
  ) {
    return false
  }

  if (root.getAttribute('width') !== '100%') {
    root.removeAttribute('width')
  }
  const height = root.getAttribute('height')
  if (
    height !== null &&
    (!/^\d+(?:\.\d+)?$/u.test(height) ||
      Number(height) <= 0 ||
      Number(height) > 4096)
  ) {
    root.removeAttribute('height')
  }
  const allElements = [root, ...Array.from(root.querySelectorAll('*'))]
  const declaredIds = new Set<string>()
  for (const element of allElements) {
    const id = element.getAttribute('id')
    if (!id) continue
    if (
      id !== rootId &&
      !id.startsWith(`${rootId}-`) &&
      !id.startsWith(`${rootId}_`)
    ) {
      element.removeAttribute('id')
      continue
    }
    declaredIds.add(id)
  }

  for (const element of allElements) {
    for (const attributeName of ['href', 'marker-end', 'marker-start']) {
      const value = element.getAttribute(attributeName)
      if (!value) continue
      const referencedId = extractLocalFragmentId(value)
      if (!declaredIds.has(referencedId)) {
        element.removeAttribute(attributeName)
      }
    }
  }

  for (const style of Array.from(root.querySelectorAll('style'))) {
    const safeCss = sanitizeMermaidStyleSheet(
      style.textContent ?? '',
      rootId,
      compiledPolicies.mermaid.styleProperties,
    )
    if (!safeCss) {
      style.remove()
      continue
    }
    style.textContent = safeCss
    style.removeAttribute('nonce')
    if (nonce) style.setAttribute('nonce', nonce)
  }
  return true
}

export const commitMarkdownFeatureOutput = (
  target: HTMLElement,
  output: FeatureRenderOutput,
  options: MarkdownFeatureOutputCommitOptions = {},
) => {
  const template = target.ownerDocument.createElement('template')
  ;(
    template as unknown as {
      innerHTML: string | object
    }
  ).innerHTML = toMarkdownFeatureParsingHtml(
    target.ownerDocument,
    output.payload,
  )
  const fragment = sanitizeFeatureOutput(
    template.content,
    compiledPolicies[output.kind],
  )
  const root = getSingleElementRoot(fragment)
  const validRoot =
    root !== null &&
    (output.kind === 'code-highlight'
      ? validateCodeHighlightRoot(root)
      : output.kind === 'latex'
        ? validateLatexRoot(root)
        : sanitizeMermaidRoot(root, output.rootId, options.nonce))

  if (!validRoot) throw new Error(`${output.kind}_output_root_invalid`)

  if (output.kind === 'code-highlight') {
    if (options.mode !== 'replace-element') {
      throw new Error('code-highlight_output_commit_mode_invalid')
    }
    const replacement = root as HTMLElement
    target.replaceWith(replacement)
    return replacement
  }

  if (options.mode === 'replace-element') {
    throw new Error(`${output.kind}_output_commit_mode_invalid`)
  }
  target.replaceChildren(fragment)
  return target
}
