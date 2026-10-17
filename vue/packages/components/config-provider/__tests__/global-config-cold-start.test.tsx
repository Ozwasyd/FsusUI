import { createApp, defineComponent } from 'vue'
import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type * as ConfigHook from '../src/hooks/use-global-config'

let hook: typeof ConfigHook
const cleanup: (() => void)[] = []

beforeEach(async () => {
  vi.resetModules()
  hook = await import('../src/hooks/use-global-config')
})

afterEach(() => {
  for (const release of cleanup.splice(0).reverse()) release()
  hook.useGlobalConfig().value = undefined
})

describe('global config cold reads', () => {
  it('keeps earlier reads reactive without retroactively granting feed identity', () => {
    const selected = hook.useGlobalConfig('namespace')
    const fallback = hook.useGlobalConfig()
    fallback.value = { namespace: 'ordinary' }
    expect(selected.value).toBe('ordinary')
    expect(hook.getGlobalConfigFeed(selected)).toBeUndefined()
    expect(hook.getGlobalConfigFeed(fallback)).toBeUndefined()
    const context = hook.provideGlobalConfig({}, createApp({}))!
    cleanup.push(() => hook.releaseGlobalConfig(context))

    const current = hook.useGlobalConfig('namespace')
    const feed = hook.getGlobalConfigFeed(current)!
    cleanup.push(feed.subscribe(vi.fn()))
    expect(feed.issueTicket()).toBeNull()
    fallback.value = { namespace: 'updated' }
    expect(selected.value).toBe('updated')
    expect(current.value).toBe('updated')
    expect(feed.issueTicket()).toBeNull()
  })

  it('intercepts writes through the fallback Ref captured before initialization', () => {
    const fallback = hook.useGlobalConfig()
    const selectedBefore = hook.useGlobalConfig('namespace')
    const provideBefore = hook.provideGlobalConfig
    const readBefore = hook.useGlobalConfig
    const producer = hook.createGlobalConfigSnapshot({
      namespace: 'controlled',
    })
    cleanup.push(producer.release)
    expect(hook.provideGlobalConfig).toBe(provideBefore)
    expect(hook.useGlobalConfig).toBe(readBefore)
    const appContext = provideBefore(producer, createApp({}))!
    cleanup.push(() => hook.releaseGlobalConfig(appContext))
    const wrapper = mount(
      defineComponent({
        setup() {
          provideBefore(producer, undefined, true)
          return () => null
        },
      }),
    )
    cleanup.push(() => wrapper.unmount())

    expect(readBefore()).toBe(fallback)
    expect(selectedBefore.value).toBe('controlled')
    expect(hook.getGlobalConfigFeed(selectedBefore)).toBeUndefined()
    const feed = hook.getGlobalConfigFeed(fallback)!
    const revoke = vi.fn(() => {
      expect(fallback.value?.namespace).toBe('controlled')
      expect(feed.isCurrent(ticket)).toBe(false)
    })
    cleanup.push(feed.subscribe(revoke))
    const ticket = feed.issueTicket()!
    expect(ticket.value?.namespace).toBe('controlled')
    fallback.value = { namespace: 'external' }
    expect(revoke).toHaveBeenCalledOnce()
    expect(feed.issueTicket()).toBeNull()
    producer.update({ namespace: 'next controlled value' })
    expect(fallback.value?.namespace).toBe('external')
    expect(revoke).toHaveBeenCalledOnce()
  })
})
