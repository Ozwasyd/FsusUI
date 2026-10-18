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

type OwnedComponentPolicy = Readonly<
  Omit<FsusRenderPipelineComponentPolicy, 'estimate'>
> & {
  readonly estimate?: Readonly<FsusRenderPipelineComponentEstimate>
}

export type FsusRenderPipelineComponentPolicyAuthority = Readonly<{
  issueTicket: () => object | null
  isCurrent: (ticket: unknown) => boolean
  subscribe: (listener: () => void) => () => void
  getFailures: () => readonly Readonly<{
    cause: unknown
    phase: string
    subscriptionId?: symbol
  }>[]
}>

const componentPolicies = new Map<string, OwnedComponentPolicy>()
type PolicyRegistration = {
  policy: OwnedComponentPolicy
  previous?: PolicyRegistration
  next?: WeakRef<PolicyRegistration>
  active: boolean
  generation: object
}
const policyRegistrations = new WeakMap<
  OwnedComponentPolicy,
  WeakRef<PolicyRegistration>
>()
let policyGeneration = {}
let policyTicket: object | null = null
let policyChangeDepth = 0
let brokenPolicyFeed = false
const policyFeedFailures: Array<
  Readonly<{ cause: unknown; phase: string; subscriptionId?: symbol }>
> = []
const policySubscriptions = new Set<{
  id: symbol
  listener: () => void
}>()

const changeComponentPolicies = <T>(phase: string, action: () => T): T => {
  policyChangeDepth += 1
  policyTicket = null
  try {
    if (policyChangeDepth === 1) {
      // Snapshot the obligations, then attempt every still-owned subscription.
      for (const subscription of [...policySubscriptions]) {
        if (!policySubscriptions.has(subscription)) continue
        try {
          const listener = subscription.listener
          const result: unknown = listener()
          if (
            result !== null &&
            (typeof result === 'object' || typeof result === 'function')
          ) {
            const then = (result as { then?: unknown }).then
            if (typeof then === 'function') {
              brokenPolicyFeed = true
              policyFeedFailures.push(
                Object.freeze({
                  cause: result,
                  phase: 'asynchronous-subscription',
                  subscriptionId: subscription.id,
                }),
              )
              // Read then once and discard settlements without trusting .call.
              // Also observe a rejecting return from an async then callback.
              const discard = () => {}
              const continuation = Reflect.apply(then, result, [
                discard,
                discard,
              ])
              void new Promise<unknown>((resolve) => {
                resolve(continuation)
              }).catch(discard)
            }
          }
        } catch (cause) {
          brokenPolicyFeed = true
          policyFeedFailures.push(
            Object.freeze({
              cause,
              phase: 'subscription',
              subscriptionId: subscription.id,
            }),
          )
        }
      }
    }
    return action()
  } catch (cause) {
    if (policyChangeDepth === 1) {
      policyFeedFailures.push(Object.freeze({ cause, phase }))
    }
    throw cause
  } finally {
    policyChangeDepth -= 1
  }
}

const componentPolicyAuthority: FsusRenderPipelineComponentPolicyAuthority =
  Object.freeze({
    issueTicket: () => {
      if (policyChangeDepth > 0 || brokenPolicyFeed) return null
      return (policyTicket ??= Object.freeze({}))
    },
    // No external property reads, callbacks, allocation, or ticket renewal.
    isCurrent: (ticket: unknown) =>
      policyChangeDepth === 0 &&
      !brokenPolicyFeed &&
      policyTicket !== null &&
      ticket === policyTicket,
    getFailures: () => Object.freeze([...policyFeedFailures]),
    subscribe: (listener: () => void) =>
      changeComponentPolicies('subscribe', () => {
        if (typeof listener !== 'function') {
          throw new TypeError('fsus_component_policy_listener_invalid')
        }
        const subscription = {
          id: Symbol('fsus-component-policy-subscription'),
          listener,
        }
        policySubscriptions.add(subscription)
        let released = false
        return () => {
          if (released) return
          changeComponentPolicies('unsubscribe', () => {
            released = true
            policySubscriptions.delete(subscription)
          })
        }
      }),
  })

// This is the original registry producer, not an observer or a custody receipt.
export const getFsusRenderPipelineComponentPolicyAuthority = () =>
  componentPolicyAuthority

// Exact stored key only: callers normalize names before this pure membership read.
export const hasFsusRenderPipelineComponentPolicy = (componentName: string) =>
  componentPolicies.has(componentName)
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
): OwnedComponentPolicy => {
  // Copy only the declared scalar contract; never retain caller-owned objects.
  const { componentName, role, adapterId, budgeted, estimate, inherits } = policy
  if (
    typeof componentName !== 'string' ||
    typeof role !== 'string' ||
    (adapterId !== undefined && typeof adapterId !== 'string') ||
    (budgeted !== undefined && typeof budgeted !== 'boolean') ||
    (inherits !== undefined && typeof inherits !== 'string')
  ) {
    throw new TypeError('fsus_component_policy_invalid')
  }
  let ownedEstimate: Readonly<FsusRenderPipelineComponentEstimate> | undefined
  if (estimate !== undefined) {
    if (estimate === null || typeof estimate !== 'object') {
      throw new TypeError('fsus_component_policy_estimate_invalid')
    }
    const { htmlBytes, nodes, items } = estimate
    if (
      (htmlBytes !== undefined && typeof htmlBytes !== 'number') ||
      (nodes !== undefined && typeof nodes !== 'number') ||
      (items !== undefined && typeof items !== 'number')
    ) {
      throw new TypeError('fsus_component_policy_estimate_invalid')
    }
    ownedEstimate = Object.freeze({ htmlBytes, nodes, items })
  }
  return Object.freeze({
    componentName: normalizeComponentName(componentName),
    role,
    adapterId,
    budgeted,
    estimate: ownedEstimate,
    inherits,
  })
}

const registerComponentPolicy = (policy: FsusRenderPipelineComponentPolicy) => {
  const normalized = normalizeComponentPolicy(policy)
  const previousPolicy = componentPolicies.get(normalized.componentName)
  let previous =
    previousPolicy && policyRegistrations.get(previousPolicy)?.deref()
  if (previousPolicy && !previous) {
    // A discarded handle cannot own history, but its current value still exists.
    previous = {
      policy: previousPolicy,
      active: true,
      generation: policyGeneration,
    }
    policyRegistrations.set(previousPolicy, new WeakRef(previous))
  }
  const registration: PolicyRegistration = {
    policy: normalized,
    previous,
    active: true,
    generation: policyGeneration,
  }
  if (previous) previous.next = new WeakRef(registration)
  // Live handles own rollback history; Map membership must not retain that graph.
  policyRegistrations.set(normalized, new WeakRef(registration))
  componentPolicies.set(normalized.componentName, normalized)

  return () => {
    if (!registration.active) return
    changeComponentPolicies('unregister', () => {
      if (!registration.active) return
      registration.active = false
      let previous = registration.previous
      while (previous && !previous.active) previous = previous.previous
      const next = registration.next?.deref()
      if (next?.previous === registration) next.previous = previous
      if (previous?.next?.deref() === registration) {
        previous.next = registration.next
      }
      registration.previous = undefined
      registration.next = undefined
      if (
        registration.generation !== policyGeneration ||
        componentPolicies.get(normalized.componentName) !== normalized
      ) {
        return
      }
      if (previous) {
        componentPolicies.set(normalized.componentName, previous.policy)
      } else {
        componentPolicies.delete(normalized.componentName)
      }
    })
  }
}

export const registerFsusRenderPipelineComponentPolicy = (
  policy: FsusRenderPipelineComponentPolicy,
) => changeComponentPolicies('register', () => registerComponentPolicy(policy))

export const registerFsusRenderPipelineComponentPolicyByName = (
  componentName: string,
) =>
  changeComponentPolicies('register-by-name', () =>
    registerComponentPolicy(
      createFsusRenderPipelineComponentPolicy(componentName),
    ),
  )

const releaseComponentPolicies = (unregister: readonly (() => void)[]) => {
  let failed = false
  let firstCause: unknown
  for (let index = unregister.length - 1; index >= 0; index -= 1) {
    try {
      unregister[index]()
    } catch (cause) {
      if (!failed) firstCause = cause
      failed = true
      policyFeedFailures.push(Object.freeze({ cause, phase: 'batch-unregister' }))
    }
  }
  if (failed) throw firstCause
}

const registerComponentPolicies = (
  policies: readonly FsusRenderPipelineComponentPolicy[],
) => {
  const unregister: Array<() => void> = []
  try {
    for (const policy of policies) {
      unregister.push(registerComponentPolicy(policy))
    }
  } catch (cause) {
    // A failed acquisition still owes release of every handle already acquired.
    try {
      releaseComponentPolicies(unregister)
    } catch {
      // Cleanup causes were retained above; preserve the acquisition cause.
    }
    throw cause
  }
  return () =>
    changeComponentPolicies('unregister-many', () =>
      releaseComponentPolicies(unregister),
    )
}

export const registerFsusRenderPipelineComponentPolicies = (
  policies: readonly FsusRenderPipelineComponentPolicy[],
) =>
  changeComponentPolicies('register-many', () =>
    registerComponentPolicies(policies),
  )

export const clearFsusRenderPipelineComponentPolicies = () =>
  changeComponentPolicies('clear', () => {
    policyGeneration = {}
    componentPolicies.clear()
  })

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
  changeComponentPolicies('register-defaults', () =>
    registerComponentPolicies(
      createFsusRenderPipelineComponentPolicies(components),
    ),
  )
