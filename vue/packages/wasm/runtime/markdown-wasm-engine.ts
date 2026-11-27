import type { MarkdownRuntimeErrorCode } from '../markdown-runtime-error'
import { loadEmscriptenModule } from './emscripten'
import { resolveMarkdownAsset, type MarkdownAssetKind } from './assets'
import { decodeUtf8, encodeUtf8 } from './utf8'
import {
  MARKDOWN_RENDER_PARSER,
  MARKDOWN_RENDERER_VERSION,
  normalizeMarkdownSource,
  resolveMarkdownSourceIdentity,
  type MarkdownRenderChunk,
  type MarkdownRenderFeature,
  type MarkdownRenderMetadata,
  type MarkdownRenderPlaceholder,
  type MarkdownRenderRequest,
  type MarkdownRenderTimings,
  type MarkdownSafeHtml,
  type MarkdownSafeRenderResult,
} from '../markdown'
import {
  authorizeMarkdownRuntimeResult,
  createMarkdownRuntimeError,
  type MarkdownRuntimeChunkResult,
  type MarkdownRuntimeHtmlResult,
  type MarkdownRuntimeKind,
  type MarkdownRuntimeRenderResult,
  type MarkdownRuntimeSummaryResult,
} from './markdown-result-authority'

type MarkdownModule = {
  HEAPU8: Uint8Array
  memory?: WebAssembly.Memory
  _markdown_render?: (
    ptr: number,
    len: number,
    allowLatex: number,
    allowMermaid: number,
    argumentCount: number,
  ) => number
  _markdown_render_profile?: (
    ptr: number,
    len: number,
    allowLatex: number,
    allowMermaid: number,
    payloadMode: number,
    argumentCount: number,
  ) => number
  _markdown_get_last_html_ptr?: () => number
  _markdown_get_last_html_len?: () => number
  _markdown_get_last_error_ptr?: () => number
  _markdown_get_last_error_len?: () => number
  _markdown_get_last_error_code?: () => number
  _markdown_get_last_features_ptr?: () => number
  _markdown_get_last_features_len?: () => number
  _markdown_get_last_placeholders_ptr?: () => number
  _markdown_get_last_placeholders_len?: () => number
  _markdown_get_last_chunks_ptr?: () => number
  _markdown_get_last_chunks_len?: () => number
  _markdown_get_last_renderer_version_ptr?: () => number
  _markdown_get_last_renderer_version_len?: () => number
  _markdown_get_last_metadata_ptr?: () => number
  _markdown_get_last_metadata_len?: () => number
  _markdown_alloc_buffer?: (size: number) => number
  _markdown_free_buffer?: (ptr: number) => void
}

type MarkdownModuleFactoryResult = MarkdownModule & Record<string, unknown>

let runtimeModule: MarkdownModuleFactoryResult | null = null
let runtimePromise: Promise<{
  module: MarkdownModuleFactoryResult | null
  engine: MarkdownRuntimeKind
}> | null = null
let runtimeEngine: MarkdownRuntimeKind = 'UNKNOWN'

function supportsSimdMarkdown(): boolean {
  try {
    const simdProbe = new Uint8Array([
      0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10,
      1, 8, 0, 65, 0, 253, 15, 253, 98, 11,
    ])
    return WebAssembly.validate(simdProbe)
  } catch {
    return false
  }
}

function resolveMarkdownAssetKind(): MarkdownAssetKind {
  return supportsSimdMarkdown() ? 'simd' : 'basic'
}

function pickExport<T>(raw: Record<string, unknown>, ...names: string[]): T {
  for (const name of names) {
    const direct = raw[name]
    if (direct) {
      return direct as T
    }

    const underscored = raw[`_${name}`]
    if (underscored) {
      return underscored as T
    }
  }

  throw createMarkdownRuntimeError(
    'invariant',
    `wasm_export_missing:${names[0] ?? 'unknown'}`,
  )
}

function mapMarkdownErrorCode(
  code: number,
  fallback: string,
): MarkdownRuntimeErrorCode {
  switch (code) {
    case 1:
      return 'protocol'
    default:
      if (fallback.includes('source') || fallback.includes('input')) {
        return 'protocol'
      }
      return 'infra'
  }
}

export async function initMarkdownRuntimeModule(): Promise<{
  module: MarkdownModuleFactoryResult | null
  engine: MarkdownRuntimeKind
}> {
  if (runtimeModule) {
    return { module: runtimeModule, engine: runtimeEngine }
  }

  if (!runtimePromise) {
    runtimePromise = (async () => {
      const assetKind = resolveMarkdownAssetKind()
      const engine: MarkdownRuntimeKind =
        assetKind === 'simd' ? 'SIMD-128' : 'SCALAR-BASIC'
      const asset = resolveMarkdownAsset(assetKind)
      const module = await loadEmscriptenModule<MarkdownModuleFactoryResult>(
        asset.moduleUrl,
        'createMarkdownModule',
        asset.wasmUrl,
      )

      if (!module) {
        return { module: null, engine }
      }

      const raw = module as unknown as Record<string, unknown>
      runtimeModule = module
      const bindExport = (suffix: string, fallback?: string) => {
        const primary = `markdown_${suffix}`
        runtimeModule![`_${primary}`] = fallback
          ? pickExport(raw, primary, fallback)
          : pickExport(raw, primary)
      }
      bindExport('render', 'render_markdown')
      bindExport('render_profile')
      for (const name of [
        'alloc_buffer',
        'free_buffer',
        'get_last_error_code',
      ]) {
        bindExport(name, name)
      }
      for (const field of [
        'html',
        'error',
        'features',
        'placeholders',
        'chunks',
        'renderer_version',
        'metadata',
      ]) {
        for (const kind of ['ptr', 'len']) {
          const getter = `get_last_${field}_${kind}`
          bindExport(getter, getter)
        }
      }
      runtimeEngine = engine

      return { module: runtimeModule, engine }
    })().catch(() => ({
      module: null,
      engine: 'UNKNOWN' as MarkdownRuntimeKind,
    }))
  }

  return await runtimePromise
}

function readCString(
  memory: WebAssembly.Memory,
  ptr: number,
  len: number,
): string {
  if (ptr <= 0 || len <= 0) {
    return ''
  }

  const view = new Uint8Array(memory.buffer, ptr, len)
  return decodeUtf8(view)
}

function resolveModuleMemory(
  module: MarkdownModuleFactoryResult,
): WebAssembly.Memory | null {
  if (module.memory) {
    return module.memory
  }

  const heapBuffer = module.HEAPU8?.buffer
  if (!heapBuffer) {
    return null
  }

  return { buffer: heapBuffer } as WebAssembly.Memory
}

function parseStructuredTextFallback(source: string): unknown {
  let offset = 0
  const skipWhitespace = () => {
    while (/\s/u.test(source[offset] ?? '')) offset += 1
  }
  const parseValue = (): unknown => {
    skipWhitespace()
    const char = source[offset]
    if (char === '"') return parseString()
    if (char === '[') return parseArray()
    if (char === '{') return parseObject()
    if (source.startsWith('true', offset)) {
      offset += 4
      return true
    }
    if (source.startsWith('false', offset)) {
      offset += 5
      return false
    }
    if (source.startsWith('null', offset)) {
      offset += 4
      return null
    }
    return parseNumber()
  }
  const parseString = (): string => {
    offset += 1
    let value = ''
    while (offset < source.length) {
      const char = source[offset++]
      if (char === '"') return value
      if (char !== '\\') {
        value += char
        continue
      }
      const escaped = source[offset++]
      if (escaped === 'n') value += '\n'
      else if (escaped === 'r') value += '\r'
      else if (escaped === 't') value += '\t'
      else if (escaped === 'b') value += '\b'
      else if (escaped === 'f') value += '\f'
      else if (escaped === 'u') {
        value += String.fromCharCode(
          Number.parseInt(source.slice(offset, offset + 4), 16),
        )
        offset += 4
      } else {
        value += escaped
      }
    }
    throw createMarkdownRuntimeError('protocol', 'structured_string_unclosed')
  }
  const parseArray = (): unknown[] => {
    offset += 1
    const values: unknown[] = []
    skipWhitespace()
    if (source[offset] === ']') {
      offset += 1
      return values
    }
    while (offset < source.length) {
      values.push(parseValue())
      skipWhitespace()
      if (source[offset] === ']') {
        offset += 1
        return values
      }
      if (source[offset++] !== ',') {
        throw createMarkdownRuntimeError(
          'protocol',
          'structured_array_separator_invalid',
        )
      }
    }
    throw createMarkdownRuntimeError('protocol', 'structured_array_unclosed')
  }
  const parseObject = (): Record<string, unknown> => {
    offset += 1
    const value: Record<string, unknown> = {}
    skipWhitespace()
    if (source[offset] === '}') {
      offset += 1
      return value
    }
    while (offset < source.length) {
      const key = parseString()
      skipWhitespace()
      if (source[offset++] !== ':') {
        throw createMarkdownRuntimeError(
          'protocol',
          'structured_object_separator_invalid',
        )
      }
      value[key] = parseValue()
      skipWhitespace()
      if (source[offset] === '}') {
        offset += 1
        return value
      }
      if (source[offset++] !== ',') {
        throw createMarkdownRuntimeError(
          'protocol',
          'structured_object_entry_invalid',
        )
      }
      skipWhitespace()
    }
    throw createMarkdownRuntimeError('protocol', 'structured_object_unclosed')
  }
  const parseNumber = (): number => {
    const start = offset
    while (/[-+0-9.eE]/u.test(source[offset] ?? '')) offset += 1
    const value = Number(source.slice(start, offset))
    if (!Number.isFinite(value)) {
      throw createMarkdownRuntimeError('protocol', 'structured_number_invalid')
    }
    return value
  }
  const value = parseValue()
  skipWhitespace()
  if (offset !== source.length) {
    throw createMarkdownRuntimeError('protocol', 'structured_trailing_data')
  }
  return value
}

function parseStructuredText(raw: string): unknown {
  const source = raw.trim()
  if (!source) return null

  try {
    return JSON.parse(source)
  } catch {
    return parseStructuredTextFallback(source)
  }
}

function readStructured<T>(
  memory: WebAssembly.Memory,
  ptr: number,
  len: number,
  fallback: T,
): T {
  const raw = readCString(memory, ptr, len)
  if (!raw) {
    return fallback
  }

  try {
    return parseStructuredText(raw) as T
  } catch {
    return fallback
  }
}

const now = () => {
  if (
    typeof performance !== 'undefined' &&
    typeof performance.now === 'function'
  ) {
    return performance.now()
  }
  return Date.now()
}

const roundMs = (value: number) => Math.round(value * 100) / 100

type MutableMarkdownRenderTimings = {
  -readonly [TKey in keyof MarkdownRenderTimings]: MarkdownRenderTimings[TKey]
}

const createTimings = (): MutableMarkdownRenderTimings => ({
  initMs: 0,
  encodeMs: 0,
  wasmRenderMs: 0,
  readHtmlMs: 0,
  readFeaturesMs: 0,
  readPlaceholdersMs: 0,
  readMetadataMs: 0,
  totalMs: 0,
})

const finalizeTimings = (
  timings: MutableMarkdownRenderTimings,
  startedAt: number,
): MarkdownRenderTimings => {
  timings.totalMs = roundMs(now() - startedAt)
  timings.initMs = roundMs(timings.initMs)
  timings.encodeMs = roundMs(timings.encodeMs)
  timings.wasmRenderMs = roundMs(timings.wasmRenderMs)
  timings.readHtmlMs = roundMs(timings.readHtmlMs)
  timings.readFeaturesMs = roundMs(timings.readFeaturesMs)
  timings.readPlaceholdersMs = roundMs(timings.readPlaceholdersMs)
  timings.readMetadataMs = roundMs(timings.readMetadataMs)
  return timings
}

type MarkdownResultByMode = {
  'html-only': MarkdownRuntimeHtmlResult
  summary: MarkdownRuntimeSummaryResult
  'full-result': MarkdownRuntimeRenderResult
  chunks: MarkdownRuntimeChunkResult
}

type MarkdownPayloadMode = keyof MarkdownResultByMode
const payloadModeToWasmMode = (mode: MarkdownPayloadMode) => {
  if (mode === 'chunks') return 3
  if (mode === 'html-only') return 2
  if (mode === 'summary') return 1
  return 0
}

const buildDefaultMetadata = (
  payload: MarkdownRenderRequest,
  source: string,
  features: readonly MarkdownRenderFeature[],
  placeholderCount: number,
  rendererVersion: string,
): MarkdownRenderMetadata => ({
  mode: payload.mode ?? 'article',
  baseUrl: payload.baseUrl ?? null,
  allowLatex: payload.allowLatex !== false,
  allowMermaid: payload.allowMermaid !== false,
  sourceLength: source.length,
  featureCount: features.length,
  placeholderCount,
  rendererVersion,
})

export function renderMarkdownPayloadWithRuntime<
  Mode extends MarkdownPayloadMode,
>(
  request: MarkdownRenderRequest | string,
  payloadMode: Mode,
): Promise<MarkdownResultByMode[Mode] | null>
export async function renderMarkdownPayloadWithRuntime(
  request: MarkdownRenderRequest | string,
  payloadMode: MarkdownPayloadMode,
): Promise<MarkdownResultByMode[MarkdownPayloadMode] | null> {
  const startedAt = now()
  const timings = createTimings()
  const payload = typeof request === 'string' ? { source: request } : request
  const source = normalizeMarkdownSource(payload.source)

  const initStartedAt = now()
  const { module, engine } = await initMarkdownRuntimeModule()
  timings.initMs = now() - initStartedAt

  if (!module) {
    return null
  }

  const alloc = module._markdown_alloc_buffer
  const free = module._markdown_free_buffer
  const render = module._markdown_render_profile ?? module._markdown_render
  const getHtmlPtr = module._markdown_get_last_html_ptr
  const getHtmlLen = module._markdown_get_last_html_len
  const getErrorPtr = module._markdown_get_last_error_ptr
  const getErrorLen = module._markdown_get_last_error_len
  const getErrorCode = module._markdown_get_last_error_code
  const getFeaturesPtr = module._markdown_get_last_features_ptr
  const getFeaturesLen = module._markdown_get_last_features_len
  const getPlaceholdersPtr = module._markdown_get_last_placeholders_ptr
  const getPlaceholdersLen = module._markdown_get_last_placeholders_len
  const getChunksPtr = module._markdown_get_last_chunks_ptr
  const getChunksLen = module._markdown_get_last_chunks_len
  const getRendererVersionPtr = module._markdown_get_last_renderer_version_ptr
  const getRendererVersionLen = module._markdown_get_last_renderer_version_len
  const getMetadataPtr = module._markdown_get_last_metadata_ptr
  const getMetadataLen = module._markdown_get_last_metadata_len

  if (
    !alloc ||
    !free ||
    !render ||
    !getHtmlPtr ||
    !getHtmlLen ||
    !getErrorPtr ||
    !getErrorLen ||
    !getErrorCode ||
    !getFeaturesPtr ||
    !getFeaturesLen ||
    !getPlaceholdersPtr ||
    !getPlaceholdersLen ||
    !getChunksPtr ||
    !getChunksLen ||
    !getRendererVersionPtr ||
    !getRendererVersionLen ||
    !getMetadataPtr ||
    !getMetadataLen
  ) {
    return null
  }

  const encodeStartedAt = now()
  const bytes = encodeUtf8(source)
  const ptr = alloc(bytes.byteLength)
  if (ptr <= 0) {
    return null
  }

  try {
    module.HEAPU8.set(bytes, ptr)
    timings.encodeMs = now() - encodeStartedAt

    const renderStartedAt = now()
    const ok =
      render === module._markdown_render_profile
        ? module._markdown_render_profile(
            ptr,
            bytes.byteLength,
            payload.allowLatex === false ? 0 : 1,
            payload.allowMermaid === false ? 0 : 1,
            payloadModeToWasmMode(payloadMode),
            5,
          )
        : module._markdown_render?.(
            ptr,
            bytes.byteLength,
            payload.allowLatex === false ? 0 : 1,
            payload.allowMermaid === false ? 0 : 1,
            4,
          )
    timings.wasmRenderMs = now() - renderStartedAt

    const memory = resolveModuleMemory(module)
    if (!memory) {
      return null
    }
    if (ok !== 1) {
      const error = readCString(memory, getErrorPtr(), getErrorLen())
      if (error) {
        throw createMarkdownRuntimeError(
          mapMarkdownErrorCode(getErrorCode(), error),
          `markdown_wasm_render_failed:${error}`,
        )
      }
      return null
    }

    const htmlStartedAt = now()
    const html = readCString(memory, getHtmlPtr(), getHtmlLen())
    timings.readHtmlMs = now() - htmlStartedAt

    const metadataStartedAt = now()
    const rendererVersion =
      readCString(memory, getRendererVersionPtr(), getRendererVersionLen()) ||
      MARKDOWN_RENDERER_VERSION
    timings.readMetadataMs = now() - metadataStartedAt

    const renderResultBase = () => ({
      html: html as MarkdownSafeHtml,
      parser: MARKDOWN_RENDER_PARSER,
      rawSource: payload.source,
      normalizedSource: source,
      sourceIdentity: resolveMarkdownSourceIdentity(payload),
    })
    if (payloadMode === 'html-only') {
      return authorizeMarkdownRuntimeResult({
        ...renderResultBase(),
        engine,
        rendererVersion,
        timings: finalizeTimings(timings, startedAt),
      })
    }

    const featuresStartedAt = now()
    const features = readStructured<MarkdownSafeRenderResult['features']>(
      memory,
      getFeaturesPtr(),
      getFeaturesLen(),
      [],
    )
    timings.readFeaturesMs = now() - featuresStartedAt

    const metadataReadStartedAt = now()
    const metadata = readStructured<MarkdownRenderMetadata>(
      memory,
      getMetadataPtr(),
      getMetadataLen(),
      buildDefaultMetadata(payload, source, features, 0, rendererVersion),
    )
    timings.readMetadataMs += now() - metadataReadStartedAt

    if (payloadMode === 'summary') {
      return authorizeMarkdownRuntimeResult({
        ...renderResultBase(),
        engine,
        features,
        metadata,
        rendererVersion,
        timings: finalizeTimings(timings, startedAt),
      })
    }

    const placeholdersStartedAt = now()
    const placeholders = readStructured<MarkdownRenderPlaceholder[]>(
      memory,
      getPlaceholdersPtr(),
      getPlaceholdersLen(),
      [],
    )
    timings.readPlaceholdersMs = now() - placeholdersStartedAt

    const safeResult = {
      ...renderResultBase(),
      features,
      placeholders,
      rendererVersion,
      metadata,
    }
    if (payloadMode === 'chunks') {
      const chunks = readStructured<MarkdownRenderChunk[]>(
        memory,
        getChunksPtr(),
        getChunksLen(),
        [],
      )
      return authorizeMarkdownRuntimeResult({
        ...safeResult,
        chunks,
        engine,
        timings: finalizeTimings(timings, startedAt),
      })
    }

    return authorizeMarkdownRuntimeResult({
      ...safeResult,
      engine,
      timings: finalizeTimings(timings, startedAt),
    })
  } finally {
    free(ptr)
  }
}
