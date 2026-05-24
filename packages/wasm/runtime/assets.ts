export type MarkdownAssetKind = 'simd' | 'basic'

const isPackagedDistRuntime = () => {
  try {
    const pathname = new URL(import.meta.url).pathname.replace(/\\/g, '/')
    return /\/dist\/[^/]+\.(?:mjs|js|cjs)$/.test(pathname)
  } catch {
    return false
  }
}

const resolveMarkdownRuntimeUrl = (fileName: string) => {
  const prefix = isPackagedDistRuntime() ? './' : '../dist/'
  return new URL(`${prefix}${fileName}`, import.meta.url).href
}

export function resolveMarkdownAsset(kind: MarkdownAssetKind): {
  moduleUrl: string
  wasmUrl: string
} {
  const fileBase = kind === 'simd' ? 'markdown_simd' : 'markdown_basic'
  return {
    moduleUrl: resolveMarkdownRuntimeUrl(`${fileBase}.js`),
    wasmUrl: resolveMarkdownRuntimeUrl(`${fileBase}.wasm`),
  }
}
