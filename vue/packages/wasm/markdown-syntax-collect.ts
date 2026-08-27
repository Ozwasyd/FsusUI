import { readNodeWasmBinary } from './runtime/emscripten'
import { markdownSyntaxCollectWasmBase64 } from './markdown/syntax-collect.generated'

export interface MarkdownParserSyntaxRange {
  readonly start: number
  readonly end: number
}

export interface MarkdownParserSyntaxNode {
  readonly kind: string
  readonly start: number
  readonly end: number
  readonly status: 'valid' | 'malformed'
  readonly diagnosticCode: string | null
  readonly contentRanges: readonly MarkdownParserSyntaxRange[]
  readonly markerRanges: readonly MarkdownParserSyntaxRange[]
  readonly parentStart?: number
  readonly parentEnd?: number
  readonly children?: readonly MarkdownParserSyntaxRange[]
}

type SyntaxCollectExports = {
  memory: WebAssembly.Memory
  markdown_syntax_alloc: (size: number) => number
  markdown_syntax_free: (pointer: number) => void
  markdown_syntax_collect: (pointer: number, length: number) => number
  markdown_syntax_json_ptr: () => number
  markdown_syntax_json_len: () => number
  markdown_syntax_kinds_json_ptr: () => number
  markdown_syntax_kinds_json_len: () => number
  _initialize?: () => void
}

const wasmImports = {
  env: {
    emscripten_notify_memory_growth: () => undefined,
  },
  wasi_snapshot_preview1: {
    fd_close: () => 0,
    fd_seek: () => 0,
    fd_write: () => 0,
  },
}

let cachedExports: SyntaxCollectExports | undefined

const decodeBase64 = (value: string): Uint8Array => {
  const alphabet =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
  const decodedLength =
    Math.floor((value.length * 3) / 4) -
    (value.endsWith('==') ? 2 : value.endsWith('=') ? 1 : 0)
  const output = new Uint8Array(decodedLength)
  let outputIndex = 0
  let chunk = 0
  let chunkLength = 0

  for (const character of value) {
    if (character === '=') break
    const digit = alphabet.indexOf(character)
    if (digit < 0) {
      throw new Error('markdown syntax collector embedded bytes are invalid')
    }
    chunk = (chunk << 6) | digit
    chunkLength += 6
    if (chunkLength >= 8) {
      chunkLength -= 8
      output[outputIndex] = (chunk >> chunkLength) & 0xff
      outputIndex += 1
    }
  }

  if (outputIndex !== decodedLength) {
    throw new Error('markdown syntax collector embedded bytes are incomplete')
  }
  return output
}

let cachedEmbeddedWasmBytes: Uint8Array | undefined

const isMissingNodeWasmBinary = (error: unknown): boolean =>
  typeof error === 'object' &&
  error !== null &&
  (error as { code?: unknown }).code === 'ENOENT'

const readSyntaxCollectWasmBytes = (wasmUrl: string): Uint8Array => {
  let nodeBytes: Uint8Array | undefined
  try {
    nodeBytes = readNodeWasmBinary(wasmUrl)
  } catch (error) {
    if (!isMissingNodeWasmBinary(error)) {
      throw error
    }
  }
  if (nodeBytes) {
    return nodeBytes
  }
  cachedEmbeddedWasmBytes ??= decodeBase64(markdownSyntaxCollectWasmBase64)
  return cachedEmbeddedWasmBytes
}

const loadSyntaxCollectExports = (): SyntaxCollectExports | null => {
  if (cachedExports) {
    return cachedExports
  }
  const moduleUrl = import.meta.url
  const wasmUrl = `${moduleUrl.slice(
    0,
    moduleUrl.lastIndexOf('/') + 1,
  )}markdown/syntax-collect.wasm`
  const wasmBytes = readSyntaxCollectWasmBytes(wasmUrl)
  const module = new WebAssembly.Module(wasmBytes as BufferSource)
  const instance = new WebAssembly.Instance(module, wasmImports)
  const exports = instance.exports as unknown as SyntaxCollectExports
  exports._initialize?.()
  cachedExports = exports
  return exports
}

const readWasmString = (
  exports: SyntaxCollectExports,
  pointer: number,
  length: number,
) =>
  new TextDecoder().decode(
    new Uint8Array(exports.memory.buffer, pointer, length),
  )

export const collectMarkdownSyntaxNodesFromParser = (
  source: string,
): MarkdownParserSyntaxNode[] => {
  const exports = loadSyntaxCollectExports()
  if (!exports) {
    return []
  }
  const encoded = new TextEncoder().encode(source)
  const pointer = exports.markdown_syntax_alloc(encoded.byteLength || 1)
  if (pointer <= 0) {
    throw new Error('markdown syntax collector failed to allocate')
  }
  try {
    new Uint8Array(exports.memory.buffer, pointer, encoded.byteLength).set(
      encoded,
    )
    const ok = exports.markdown_syntax_collect(pointer, encoded.byteLength)
    if (ok !== 1) {
      throw new Error('markdown syntax collector rejected the source')
    }
    const json = readWasmString(
      exports,
      exports.markdown_syntax_json_ptr(),
      exports.markdown_syntax_json_len(),
    )
    const parsed = JSON.parse(json) as MarkdownParserSyntaxNode[]
    if (!Array.isArray(parsed)) {
      throw new Error('markdown syntax collector returned a non-array payload')
    }
    return parsed
  } finally {
    exports.markdown_syntax_free(pointer)
  }
}

export const readMarkdownParserSyntaxKinds = (): readonly string[] => {
  const exports = loadSyntaxCollectExports()
  if (!exports) {
    return Object.freeze([])
  }
  const parsed = JSON.parse(
    readWasmString(
      exports,
      exports.markdown_syntax_kinds_json_ptr(),
      exports.markdown_syntax_kinds_json_len(),
    ),
  ) as unknown
  if (
    !Array.isArray(parsed) ||
    !parsed.every((kind) => typeof kind === 'string')
  ) {
    throw new Error(
      'markdown syntax collector returned invalid supported kinds',
    )
  }
  return Object.freeze(parsed)
}
