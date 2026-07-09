import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import { resolveEpWasmAsset, resolveMarkdownAsset } from '../runtime/assets'

describe('WASM asset resolver', () => {
  it('returns explicit asset URLs for ep_wasm and both Markdown runtimes', () => {
    expect(resolveEpWasmAsset()).toMatchObject({
      moduleUrl: expect.stringContaining('ep_wasm.mjs'),
      wasmUrl: expect.stringContaining('ep_wasm.wasm'),
    })

    expect(resolveMarkdownAsset('basic')).toMatchObject({
      moduleUrl: expect.stringContaining('markdown_basic.js'),
      wasmUrl: expect.stringContaining('markdown_basic.wasm'),
    })

    expect(resolveMarkdownAsset('simd')).toMatchObject({
      moduleUrl: expect.stringContaining('markdown_simd.js'),
      wasmUrl: expect.stringContaining('markdown_simd.wasm'),
    })
  })

  it('keeps source asset URL references static for Vite analysis', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'vue/packages/wasm/runtime/assets.ts'),
      'utf8',
    )

    expect(source).not.toMatch(/new URL\(`[^`]*\$\{/u)
    expect(source).not.toContain('resolveMarkdownRuntimeUrl')
    expect(source).toContain("new URL('../dist/ep_wasm.mjs', import.meta.url)")
    expect(source).toContain("new URL('../dist/ep_wasm.wasm', import.meta.url)")
    expect(source).toContain(
      "new URL('../dist/markdown_basic.js', import.meta.url)",
    )
    expect(source).toContain(
      "new URL('../dist/markdown_basic.wasm', import.meta.url)",
    )
    expect(source).toContain(
      "new URL('../dist/markdown_simd.js', import.meta.url)",
    )
    expect(source).toContain(
      "new URL('../dist/markdown_simd.wasm', import.meta.url)",
    )
  })
})
