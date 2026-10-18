import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
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

  it('preserves the surviving predecessor when a listener reenters the same release', () => {
    const authority = registry.getFsusRenderPipelineComponentPolicyAuthority()
    const releaseFirst =
      registry.registerFsusRenderPipelineComponentPolicyByName('ElButton')
    const first = registry.getFsusRenderPipelineComponentPolicy('ElButton')
    const releaseSecond =
      registry.registerFsusRenderPipelineComponentPolicyByName('ElButton')
    let releaseReplacement = () => {}
    let armed = false
    const releaseListener = authority.subscribe(() => {
      if (!armed) return
      armed = false
      releaseSecond()
      releaseReplacement =
        registry.registerFsusRenderPipelineComponentPolicyByName('ElButton')
    })
    armed = true
    releaseSecond()
    expect(registry.getFsusRenderPipelineComponentPolicy('ElButton')).not.toBe(
      first,
    )
    releaseReplacement()
    expect(registry.getFsusRenderPipelineComponentPolicy('ElButton')).toBe(
      first,
    )
    releaseFirst()
    expect(registry.hasFsusRenderPipelineComponentPolicy('ElButton')).toBe(
      false,
    )
    releaseListener()
  })
})

it.each([
  'an immediately rejected async listener',
  'a delayed async rejection',
  'a rejected native promise',
  'a rejecting function thenable',
  'a throwing then getter',
  'a then getter that must only be read once',
  'a then callback that rejects then throws',
  'an async then callback that throws',
  'a then callback returning a promise with a hostile catch',
  'a then callback returning a throwing then getter',
  'a fulfilled thenable',
])('observes %s without repairing the broken feed', (mode) => {
  const moduleUrl = pathToFileURL(
    resolve('vue/packages/utils/vue/render-pipeline-policy.ts'),
  ).href
  const script = `
    import assert from 'node:assert/strict'
    const loaded = await import(${JSON.stringify(moduleUrl)})
    const registry = loaded.default ?? loaded
    const authority = registry.getFsusRenderPipelineComponentPolicyAuthority()
    const mode = ${JSON.stringify(mode)}
    const events = []
    process.on('unhandledRejection', (reason) => events.push(reason))
    const drain = async () => {
      for (let turn = 0; turn < 4; turn++) await new Promise(setImmediate)
    }
    // Prove that this isolated process reports real, unrelated rejections.
    const control = new Error('unhandled control')
    Promise.reject(control)
    await drain()
    assert.deepEqual(events, [control])
    events.length = 0

    const cause = new Error('listener rejected')
    const callbackCause = new Error('then callback failed')
    let result
    let active = false
    let reads = 0
    let calls = 0
    const rejectThen = function (resolve, reject) {
      assert.equal(this, result)
      assert.equal(authority.issueTicket(), null)
      calls++
      setImmediate(() => reject(cause))
    }
    // Invocation must not depend on the untrusted function's .call property.
    Object.defineProperty(rejectThen, 'call', { get() { throw callbackCause } })
    const releaseListener = authority.subscribe(() => {
      if (!active) return
      switch (mode) {
        case 'an immediately rejected async listener':
          result = (async () => { throw cause })()
          break
        case 'a delayed async rejection':
          result = (async () => { await new Promise(setImmediate); throw cause })()
          break
        case 'a rejected native promise':
          result = Promise.reject(cause)
          break
        case 'a rejecting function thenable':
          result = Object.assign(() => {}, { then: rejectThen })
          break
        case 'a throwing then getter':
          result = { get then() { reads++; throw cause } }
          break
        case 'a then getter that must only be read once':
          result = { get then() {
            reads++
            if (reads > 1) throw callbackCause
            return rejectThen
          } }
          break
        case 'a then callback that rejects then throws':
          result = { then(resolve, reject) { reject(cause); throw callbackCause } }
          break
        case 'an async then callback that throws':
          result = { async then() { await new Promise(setImmediate); throw callbackCause } }
          break
        case 'a then callback returning a promise with a hostile catch':
          result = { then() {
            const continuation = Promise.reject(callbackCause)
            Object.defineProperty(continuation, 'catch', { get() { throw cause } })
            return continuation
          } }
          break
        case 'a then callback returning a throwing then getter':
          result = { then() { return { get then() { throw callbackCause } } } }
          break
        case 'a fulfilled thenable':
          result = Promise.resolve()
          break
        default:
          assert.fail('unknown case')
      }
      return result
    })
    let laterCalls = 0
    const releaseLater = authority.subscribe(() => {
      if (active) {
        laterCalls++
        assert.equal(authority.issueTicket(), null)
      }
    })
    const ticket = authority.issueTicket()
    assert.ok(ticket)
    active = true
    const releasePolicy = registry.registerFsusRenderPipelineComponentPolicyByName('ElButton')
    assert.equal(laterCalls, 1)
    assert.equal(registry.hasFsusRenderPipelineComponentPolicy('ElButton'), true)
    assert.equal(authority.isCurrent(ticket), false)
    assert.equal(authority.issueTicket(), null)
    await drain()
    assert.deepEqual(events, [], 'listener work must not leak global unhandledRejection')
    const failures = authority.getFailures()
    assert.equal(failures[0].cause, mode === 'a throwing then getter' ? cause : result)
    assert.equal(failures[0].phase, mode === 'a throwing then getter' ? 'subscription' : 'asynchronous-subscription')
    assert.equal(typeof failures[0].subscriptionId, 'symbol')
    assert.ok(Object.isFrozen(failures))
    assert.ok(failures.every(Object.isFrozen))
    if (mode === 'a then callback that rejects then throws') {
      assert.equal(failures.length, 2)
      assert.equal(failures[1].cause, callbackCause)
      assert.equal(failures[1].phase, 'subscription')
      assert.equal(failures[1].subscriptionId, failures[0].subscriptionId)
    } else {
      assert.equal(failures.length, 1)
    }
    if (mode === 'a throwing then getter' || mode === 'a then getter that must only be read once') {
      assert.equal(reads, 1)
    }
    if (mode === 'a rejecting function thenable' || mode === 'a then getter that must only be read once') {
      assert.equal(calls, 1)
    }
    active = false
    releaseListener()
    releaseLater()
    releasePolicy()
    registry.clearFsusRenderPipelineComponentPolicies()
    registry.registerFsusRenderPipelineComponentPolicyByName('ElMessage')
    await drain()
    assert.deepEqual(events, [])
    assert.deepEqual(authority.getFailures(), failures)
    assert.equal(authority.issueTicket(), null)
    assert.equal(authority.isCurrent(ticket), false)
    console.log(JSON.stringify({ controlEvents: 1, listenerEvents: events.length, broken: authority.issueTicket() === null }))
  `
  const output = execFileSync(
    process.execPath,
    ['--import', 'tsx', '--input-type=module', '-e', script],
    { encoding: 'utf8', cwd: process.cwd() },
  )
  expect(JSON.parse(output)).toEqual({
    controlEvents: 1,
    listenerEvents: 0,
    broken: true,
  })
})

it('releases retired and discarded registration history under real garbage collection', () => {
  const moduleUrl = pathToFileURL(
    resolve('vue/packages/utils/vue/render-pipeline-policy.ts'),
  ).href
  const script = `
    import assert from 'node:assert/strict'
    const loaded = await import(${JSON.stringify(moduleUrl)})
    const registry = loaded.default ?? loaded
    const collect = async () => {
      for (let turn = 0; turn < 8; turn++) {
        await new Promise((resolve) => setImmediate(resolve))
        globalThis.gc()
      }
    }
    const populate = (mode) => {
      const references = []
      let previousRelease
      for (let index = 0; index < 1000; index++) {
        const release = registry.registerFsusRenderPipelineComponentPolicyByName('ElButton')
        references.push(new WeakRef(registry.getFsusRenderPipelineComponentPolicy('ElButton')))
        if (mode === 'released') {
          previousRelease?.()
          previousRelease = release
        }
      }
      return { references, release: previousRelease }
    }
    const results = {}
    for (const mode of ['released', 'discarded']) {
      const state = populate(mode)
      await collect()
      const retained = state.references.filter((reference) => reference.deref()).length
      assert.equal(retained, 1, mode + ' history must not be owned by Map membership')
      state.release?.()
      state.release = undefined
      registry.clearFsusRenderPipelineComponentPolicies()
      await collect()
      const afterClear = state.references.filter((reference) => reference.deref()).length
      assert.equal(afterClear, 0)
      results[mode] = { retained, afterClear }
    }
    registry.registerFsusRenderPipelineComponentPolicyByName('ElButton')
    const predecessor = new WeakRef(registry.getFsusRenderPipelineComponentPolicy('ElButton'))
    await collect()
    const release = registry.registerFsusRenderPipelineComponentPolicyByName('ElButton')
    await collect()
    assert.ok(predecessor.deref(), 'a live undo handle must still own its predecessor')
    release()
    assert.equal(registry.getFsusRenderPipelineComponentPolicy('ElButton'), predecessor.deref())
    results.restored = true
    console.log(JSON.stringify(results))
  `
  const output = execFileSync(
    process.execPath,
    ['--expose-gc', '--import', 'tsx', '--input-type=module', '-e', script],
    { encoding: 'utf8', cwd: process.cwd() },
  )
  expect(JSON.parse(output)).toEqual({
    released: { retained: 1, afterClear: 0 },
    discarded: { retained: 1, afterClear: 0 },
    restored: true,
  })
})
