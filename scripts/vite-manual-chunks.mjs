const normalizeModuleId = (id) => id.replaceAll('\\', '/')

const sanitizeChunkName = (name) =>
  name
    .replaceAll(/^@/g, '')
    .replaceAll(/[\\/]/g, '-')
    .replaceAll(/[^a-zA-Z0-9-_]/g, '')

const emptyChunkPronePackages = new Set([
  'd3-chord',
  'd3-contour',
  'd3-delaunay',
  'd3-drag',
  'd3-dsv',
  'd3-fetch',
  'd3-force',
  'd3-geo',
  'd3-hierarchy',
  'd3-polygon',
  'd3-quadtree',
  'd3-random',
  'delaunator',
  'robust-predicates',
])

const resolveMermaidRuntimeChunk = (id) => {
  const mermaidChunk = id.match(
    /\/node_modules\/mermaid\/dist\/chunks\/mermaid\.(?:core|esm\.min)\/([^/]+)\.mjs$/,
  )
  if (mermaidChunk) return `vendor-mermaid-${sanitizeChunkName(mermaidChunk[1])}`

  if (
    id.includes('/node_modules/mermaid/dist/mermaid.core.mjs') ||
    id.includes('/node_modules/mermaid/dist/mermaid.esm.min.mjs')
  ) {
    return 'vendor-mermaid-core'
  }

  const parserChunk = id.match(
    /\/node_modules\/@mermaid-js\/parser\/dist\/chunks\/mermaid-parser\.core\/([^/]+)\.mjs$/,
  )
  if (parserChunk) {
    return `vendor-mermaid-parser-${sanitizeChunkName(parserChunk[1])}`
  }

  if (
    id.includes('/node_modules/@mermaid-js/parser/dist/mermaid-parser.core.mjs')
  ) {
    return 'vendor-mermaid-parser-core'
  }

  return undefined
}

const resolveShikiRuntimeChunk = (id) => {
  const language = id.match(
    /\/node_modules\/@shikijs\/langs\/dist\/([^/]+)\.mjs$/,
  )
  if (language) {
    const languageName = language[1] === 'bash' ? 'shellscript' : language[1]
    return `vendor-shiki-lang-${sanitizeChunkName(languageName)}`
  }
  return undefined
}

const resolveScopedPackageChunk = (id) => {
  const pkgMatch = id.match(/\/node_modules\/(@[^/]+\/[^/]+|[^/]+)/)
  if (!pkgMatch) return undefined

  const packageName = pkgMatch[1]
  if (packageName === '@ozwasyd/fsusui') return undefined
  if (packageName === 'mermaid' || packageName === '@mermaid-js/parser') {
    return undefined
  }
  if (emptyChunkPronePackages.has(packageName)) return undefined

  return `vendor-${sanitizeChunkName(packageName)}`
}

const wasmRootRe =
  '(?:vue/packages/wasm|node_modules/@fsusui/wasm|node_modules/@ozwasyd/fsusui/dist/wasm)'

const isWasmModule = (id, name) =>
  new RegExp(`/${wasmRootRe}/${name}\\.(?:[cm]?[jt]sx?)$`, 'u').test(id)

export const resolveFsusViteManualChunk = (
  moduleId,
  { profile = 'full' } = {},
) => {
  const id = normalizeModuleId(moduleId)
  const consumerProfile = profile === 'consumer'

  if (
    /\/(?:vue\/packages\/markdown\/src|node_modules\/@fsusui\/markdown\/src)\/markdown-renderer\/src\/markdown-fragment-reveal\.(?:[cm]?[jt]sx?)$/u.test(
      id,
    )
  ) {
    return 'fsus-markdown-fragment-reveal'
  }

  if (isWasmModule(id, 'markdown-heavy-runtime-loaders')) {
    return 'fsus-markdown-heavy-loaders'
  }
  if (isWasmModule(id, 'markdown-feature-output-gateway')) {
    return 'fsus-markdown-feature-gateway'
  }
  if (isWasmModule(id, 'markdown-heavy-feature-isolated-client')) {
    return 'fsus-markdown-heavy-isolated-client'
  }
  if (isWasmModule(id, 'markdown-heavy-feature-resource')) {
    return 'fsus-markdown-heavy-resource'
  }
  if (
    isWasmModule(
      id,
      '(?:markdown-heavy-feature-isolated-lazy|markdown-heavy-feature-frame-scheduler)',
    )
  ) {
    return 'fsus-markdown-heavy-isolated-adapter'
  }
  if (isWasmModule(id, 'markdown-heavy-feature-identity')) {
    return 'fsus-markdown-heavy-identity'
  }

  if (
    !consumerProfile &&
    id.includes('/vue/packages/') &&
    !id.includes('/vue/packages/demo-app/')
  ) {
    return 'fsus-ui'
  }

  if (
    id.includes('/vue/packages/wasm/') ||
    id.includes('/node_modules/@fsusui/wasm/') ||
    id.includes('/ep_wasm') ||
    id.includes('/markdown_basic') ||
    id.includes('/markdown_simd')
  ) {
    return 'fsus-wasm'
  }

  if (
    id.includes('/vue/packages/markdown/') ||
    id.includes('/node_modules/@fsusui/markdown/') ||
    id.includes('markdown-renderer.worker')
  ) {
    return 'fsus-markdown'
  }

  if (
    id.includes('/vue/packages/icons/') ||
    id.includes('/node_modules/@fsusui/icons/')
  ) {
    return 'fsus-icons'
  }

  if (id.includes('/node_modules/vue/') || id.includes('/node_modules/@vue/')) {
    return 'vue-vendor'
  }

  if (!consumerProfile || !id.includes('/node_modules/@mermaid-js/parser/')) {
    const mermaidChunk = resolveMermaidRuntimeChunk(id)
    if (mermaidChunk) return mermaidChunk
  }

  if (!consumerProfile) {
    const shikiChunk = resolveShikiRuntimeChunk(id)
    if (shikiChunk) return shikiChunk
  }

  if (!consumerProfile && id.includes('/node_modules/')) {
    return resolveScopedPackageChunk(id)
  }

  return undefined
}

export const createFsusViteManualChunks = (options) => (moduleId) =>
  resolveFsusViteManualChunk(moduleId, options)
