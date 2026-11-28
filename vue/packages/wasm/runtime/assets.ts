export type MarkdownAssetKind = 'simd' | 'basic'

export interface WasmAssetUrlPair {
  moduleUrl: string
  wasmUrl: string
}

const createEpWasmAsset = () =>
  ({
    moduleUrl: new URL('../dist/ep_wasm.mjs', import.meta.url).href,
    wasmUrl: new URL('../dist/ep_wasm.wasm', import.meta.url).href,
  }) as const satisfies WasmAssetUrlPair

const createMarkdownAsset = (kind: MarkdownAssetKind) => {
  const assets = {
    basic: {
      moduleUrl: new URL('../dist/markdown_basic.js', import.meta.url).href,
      wasmUrl: new URL('../dist/markdown_basic.wasm', import.meta.url).href,
    },
    simd: {
      moduleUrl: new URL('../dist/markdown_simd.js', import.meta.url).href,
      wasmUrl: new URL('../dist/markdown_simd.wasm', import.meta.url).href,
    },
  } as const satisfies Record<MarkdownAssetKind, WasmAssetUrlPair>
  return assets[kind]
}

let epWasmAsset: WasmAssetUrlPair | undefined
const markdownAssets: Partial<Record<MarkdownAssetKind, WasmAssetUrlPair>> = {}
const markdownAssetOverrides: Partial<Record<MarkdownAssetKind, WasmAssetUrlPair>> = {}

export function setMarkdownRuntimeAssetOverrides(
  overrides?: Partial<Record<MarkdownAssetKind, WasmAssetUrlPair>>,
): void {
  delete markdownAssetOverrides.basic
  delete markdownAssetOverrides.simd
  if (!overrides) return
  if (overrides.basic?.moduleUrl && overrides.basic?.wasmUrl) {
    markdownAssetOverrides.basic = { ...overrides.basic }
  }
  if (overrides.simd?.moduleUrl && overrides.simd?.wasmUrl) {
    markdownAssetOverrides.simd = { ...overrides.simd }
  }
}

export function resolveEpWasmAsset(): WasmAssetUrlPair {
  return (epWasmAsset ??= createEpWasmAsset())
}

export function resolveMarkdownAsset(
  kind: MarkdownAssetKind,
): WasmAssetUrlPair {
  return markdownAssetOverrides[kind] ?? (markdownAssets[kind] ??= createMarkdownAsset(kind))
}
