export type FsusRenderPipelineComponentRole =
  | 'sync-monitored'
  | 'chunk-adapter'
  | 'virtual-list'
  | 'virtual-grid'
  | 'viewport-provider'
  | 'service'
  | 'directive'
  | 'inherited'

export type FsusRenderPipelineComponentEstimate = {
  htmlBytes?: number
  nodes?: number
  items?: number
}

export type FsusRenderPipelineComponentPolicy = {
  componentName: string
  role: FsusRenderPipelineComponentRole
  adapterId?: string
  budgeted?: boolean
  estimate?: FsusRenderPipelineComponentEstimate
  inherits?: string
}

const virtualListComponents = new Set([
  'DynamicSizeList',
  'ElDynamicSizeList',
  'ElFixedSizeList',
  'FixedSizeList',
])

const virtualGridComponents = new Set([
  'DynamicSizeGrid',
  'ElDynamicSizeGrid',
  'ElFixedSizeGrid',
  'FixedSizeGrid',
])

const inheritedVirtualComponents = new Map([
  ['ElSelectV2', 'ElFixedSizeList'],
  ['ElTableV2', 'ElFixedSizeGrid'],
  ['ElTreeV2', 'ElFixedSizeList'],
])

const viewportProviderComponents = new Set(['ElScrollbar'])

const chunkAdapterComponents = new Map([
  ['ElMarkdownRenderer', 'markdown-renderer'],
])

const serviceComponents = new Set([
  'ElLoading',
  'ElMessage',
  'ElMessageBox',
  'ElNotification',
])

const directiveComponents = new Set(['ElInfiniteScroll', 'ElPopoverDirective'])

const componentPolicies = new Map<string, FsusRenderPipelineComponentPolicy>()
const installNameComponentAliases = new Map([
  ['$message', 'ElMessage'],
  ['$notify', 'ElNotification'],
])

const normalizeComponentName = (name: string) => name.trim()

const pascalize = (name: string) =>
  name
    .replace(/^\$/, '')
    .split(/[-_:]/g)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join('')

export const resolveFsusInstallComponentName = (
  name: string,
  suffix = '',
) => {
  const normalized = normalizeComponentName(name)
  const aliased = installNameComponentAliases.get(normalized)
  if (aliased) return aliased
  if (normalized.startsWith('El')) return normalized
  return `El${pascalize(normalized)}${suffix}`
}

export const getFsusComponentName = (component: unknown) => {
  const candidate = component as {
    __fsusRenderPipelineComponentName?: unknown
    name?: unknown
    __name?: unknown
    install?: { name?: unknown }
  }

  if (typeof candidate.__fsusRenderPipelineComponentName === 'string') {
    return candidate.__fsusRenderPipelineComponentName
  }
  if (typeof candidate.name === 'string') return candidate.name
  if (typeof candidate.__name === 'string') return candidate.__name
  if (typeof candidate.install?.name === 'string') return candidate.install.name
  return null
}

export const createFsusRenderPipelineComponentPolicy = (
  componentName: string,
): FsusRenderPipelineComponentPolicy => {
  if (chunkAdapterComponents.has(componentName)) {
    return {
      adapterId: chunkAdapterComponents.get(componentName),
      budgeted: true,
      componentName,
      estimate: { htmlBytes: 128_000, nodes: 1_500 },
      role: 'chunk-adapter',
    }
  }

  if (virtualListComponents.has(componentName)) {
    return {
      adapterId: 'virtual-list',
      budgeted: true,
      componentName,
      estimate: { items: 500 },
      role: 'virtual-list',
    }
  }

  if (virtualGridComponents.has(componentName)) {
    return {
      adapterId: 'virtual-grid',
      budgeted: true,
      componentName,
      estimate: { items: 500 },
      role: 'virtual-grid',
    }
  }

  const inherited = inheritedVirtualComponents.get(componentName)
  if (inherited) {
    return {
      budgeted: true,
      componentName,
      estimate: { items: 500 },
      inherits: inherited,
      role: 'inherited',
    }
  }

  if (viewportProviderComponents.has(componentName)) {
    return {
      budgeted: false,
      componentName,
      estimate: { nodes: 1, items: 1 },
      role: 'viewport-provider',
    }
  }

  if (serviceComponents.has(componentName)) {
    return {
      budgeted: false,
      componentName,
      estimate: { nodes: 1, items: 1 },
      role: 'service',
    }
  }

  if (directiveComponents.has(componentName)) {
    return {
      budgeted: false,
      componentName,
      estimate: { nodes: 1, items: 1 },
      role: 'directive',
    }
  }

  return {
    budgeted: false,
    componentName,
    estimate: { nodes: 1, items: 1 },
    role: 'sync-monitored',
  }
}

const normalizeComponentPolicy = (
  policy: FsusRenderPipelineComponentPolicy,
): FsusRenderPipelineComponentPolicy => ({
  ...policy,
  componentName: normalizeComponentName(policy.componentName),
})

export const registerFsusRenderPipelineComponentPolicy = (
  policy: FsusRenderPipelineComponentPolicy,
) => {
  const normalized = normalizeComponentPolicy(policy)
  const previous = componentPolicies.get(normalized.componentName)
  componentPolicies.set(normalized.componentName, normalized)

  return () => {
    if (previous) {
      componentPolicies.set(normalized.componentName, previous)
    } else {
      componentPolicies.delete(normalized.componentName)
    }
  }
}

export const registerFsusRenderPipelineComponentPolicyByName = (
  componentName: string,
) =>
  registerFsusRenderPipelineComponentPolicy(
    createFsusRenderPipelineComponentPolicy(componentName),
  )

export const registerFsusRenderPipelineComponentPolicies = (
  policies: readonly FsusRenderPipelineComponentPolicy[],
) => {
  const unregister = policies.map((policy) =>
    registerFsusRenderPipelineComponentPolicy(policy),
  )

  return () => {
    for (let index = unregister.length - 1; index >= 0; index -= 1) {
      unregister[index]()
    }
  }
}

export const clearFsusRenderPipelineComponentPolicies = () => {
  componentPolicies.clear()
}

export const getFsusRenderPipelineComponentPolicy = (componentName: string) =>
  componentPolicies.get(normalizeComponentName(componentName))

export const listFsusRenderPipelineComponentPolicies = () =>
  Array.from(componentPolicies.values())

export const createFsusRenderPipelineComponentPolicies = (
  components: readonly unknown[],
) => {
  const names = new Set<string>()

  for (const component of components) {
    const name = getFsusComponentName(component)
    if (name) names.add(name)
  }

  return Array.from(names, createFsusRenderPipelineComponentPolicy)
}

export const registerFsusDefaultRenderPipelineComponentPolicies = (
  components: readonly unknown[],
) =>
  registerFsusRenderPipelineComponentPolicies(
    createFsusRenderPipelineComponentPolicies(components),
  )
