import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

export interface MarkdownParserSyntaxNode {
  readonly kind: string
  readonly start: number
  readonly end: number
}

type SyntaxCollectExports = {
  memory: WebAssembly.Memory
  markdown_syntax_alloc: (size: number) => number
  markdown_syntax_free: (pointer: number) => void
  markdown_syntax_collect: (pointer: number, length: number) => number
  markdown_syntax_json_ptr: () => number
  markdown_syntax_json_len: () => number
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

const loadSyntaxCollectExports = (): SyntaxCollectExports => {
  if (cachedExports) {
    return cachedExports
  }
  const wasmPath = join(
    dirname(fileURLToPath(import.meta.url)),
    'markdown',
    'syntax-collect.wasm',
  )
  const module = new WebAssembly.Module(readFileSync(wasmPath))
  const instance = new WebAssembly.Instance(module, wasmImports)
  const exports = instance.exports as unknown as SyntaxCollectExports
  exports._initialize?.()
  cachedExports = exports
  return exports
}

const readWasmString = (exports: SyntaxCollectExports, pointer: number, length: number) =>
  new TextDecoder().decode(new Uint8Array(exports.memory.buffer, pointer, length))

export const collectMarkdownSyntaxNodesFromParser = (
  source: string,
): MarkdownParserSyntaxNode[] => {
  const exports = loadSyntaxCollectExports()
  const encoded = new TextEncoder().encode(source)
  const pointer = exports.markdown_syntax_alloc(encoded.byteLength || 1)
  if (pointer <= 0) {
    throw new Error('markdown syntax collector failed to allocate')
  }
  try {
    new Uint8Array(exports.memory.buffer, pointer, encoded.byteLength).set(encoded)
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
