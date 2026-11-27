import { readFileSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { TextDecoder } from 'node:util'

export function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

export function pickExport(raw, name) {
  const direct = raw[name]
  if (direct) {
    return direct
  }

  const underscored = raw[`_${name}`]
  if (underscored) {
    return underscored
  }

  throw new Error(`wasm_export_missing:${name}`)
}

export function createMarkdownWasmCheck(checkName) {
  function readCString(module, ptr, len) {
    if (ptr <= 0 || len <= 0) {
      return ''
    }

    const memory =
      module.memory ?? (module.HEAPU8 ? { buffer: module.HEAPU8.buffer } : null)
    assert(memory, `[${checkName}] module memory unavailable`)
    return new TextDecoder().decode(new Uint8Array(memory.buffer, ptr, len))
  }

  async function loadMarkdownModule(kind) {
    const fileBase = kind === 'simd' ? 'markdown_simd' : 'markdown_basic'
    const cwd = process.cwd().replace(/\\/g, '/').replace(/\/+$/, '')
    const assetBase = `${cwd}/vue/packages/wasm/dist/${fileBase}`
    const moduleUrl = pathToFileURL(`${assetBase}.js`).href
    const wasmUrl = pathToFileURL(`${assetBase}.wasm`).href
    const wasmBinary = readFileSync(fileURLToPath(wasmUrl))
    const moduleRef = await import(moduleUrl)
    const factory = moduleRef.default ?? moduleRef.createMarkdownModule
    assert(
      typeof factory === 'function',
      `[${checkName}] missing factory: ${kind}`,
    )

    // Emscripten's Node setup may still reference __dirname in mixed ESM/CJS
    // output. The preloaded binary avoids filesystem lookup in the factory.
    const savedDirname = globalThis.__dirname
    globalThis.__dirname = fileURLToPath(moduleUrl).replace(/\/[^/]+$/, '')
    try {
      return await factory({ wasmBinary, print: () => {}, printErr: () => {} })
    } finally {
      if (savedDirname === undefined) {
        delete globalThis.__dirname
      } else {
        globalThis.__dirname = savedDirname
      }
    }
  }

  return { loadMarkdownModule, readCString }
}
