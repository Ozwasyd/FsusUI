import { computed, createApp, defineComponent, reactive } from 'vue'
import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createGlobalConfigSnapshot,
  getGlobalConfigFeed,
  provideGlobalConfig,
  releaseGlobalConfig,
  useGlobalConfig,
} from '../src/hooks/use-global-config'

import type { Ref } from 'vue'
import type { ConfigProviderContext } from '../src/constants'

const cleanup: (() => void)[] = []

afterEach(() => {
  for (const release of cleanup.splice(0).reverse()) release()
  useGlobalConfig().value = undefined
})

const createContext = (
  initial: ConfigProviderContext = { namespace: 'first' },
) => {
  const producer = createGlobalConfigSnapshot(initial)
  cleanup.push(producer.release)
  const context = provideGlobalConfig(producer, createApp({}))!
  cleanup.push(() => releaseGlobalConfig(context))
  const feed = getGlobalConfigFeed(context)!
  return { producer, context, feed }
}

describe('controlled global config custody', () => {
  it('copies and freezes snapshots without freezing caller data', () => {
    const initial = { message: { max: 2 } }
    const { producer, context } = createContext(initial)
    initial.message.max = 9
    expect(context.value.message?.max).toBe(2)
    expect(Object.isFrozen(initial.message)).toBe(false)
    expect(Object.isFrozen(context.value.message)).toBe(true)
    expect(() => producer.update(reactive({ namespace: 'proxy' }))).toThrow()
    expect(() =>
      producer.update({
        get namespace() {
          return 'accessor'
        },
      }),
    ).toThrow()
    expect(context.value.message?.max).toBe(2)
  })

  it('requires live subscription custody and rejects foreign tickets', () => {
    const { feed } = createContext()
    expect(feed.issueTicket()).toBeNull()
    const firstRelease = feed.subscribe(vi.fn())
    const secondRelease = feed.subscribe(vi.fn())
    cleanup.push(firstRelease, secondRelease)
    const ticket = feed.issueTicket()!
    expect(feed.isCurrent(ticket)).toBe(true)
    expect(feed.isCurrent({ ...ticket })).toBe(false)
    const other = createContext()
    expect(other.feed.isCurrent(ticket)).toBe(false)
    firstRelease()
    expect(feed.isCurrent(ticket)).toBe(false)
    expect(feed.issueTicket()).not.toBeNull()
    secondRelease()
    expect(feed.issueTicket()).toBeNull()
    secondRelease()
  })

  it('revokes before publication and requires an explicit new ticket', () => {
    const { producer, context, feed } = createContext()
    const revoke = vi.fn(() => {
      expect(context.value.namespace).toBe('first')
      expect(feed.isCurrent(ticket)).toBe(false)
      expect(feed.issueTicket()).toBeNull()
    })
    cleanup.push(feed.subscribe(revoke))
    const ticket = feed.issueTicket()!
    producer.update({ namespace: 'second' })
    expect(revoke).toHaveBeenCalledOnce()
    expect(context.value.namespace).toBe('second')
    expect(ticket.value.namespace).toBe('first')
    expect(feed.isCurrent(ticket)).toBe(false)
    expect(feed.issueTicket()?.value.namespace).toBe('second')
  })

  it('preserves ordinary reactive inputs without granting them authority', () => {
    const initial = reactive({ namespace: 'first' })
    const context = provideGlobalConfig(
      computed(() => initial),
      createApp({}),
    )!
    cleanup.push(() => releaseGlobalConfig(context))
    const feed = getGlobalConfigFeed(context)!
    cleanup.push(feed.subscribe(vi.fn()))
    initial.namespace = 'second'
    expect(context.value.namespace).toBe('second')
    expect(feed.issueTicket()).toBeNull()
    const producer = createGlobalConfigSnapshot({ namespace: 'wrapped' })
    cleanup.push(producer.release)
    const wrapped = provideGlobalConfig(producer.config, createApp({}))!
    cleanup.push(() => releaseGlobalConfig(wrapped))
    const wrappedFeed = getGlobalConfigFeed(wrapped)!
    cleanup.push(wrappedFeed.subscribe(vi.fn()))
    expect(wrappedFeed.issueTicket()).toBeNull()
  })

  it('detaches released subscriptions and contexts from later updates', () => {
    const { producer, context, feed } = createContext()
    const revoke = vi.fn()
    const unsubscribe = feed.subscribe(revoke)
    cleanup.push(unsubscribe)
    unsubscribe()
    producer.update({ namespace: 'second' })
    expect(revoke).not.toHaveBeenCalled()
    cleanup.push(feed.subscribe(revoke))
    const ticket = feed.issueTicket()!
    expect(releaseGlobalConfig(context)).toBe(true)
    expect(feed.isCurrent(ticket)).toBe(false)
    expect(revoke).toHaveBeenCalledOnce()
    expect(() => feed.subscribe(vi.fn())).toThrow('released')
    producer.update({ namespace: 'third' })
    expect(revoke).toHaveBeenCalledOnce()
    expect(context.value.namespace).toBe('second')
    expect(releaseGlobalConfig(context)).toBe(true)
  })

  it('keeps release terminal when one revocation subscriber throws', () => {
    const { producer, context, feed } = createContext()
    const failure = new Error('revocation failed')
    const throwing = vi.fn(() => {
      throw failure
    })
    const other = vi.fn()
    cleanup.push(feed.subscribe(throwing), feed.subscribe(other))
    const ticket = feed.issueTicket()!
    expect(() => releaseGlobalConfig(context)).toThrow(failure)
    expect(other).toHaveBeenCalledOnce()
    expect(feed.isCurrent(ticket)).toBe(false)
    expect(feed.getFailures()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ cause: failure, listener: throwing }),
      ]),
    )
    producer.update({ namespace: 'after release' })
    expect(throwing).toHaveBeenCalledOnce()
    expect(other).toHaveBeenCalledOnce()
  })

  it('prevents publication when revocation fails or reenters the producer', () => {
    const { producer, context, feed } = createContext()
    const unsubscribe = feed.subscribe(() =>
      producer.update({ namespace: 'reentry' }),
    )
    cleanup.push(unsubscribe)
    expect(() => producer.update({ namespace: 'second' })).toThrow('writing')
    expect(context.value.namespace).toBe('first')
    expect(feed.issueTicket()).toBeNull()
    unsubscribe()
    producer.update({ namespace: 'third' })
    expect(feed.issueTicket()).toBeNull()
  })

  it('retains actual asynchronous rejection ownership after unsubscribe', async () => {
    const { producer, context, feed } = createContext()
    let rejectLater!: (reason: unknown) => void
    const pending = new Promise<void>((_resolve, reject) => {
      rejectLater = reject
    })
    const listener = vi.fn(() => pending)
    const unsubscribe = feed.subscribe(listener)
    cleanup.push(unsubscribe)
    const identity = feed.issueTicket()!.contextIdentity
    expect(() => producer.update({ namespace: 'second' })).toThrow(
      'synchronous',
    )
    expect(context.value.namespace).toBe('first')
    unsubscribe()
    const cause = new Error('actual rejection')
    rejectLater(cause)
    await pending.catch(() => undefined)
    expect(feed.getFailures()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ cause, listener, contextIdentity: identity }),
      ]),
    )
    expect(feed.issueTicket()).toBeNull()
  })

  it('inherits controlled parent snapshots and revokes selected child feeds', () => {
    const parent = createGlobalConfigSnapshot({
      namespace: 'parent',
      message: { max: 2 },
    })
    const child = createGlobalConfigSnapshot({ size: 'small' })
    cleanup.push(parent.release, child.release)
    let context!: Ref<ConfigProviderContext>
    let selected!: ReturnType<typeof useGlobalConfig<'message', undefined>>
    const Leaf = defineComponent({
      setup() {
        selected = useGlobalConfig('message')
        return () => null
      },
    })
    const Child = defineComponent({
      setup() {
        context = provideGlobalConfig(child)!
        return () => <Leaf />
      },
    })
    const wrapper = mount(
      defineComponent({
        setup() {
          provideGlobalConfig(parent)
          return () => <Child />
        },
      }),
    )
    cleanup.push(() => wrapper.unmount())
    const feed = getGlobalConfigFeed(selected)!
    const revoke = vi.fn()
    cleanup.push(feed.subscribe(revoke))
    const ticket = feed.issueTicket()!
    expect(context.value.namespace).toBe('parent')
    expect(context.value.size).toBe('small')
    expect(ticket.value?.max).toBe(2)
    parent.update({ namespace: 'updated', message: { max: 3 } })
    expect(revoke).toHaveBeenCalledOnce()
    expect(feed.isCurrent(ticket)).toBe(false)
    expect(selected.value?.max).toBe(3)
    expect(feed.issueTicket()?.value?.max).toBe(3)
    parent.release()
    expect(feed.issueTicket()).toBeNull()
    expect(() => feed.subscribe(vi.fn())).toThrow('released')
  })

  it('keeps fallback subscribers live across reassignment and reselection', () => {
    const first = createGlobalConfigSnapshot({ namespace: 'first' })
    const second = createGlobalConfigSnapshot({ namespace: 'second' })
    cleanup.push(first.release, second.release)
    const mountProvider = (producer: typeof first) => {
      const wrapper = mount(
        defineComponent({
          setup() {
            provideGlobalConfig(producer, undefined, true)
            return () => null
          },
        }),
      )
      cleanup.push(() => wrapper.unmount())
    }
    mountProvider(first)
    const selected = useGlobalConfig('namespace')
    const feed = getGlobalConfigFeed(selected)!
    const revoke = vi.fn()
    const unsubscribe = feed.subscribe(revoke)
    cleanup.push(unsubscribe)
    const old = feed.issueTicket()!
    useGlobalConfig().value = { namespace: 'external' }
    expect(revoke).toHaveBeenCalledTimes(1)
    expect(selected.value).toBe('external')
    expect(feed.issueTicket()).toBeNull()
    mountProvider(second)
    expect(revoke).toHaveBeenCalledTimes(2)
    expect(feed.isCurrent(old)).toBe(false)
    expect(feed.issueTicket()?.value).toBe('second')
    second.update({ namespace: 'third' })
    expect(revoke).toHaveBeenCalledTimes(3)
    expect(selected.value).toBe('third')
    expect(feed.issueTicket()?.value).toBe('third')
    unsubscribe()
  })
})
