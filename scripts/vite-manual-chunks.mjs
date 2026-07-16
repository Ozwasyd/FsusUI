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
  if (mermaidChunk) {
    return `vendor-mermaid-${sanitizeChunkName(mermaidChunk[1])}`
  }

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
  if (packageName === '@ozwasyd/element-plus') return undefined
  if (packageName === 'lodash-unified') return undefined
  if (packageName === 'mermaid' || packageName === '@mermaid-js/parser') {
    return undefined
  }
  if (emptyChunkPronePackages.has(packageName)) return undefined
  if (packageName === 'lodash' || packageName === 'lodash-es') {
    return 'vendor-lodash'
  }

  return `vendor-${sanitizeChunkName(packageName)}`
}

const resolveElementPlusComponentChunk = (id) => {
  const packageComponent = id.match(
    /\/node_modules\/@element-plus\/components\/([^/]+)\//,
  )
  if (packageComponent) {
    return `ep-${sanitizeChunkName(packageComponent[1])}`
  }

  const packageDistComponent = id.match(
    /\/node_modules\/@ozwasyd\/element-plus\/es\/components\/([^/]+)\//,
  )
  if (packageDistComponent) {
    return `ep-${sanitizeChunkName(packageDistComponent[1])}`
  }

  const workspaceComponent = id.match(/\/packages\/components\/([^/]+)\//)
  if (workspaceComponent) {
    return `ep-${sanitizeChunkName(workspaceComponent[1])}`
  }

  return undefined
}

const resolveElementPlusSupportChunk = (id) => {
  const supportPattern =
    '(constants|directives|hooks|locale|utils|render-pipeline)'

  const workspaceSupport = id.match(
    new RegExp(`/vue/packages/${supportPattern}/`),
  )
  if (workspaceSupport) {
    return `ep-${sanitizeChunkName(workspaceSupport[1])}`
  }

  const packageSupport = id.match(
    new RegExp(`/node_modules/@element-plus/${supportPattern}/`),
  )
  if (packageSupport) {
    return `ep-${sanitizeChunkName(packageSupport[1])}`
  }

  const packageDistSupport = id.match(
    new RegExp(
      `/node_modules/@ozwasyd/element-plus/es/${supportPattern}(?:/|\\.)`,
    ),
  )
  if (packageDistSupport) {
    return `ep-${sanitizeChunkName(packageDistSupport[1])}`
  }

  return undefined
}

export const resolveFsusViteManualChunk = (
  moduleId,
  { profile = 'full' } = {},
) => {
  const id = normalizeModuleId(moduleId)
  const consumerProfile = profile === 'consumer'

  if (
    id.includes('/vue/packages/wasm/') ||
    id.includes('/node_modules/@element-plus/wasm/') ||
    id.includes('/node_modules/@ozwasyd/element-plus/es/wasm/') ||
    id.includes('/ep_wasm') ||
    id.includes('/markdown_basic') ||
    id.includes('/markdown_simd')
  ) {
    return 'fsus-wasm'
  }

  if (
    id.includes('/vue/packages/components/markdown-renderer/') ||
    id.includes('/node_modules/@element-plus/components/markdown-renderer/') ||
    id.includes(
      '/node_modules/@ozwasyd/element-plus/es/components/markdown-renderer/',
    ) ||
    id.includes('markdown-renderer.worker')
  ) {
    return 'fsus-markdown'
  }

  if (
    id.includes('/vue/packages/icons-vue/') ||
    id.includes('/node_modules/@element-plus/icons-vue/') ||
    id.includes('/node_modules/@ozwasyd/element-plus/es/icons-vue/')
  ) {
    return 'fsus-icons'
  }

  if (!consumerProfile) {
    const componentChunk = resolveElementPlusComponentChunk(id)
    if (componentChunk) return componentChunk

    const supportChunk = resolveElementPlusSupportChunk(id)
    if (supportChunk) return supportChunk
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
