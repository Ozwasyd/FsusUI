const normalizeModuleId = (id) => id.replaceAll('\\', '/')

const sanitizeChunkName = (name) =>
  name
    .replaceAll(/^@/g, '')
    .replaceAll(/[\\/]/g, '-')
    .replaceAll(/[^a-zA-Z0-9-_]/g, '')

const resolveScopedPackageChunk = (id) => {
  const pkgMatch = id.match(/\/node_modules\/(@[^/]+\/[^/]+|[^/]+)/)
  if (!pkgMatch) return undefined

  const packageName = pkgMatch[1]
  if (packageName === '@ozwasyd/element-plus') return undefined
  if (packageName === 'lodash-unified') return undefined
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

  const workspaceSupport = id.match(new RegExp(`/packages/${supportPattern}/`))
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

export const resolveFsusViteManualChunk = (moduleId) => {
  const id = normalizeModuleId(moduleId)

  if (
    id.includes('/packages/wasm/')
    || id.includes('/node_modules/@element-plus/wasm/')
    || id.includes('/node_modules/@ozwasyd/element-plus/es/wasm/')
    || id.includes('/ep_wasm')
    || id.includes('/markdown_basic')
    || id.includes('/markdown_simd')
  ) {
    return 'fsus-wasm'
  }

  if (
    id.includes('/packages/components/markdown-renderer/')
    || id.includes('/node_modules/@element-plus/components/markdown-renderer/')
    || id.includes('/node_modules/@ozwasyd/element-plus/es/components/markdown-renderer/')
    || id.includes('markdown-renderer.worker')
  ) {
    return 'fsus-markdown'
  }

  if (
    id.includes('/packages/icons-vue/')
    || id.includes('/node_modules/@element-plus/icons-vue/')
    || id.includes('/node_modules/@ozwasyd/element-plus/es/icons-vue/')
  ) {
    return 'fsus-icons'
  }

  const componentChunk = resolveElementPlusComponentChunk(id)
  if (componentChunk) return componentChunk

  const supportChunk = resolveElementPlusSupportChunk(id)
  if (supportChunk) return supportChunk

  if (id.includes('/node_modules/vue/') || id.includes('/node_modules/@vue/')) {
    return 'vue-vendor'
  }

  if (id.includes('/node_modules/')) {
    return resolveScopedPackageChunk(id)
  }

  return undefined
}

export const createFsusViteManualChunks = () => resolveFsusViteManualChunk
