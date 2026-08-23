export const MARKDOWN_URL_STATES = Object.freeze([
  'valid-internal',
  'valid-relative',
  'valid-hash',
  'valid-external',
  'invalid-syntax',
  'blocked-scheme',
  'unsupported',
] as const)

export type MarkdownUrlState = (typeof MARKDOWN_URL_STATES)[number]

export const MARKDOWN_URL_AUTHORITY_VERSION = 'markdown-url@2026-08-23'

export interface MarkdownUrlIdentity {
  readonly documentEpoch: number
  readonly revision: number
  readonly nodeId: string
  readonly value: string
  readonly version: number
}

export interface MarkdownUrlValidation {
  readonly state: MarkdownUrlState
  readonly value: string
  readonly authorityVersion: typeof MARKDOWN_URL_AUTHORITY_VERSION
  readonly identity: MarkdownUrlIdentity
  readonly open:
    | { readonly allowed: true; readonly href: string; readonly rel?: string; readonly target?: string }
    | { readonly allowed: false; readonly reason: MarkdownUrlState }
}

const BLOCKED_SCHEMES = new Set([
  'javascript',
  'vbscript',
  'data',
  'file',
  'about',
  'blob',
])

const EXTERNAL_SCHEMES = new Set(['http', 'https', 'mailto', 'tel'])

const hasForbiddenUrlChar = (value: string) => {
  for (const char of value) {
    const code = char.codePointAt(0) ?? 0
    if (
      code <= 0x20 ||
      code === 0x7f ||
      char === '\\' ||
      code === 0x200e ||
      code === 0x200f ||
      (code >= 0x202a && code <= 0x202e) ||
      (code >= 0x2066 && code <= 0x2069)
    ) {
      return true
    }
  }
  return false
}

const schemeOf = (value: string) => {
  const colon = value.indexOf(':')
  if (colon <= 0) return null
  return value.slice(0, colon).toLowerCase()
}

export const classifyMarkdownUrl = (raw: string): MarkdownUrlState => {
  const value = raw.trim()
  if (!value || hasForbiddenUrlChar(value)) {
    return 'invalid-syntax'
  }
  if (value.startsWith('//') || value.includes('@') && schemeOf(value) === 'http') {
    if (value.includes('@') && (value.startsWith('http://') || value.startsWith('https://'))) {
      const afterScheme = value.slice(value.indexOf('://') + 3)
      if (afterScheme.includes('@') && !afterScheme.includes('/')) {
        return 'invalid-syntax'
      }
    }
  }
  if (value.startsWith('//')) return 'blocked-scheme'
  if (value.startsWith('#')) return 'valid-hash'
  if (value.startsWith('/') || value.startsWith('./') || value.startsWith('../')) {
    return 'valid-relative'
  }
  const scheme = schemeOf(value)
  if (!scheme) return 'valid-internal'
  if (BLOCKED_SCHEMES.has(scheme) || scheme.startsWith('data')) return 'blocked-scheme'
  if (EXTERNAL_SCHEMES.has(scheme)) return 'valid-external'
  return 'unsupported'
}

export const validateMarkdownUrl = (
  value: string,
  identity: MarkdownUrlIdentity,
): MarkdownUrlValidation => {
  if (identity.value !== value) {
    return Object.freeze({
      state: 'invalid-syntax',
      value,
      authorityVersion: MARKDOWN_URL_AUTHORITY_VERSION,
      identity,
      open: Object.freeze({ allowed: false, reason: 'invalid-syntax' as const }),
    })
  }
  const state = classifyMarkdownUrl(value)
  const open =
    state === 'valid-external'
      ? Object.freeze({
          allowed: true as const,
          href: value.trim(),
          rel: 'noopener noreferrer',
          target: '_blank',
        })
      : state.startsWith('valid-')
        ? Object.freeze({ allowed: true as const, href: value.trim() })
        : Object.freeze({ allowed: false as const, reason: state })
  return Object.freeze({
    state,
    value,
    authorityVersion: MARKDOWN_URL_AUTHORITY_VERSION,
    identity,
    open,
  })
}

export const isMarkdownUrlResultCurrent = (
  result: MarkdownUrlValidation,
  identity: MarkdownUrlIdentity,
) =>
  result.identity.documentEpoch === identity.documentEpoch &&
  result.identity.revision === identity.revision &&
  result.identity.nodeId === identity.nodeId &&
  result.identity.value === identity.value &&
  result.identity.version === identity.version

export const applyMarkdownUrlValidation = (
  result: MarkdownUrlValidation,
  identity: MarkdownUrlIdentity,
) => (isMarkdownUrlResultCurrent(result, identity) ? result : null)

export type MarkdownUrlMutationKind =
  | 'editor-policy-drift'
  | 'https-only'
  | 'unsafe-open'
  | 'stale-result'
  | 'duplicated-regex'

export const evaluateMarkdownUrlMutations = (value: string, identity: MarkdownUrlIdentity) => {
  const authority = validateMarkdownUrl(value, identity)
  const httpsOnly = value.startsWith('/') ? 'invalid-syntax' : authority.state
  const unsafeOpen = {
    ...authority,
    open: { allowed: true, href: value, target: '_self' },
  }
  const staleIdentity = { ...identity, revision: identity.revision + 1 }
  const regex = /^https?:\/\//.test(value) ? 'valid-external' : 'invalid-syntax'
  return Object.freeze({
    authority,
    mutations: Object.freeze([
      Object.freeze({
        kind: 'editor-policy-drift' as const,
        equivalent: false,
        accepted: false,
      }),
      Object.freeze({
        kind: 'https-only' as const,
        equivalent: httpsOnly === authority.state && !value.startsWith('/'),
        accepted: false,
      }),
      Object.freeze({
        kind: 'unsafe-open' as const,
        equivalent: JSON.stringify(unsafeOpen.open) === JSON.stringify(authority.open),
        accepted: false,
      }),
      Object.freeze({
        kind: 'stale-result' as const,
        equivalent: applyMarkdownUrlValidation(authority, staleIdentity) !== null,
        accepted: false,
      }),
      Object.freeze({
        kind: 'duplicated-regex' as const,
        equivalent: regex === authority.state,
        accepted: false,
      }),
    ]),
  })
}
