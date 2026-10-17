import { beforeEach, describe, expect, it, vi } from 'vitest'

let registry: typeof import('../vue/render-pipeline-policy')

beforeEach(async () => {
  vi.resetModules()
  registry = await import('../vue/render-pipeline-policy')
})

describe('component policy ownership', () => {
  it('invokes revocation listeners without a private subscription receiver', () => {
    const authority = registry.getFsusRenderPipelineComponentPolicyAuthority()
    const receivers: unknown[] = []
    const release = authority.subscribe(function (this: unknown) {
      receivers.push(this)
    })

    registry.clearFsusRenderPipelineComponentPolicies()
    expect(receivers).toEqual([undefined])

    release()
    expect(receivers).toEqual([undefined, undefined])

    release()
    registry.clearFsusRenderPipelineComponentPolicies()
    expect(receivers).toEqual([undefined, undefined])
  })

  it('owns and freezes declared policy data exposed by get and list', () => {
    const input = registry.createFsusRenderPipelineComponentPolicy('ElButton')
    const release = registry.registerFsusRenderPipelineComponentPolicy(input)
    const stored = registry.getFsusRenderPipelineComponentPolicy('ElButton')!

    input.role = 'service'
    input.estimate!.nodes = 100
    expect(stored.role).toBe('sync-monitored')
    expect(stored.estimate!.nodes).toBe(1)
    expect(stored).not.toBe(input)
    expect(stored.estimate).not.toBe(input.estimate)
    expect(Object.isFrozen(stored)).toBe(true)
    expect(Object.isFrozen(stored.estimate)).toBe(true)
    expect(Reflect.set(stored, 'role', 'service')).toBe(false)
    expect(Reflect.set(stored.estimate!, 'nodes', 100)).toBe(false)
    expect(registry.listFsusRenderPipelineComponentPolicies()).toEqual([stored])
    registry.listFsusRenderPipelineComponentPolicies().pop()
    expect(registry.getFsusRenderPipelineComponentPolicy('ElButton')).toBe(
      stored,
    )
    release()
  })

  it('retires older handles without overwriting newer or reviving retired policies', () => {
    const first =
      registry.registerFsusRenderPipelineComponentPolicyByName('ElButton')
    const original = registry.getFsusRenderPipelineComponentPolicy('ElButton')
    const second =
      registry.registerFsusRenderPipelineComponentPolicyByName('ElButton')
    const third =
      registry.registerFsusRenderPipelineComponentPolicyByName('ElButton')
    const newest = registry.getFsusRenderPipelineComponentPolicy('ElButton')

    second()
    expect(registry.getFsusRenderPipelineComponentPolicy('ElButton')).toBe(
      newest,
    )
    third()
    expect(registry.getFsusRenderPipelineComponentPolicy('ElButton')).toBe(
      original,
    )
    third()
    expect(registry.getFsusRenderPipelineComponentPolicy('ElButton')).toBe(
      original,
    )
    first()
    expect(registry.hasFsusRenderPipelineComponentPolicy('ElButton')).toBe(
      false,
    )
  })

  it('cannot restore a previous generation after clear', () => {
    const first =
      registry.registerFsusRenderPipelineComponentPolicyByName('ElButton')
    const second =
      registry.registerFsusRenderPipelineComponentPolicyByName('ElButton')
    registry.clearFsusRenderPipelineComponentPolicies()
    const fresh =
      registry.registerFsusRenderPipelineComponentPolicyByName('ElButton')
    const current = registry.getFsusRenderPipelineComponentPolicy('ElButton')

    second()
    first()
    expect(registry.getFsusRenderPipelineComponentPolicy('ElButton')).toBe(
      current,
    )
    fresh()
    expect(registry.hasFsusRenderPipelineComponentPolicy('ElButton')).toBe(
      false,
    )
  })

  it('rolls back a partially acquired batch and retains the original getter cause', () => {
    const release =
      registry.registerFsusRenderPipelineComponentPolicyByName('ElButton')
    const previous = registry.getFsusRenderPipelineComponentPolicy('ElButton')
    const cause = new Error('policy getter failed')
    const invalid = {
      componentName: 'ElOther',
      get role(): 'service' {
        throw cause
      },
    }
    expect(() =>
      registry.registerFsusRenderPipelineComponentPolicies([
        registry.createFsusRenderPipelineComponentPolicy('ElButton'),
        invalid,
      ]),
    ).toThrow(cause)
    expect(registry.getFsusRenderPipelineComponentPolicy('ElButton')).toBe(
      previous,
    )
    expect(registry.hasFsusRenderPipelineComponentPolicy('ElOther')).toBe(false)
    expect(
      registry.getFsusRenderPipelineComponentPolicyAuthority().getFailures(),
    ).toEqual([{ cause, phase: 'register-many' }])
    release()
  })

  it('revokes before reading a caller policy or default component getter', () => {
    const authority = registry.getFsusRenderPipelineComponentPolicyAuthority()
    let ticket = authority.issueTicket()
    const getterStates: unknown[] = []
    const release = registry.registerFsusRenderPipelineComponentPolicy({
      get componentName() {
        getterStates.push(authority.isCurrent(ticket), authority.issueTicket())
        return 'ElButton'
      },
      role: 'sync-monitored',
    })
    expect(getterStates).toEqual([false, null])
    ticket = authority.issueTicket()
    const releaseDefaults =
      registry.registerFsusDefaultRenderPipelineComponentPolicies([
        {
          get name() {
            expect(authority.isCurrent(ticket)).toBe(false)
            expect(authority.issueTicket()).toBeNull()
            return 'ElMessage'
          },
        },
      ])
    expect(
      registry.getFsusRenderPipelineComponentPolicy('ElMessage')?.role,
    ).toBe('service')
    releaseDefaults()
    release()
  })

  it('keeps ticket and exact-key membership predicates free of caller property reads', () => {
    const authority = registry.getFsusRenderPipelineComponentPolicyAuthority()
    registry.registerFsusRenderPipelineComponentPolicyByName('ElButton')
    const ticket = authority.issueTicket()
    let reads = 0
    const foreign = new Proxy({}, { get: () => ++reads })
    expect(authority.isCurrent(ticket)).toBe(true)
    expect(authority.issueTicket()).toBe(ticket)
    expect(authority.isCurrent(foreign)).toBe(false)
    expect(
      registry.hasFsusRenderPipelineComponentPolicy(foreign as string),
    ).toBe(false)
    expect(registry.hasFsusRenderPipelineComponentPolicy(' ElButton ')).toBe(
      false,
    )
    expect(reads).toBe(0)
    expect(authority.isCurrent(ticket)).toBe(true)
  })

  it('skips a subscription released reentrantly and keeps writes in the revoked interval', () => {
    const authority = registry.getFsusRenderPipelineComponentPolicyAuthority()
    const calls: string[] = []
    let active = false
    let releaseSecond = () => {}
    const releaseFirst = authority.subscribe(() => {
      if (!active) return
      calls.push('first')
      expect(authority.issueTicket()).toBeNull()
      releaseSecond()
      registry.registerFsusRenderPipelineComponentPolicyByName('ElMessage')
      expect(authority.issueTicket()).toBeNull()
    })
    releaseSecond = authority.subscribe(() => calls.push('second'))
    active = true
    const ticket = authority.issueTicket()
    registry.registerFsusRenderPipelineComponentPolicyByName('ElButton')
    expect(calls).toEqual(['first'])
    expect(authority.isCurrent(ticket)).toBe(false)
    expect(registry.hasFsusRenderPipelineComponentPolicy('ElMessage')).toBe(
      true,
    )
    expect(registry.hasFsusRenderPipelineComponentPolicy('ElButton')).toBe(true)
    active = false
    releaseFirst()
  })

  it('attempts later listeners and preserves thrown and thenable failures permanently', () => {
    const authority = registry.getFsusRenderPipelineComponentPolicyAuthority()
    const cause = new Error('listener failed')
    const thenable = Promise.resolve()
    let active = false
    const releaseThrowing = authority.subscribe(() => {
      if (active) throw cause
    })
    const releaseAsync = authority.subscribe(() => {
      if (active) return thenable
    })
    const later = vi.fn()
    const releaseLater = authority.subscribe(later)
    const ticket = authority.issueTicket()
    active = true
    registry.registerFsusRenderPipelineComponentPolicyByName('ElButton')

    expect(later).toHaveBeenCalledOnce()
    expect(registry.hasFsusRenderPipelineComponentPolicy('ElButton')).toBe(true)
    expect(authority.issueTicket()).toBeNull()
    expect(authority.isCurrent(ticket)).toBe(false)
    const failures = authority.getFailures()
    expect(failures).toHaveLength(2)
    expect(failures[0].cause).toBe(cause)
    expect(failures[0].phase).toBe('subscription')
    expect(failures[1].cause).toBe(thenable)
    expect(failures[1].phase).toBe('asynchronous-subscription')
    expect(failures[0].subscriptionId).not.toBe(failures[1].subscriptionId)
    expect(Object.isFrozen(failures)).toBe(true)
    expect(failures.every(Object.isFrozen)).toBe(true)

    active = false
    releaseThrowing()
    releaseAsync()
    releaseLater()
    registry.clearFsusRenderPipelineComponentPolicies()
    expect(authority.getFailures()).toEqual(failures)
    expect(authority.issueTicket()).toBeNull()
  })
})
