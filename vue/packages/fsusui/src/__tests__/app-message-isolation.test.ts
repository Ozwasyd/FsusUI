import {
  createApp,
  defineComponent,
  h,
  inject,
  nextTick,
  onMounted,
  onUnmounted,
  type InjectionKey,
} from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createFsusMessageService,
  createFsusUI,
  en,
  FsusMessage,
  useFsusConfig,
  useFsusLocale,
  useFsusMessage,
  zhCN,
  type FsusMessageService,
} from '../index'

const createMountPoint = () => {
  const el = document.createElement('div')
  document.body.appendChild(el)
  return el
}

describe('#1152 FsusMessage app-owned state, AppContext propagation, and unmount teardown', () => {
  const cleanups: Array<() => void> = []

  afterEach(() => {
    while (cleanups.length > 0) {
      cleanups.pop()?.()
    }
    FsusMessage.closeAll()
    vi.useRealTimers()
  })

  it('reproduction fixture: tears down persistent message and host when owning app unmounts', () => {
    const mountPoint = createMountPoint()
    const app = createApp({
      setup() {
        onMounted(() => {
          FsusMessage({ message: 'Message from application A', duration: 0 })
        })
        return () => null
      },
    })
    app.use(createFsusUI({ components: [] }))
    app.mount(mountPoint)

    expect(document.body.textContent).toContain('Message from application A')
    expect(document.querySelectorAll('[data-fsus-message-host]')).toHaveLength(1)

    app.unmount()
    mountPoint.remove()

    expect(document.body.textContent).not.toContain('Message from application A')
    expect(document.querySelectorAll('[data-fsus-message-host]')).toHaveLength(0)
  })

  it('isolates two apps showing, closing, and calling closeAll independently (including async calls outside setup)', async () => {
    const mountA = createMountPoint()
    const mountB = createMountPoint()
    let messageA!: FsusMessageService
    let messageB!: FsusMessageService

    const appA = createApp({
      setup() {
        messageA = useFsusMessage()
        return () => null
      },
    })
    const appB = createApp({
      setup() {
        messageB = useFsusMessage()
        return () => null
      },
    })

    appA.use(createFsusUI({ components: [] }))
    appB.use(createFsusUI({ components: [] }))
    appA.mount(mountA)
    appB.mount(mountB)
    cleanups.push(() => {
      appA.unmount()
      appB.unmount()
      mountA.remove()
      mountB.remove()
    })

    // Invoke asynchronously outside setup(): bound services retain their owning app
    await Promise.resolve()
    const handleA1 = messageA.info({ message: 'App A first', duration: 0 })
    messageA.success({ message: 'App A second', duration: 0 })
    const handleB1 = messageB.warning({ message: 'App B persistent', duration: 0 })
    const globalHandle = FsusMessage.danger({ message: 'Global scope message', duration: 0 })
    await nextTick()

    expect(document.querySelectorAll('[data-fsus-message-host]')).toHaveLength(3)
    expect(document.body.textContent).toContain('App A first')
    expect(document.body.textContent).toContain('App A second')
    expect(document.body.textContent).toContain('App B persistent')
    expect(document.body.textContent).toContain('Global scope message')

    // Closing one handle in A leaves A2, B, and Global intact
    handleA1.close()
    await nextTick()
    expect(document.body.textContent).not.toContain('App A first')
    expect(document.body.textContent).toContain('App A second')
    expect(document.body.textContent).toContain('App B persistent')

    // Global FsusMessage.closeAll() clears ONLY global convenience scope, never app A or app B
    FsusMessage.closeAll()
    await nextTick()
    expect(document.body.textContent).not.toContain('Global scope message')
    expect(document.body.textContent).toContain('App A second')
    expect(document.body.textContent).toContain('App B persistent')
    expect(document.querySelectorAll('[data-fsus-message-host]')).toHaveLength(2)

    // Closing all messages for App A leaves App B intact and removes App A's empty host
    messageA.closeAll()
    await nextTick()
    expect(document.body.textContent).not.toContain('App A second')
    expect(document.body.textContent).toContain('App B persistent')
    expect(document.querySelectorAll('[data-fsus-message-host]')).toHaveLength(1)

    // Closing App B's last message removes App B's host too
    handleB1.close()
    globalHandle.close()
    await nextTick()
    expect(document.querySelectorAll('[data-fsus-message-host]')).toHaveLength(0)
  })

  it('unmounting App A clears its timers, unmounts its renderer, and removes its host without affecting App B', async () => {
    vi.useFakeTimers()
    const mountA = createMountPoint()
    const mountB = createMountPoint()
    const onUnmountedA = vi.fn()
    const onCloseA = vi.fn()
    const onCloseB = vi.fn()

    const ChildA = defineComponent({
      setup() {
        onUnmounted(onUnmountedA)
        return () => h('span', 'Rendered VNode A')
      },
    })

    const appA = createApp({ render: () => null })
    const appB = createApp({ render: () => null })
    appA.use(createFsusUI({ components: [] }))
    appB.use(createFsusUI({ components: [] }))
    appA.mount(mountA)
    appB.mount(mountB)
    cleanups.push(() => {
      appB.unmount()
      mountB.remove()
    })

    const msgA = appA.runWithContext(() => useFsusMessage())
    const msgB = appB.runWithContext(() => useFsusMessage())

    msgA({ message: h(ChildA), duration: 5000, onClose: onCloseA })
    msgB({ message: 'Still alive in B', duration: 5000, onClose: onCloseB })

    expect(vi.getTimerCount()).toBe(2)
    expect(document.querySelectorAll('[data-fsus-message-host]')).toHaveLength(2)

    appA.unmount()
    mountA.remove()

    expect(onUnmountedA).toHaveBeenCalledTimes(1)
    expect(onCloseA).toHaveBeenCalledTimes(1)
    expect(onCloseB).toHaveBeenCalledTimes(0)
    expect(vi.getTimerCount()).toBe(1)
    expect(document.querySelectorAll('[data-fsus-message-host]')).toHaveLength(1)
    expect(document.body.textContent).not.toContain('Rendered VNode A')
    expect(document.body.textContent).toContain('Still alive in B')

    // Calling disposed service after unmount is a safe no-op (no resurrected host or timer)
    const afterUnmountHandle = msgA.info('Should not appear')
    afterUnmountHandle.close()
    expect(vi.getTimerCount()).toBe(1)
    expect(document.querySelectorAll('[data-fsus-message-host]')).toHaveLength(1)

    // Advancing timer expires App B cleanly
    vi.advanceTimersByTime(5000)
    await nextTick()
    expect(onCloseA).toHaveBeenCalledTimes(1)
    expect(onCloseB).toHaveBeenCalledTimes(1)
    expect(vi.getTimerCount()).toBe(0)
    expect(document.querySelectorAll('[data-fsus-message-host]')).toHaveLength(0)
  })

  it('propagates owning AppContext so VNode message content reads app provides and FsusConfig', () => {
    const TENANT_KEY: InjectionKey<string> = Symbol('tenant')
    const mountA = createMountPoint()
    const mountB = createMountPoint()

    const ContextReader = defineComponent({
      setup() {
        const tenant = inject(TENANT_KEY, 'missing')
        const cfg = useFsusConfig()
        const { t } = useFsusLocale()
        return () =>
          h(
            'span',
            { class: 'ctx-readout' },
            `${tenant}|${cfg.value.size ?? 'none'}|${t('common.confirm')}`,
          )
      },
    })

    const appA = createApp({ render: () => null })
    appA.use(createFsusUI({ components: [], size: 'sm', locale: en }))
    appA.provide(TENANT_KEY, 'alpha')
    appA.mount(mountA)

    const appB = createApp({ render: () => null })
    appB.use(createFsusUI({ components: [], size: 'lg', locale: zhCN }))
    appB.provide(TENANT_KEY, 'beta')
    appB.mount(mountB)

    cleanups.push(() => {
      appA.unmount()
      appB.unmount()
      mountA.remove()
      mountB.remove()
    })

    appA.runWithContext(() => useFsusMessage())({ message: h(ContextReader), duration: 0 })
    appB.runWithContext(() => useFsusMessage())({ message: h(ContextReader), duration: 0 })

    const readouts = Array.from(document.querySelectorAll('.ctx-readout')).map(
      (node) => node.textContent,
    )
    expect(readouts).toEqual([
      `alpha|sm|${en.common.confirm}`,
      `beta|lg|${zhCN.common.confirm}`,
    ])
  })

  it('invokes onClose at most once across explicit close, timeout, closeAll, close button, re-entrancy, and dispose', () => {
    vi.useFakeTimers()

    // 1. Explicit close + timeout + closeAll + dispose
    const service1 = createFsusMessageService()
    const cb1 = vi.fn(() => {
      // Re-entrant close inside onClose must not trigger a second call
      h1.close()
      service1.closeAll()
    })
    const h1 = service1({ message: 'Case 1', duration: 1000, onClose: cb1 })
    h1.close()
    h1.close()
    vi.advanceTimersByTime(2000)
    service1.closeAll()
    service1.dispose()
    service1.dispose()
    expect(cb1).toHaveBeenCalledTimes(1)

    // 2. Timeout followed by explicit close + dispose
    const service2 = createFsusMessageService()
    const cb2 = vi.fn()
    const h2 = service2({ message: 'Case 2', duration: 500, onClose: cb2 })
    vi.advanceTimersByTime(500)
    h2.close()
    service2.dispose()
    expect(cb2).toHaveBeenCalledTimes(1)

    // 3. Close button click followed by closeAll + dispose
    const service3 = createFsusMessageService()
    const cb3 = vi.fn()
    const h3 = service3({ message: 'Case 3', duration: 0, closable: true, onClose: cb3 })
    const closeBtn = document.querySelector<HTMLButtonElement>('.fsus-message__close')
    expect(closeBtn).not.toBeNull()
    closeBtn!.click()
    h3.close()
    service3.closeAll()
    service3.dispose()
    expect(cb3).toHaveBeenCalledTimes(1)

    // 4. App disposal closes pending message exactly once
    const service4 = createFsusMessageService()
    const cb4 = vi.fn()
    const h4 = service4({ message: 'Case 4', duration: 1000, onClose: cb4 })
    service4.dispose()
    h4.close()
    vi.advanceTimersByTime(2000)
    expect(cb4).toHaveBeenCalledTimes(1)
    expect(vi.getTimerCount()).toBe(0)
    expect(document.querySelectorAll('[data-fsus-message-host]')).toHaveLength(0)
  })

  it('repeated mount/unmount cycles leave zero extra DOM hosts or active timers', () => {
    vi.useFakeTimers()

    for (let cycle = 0; cycle < 5; cycle += 1) {
      const mountPoint = createMountPoint()
      const app = createApp({
        setup() {
          const message = useFsusMessage()
          onMounted(() => {
            message.info({ message: `Persistent ${cycle}`, duration: 0 })
            message.success({ message: `Timed ${cycle}`, duration: 10_000 })
          })
          return () => null
        },
      })
      app.use(createFsusUI({ components: [] }))
      app.mount(mountPoint)

      expect(document.querySelectorAll('[data-fsus-message-host]')).toHaveLength(1)
      expect(vi.getTimerCount()).toBe(1)

      app.unmount()
      mountPoint.remove()

      expect(document.querySelectorAll('[data-fsus-message-host]')).toHaveLength(0)
      expect(vi.getTimerCount()).toBe(0)
    }
  })
})
