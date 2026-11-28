import { createSSRApp, defineComponent, h } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createFsusMessageService, createFsusUI, FsusMessage, useFsusMessage } from '../index'

describe('#1152 FsusMessage server-side (SSR) behavior without DOM', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('creates no timers or durable queues across SSR renders and keeps close() idempotent', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('window', undefined)
    vi.stubGlobal('document', undefined)
    expect(typeof window).toBe('undefined')
    expect(typeof document).toBe('undefined')

    const closeCounts = { a: 0, b: 0, global: 0 }

    const makeApp = (label: 'a' | 'b') => {
      const Comp = defineComponent({
        setup() {
          const message = useFsusMessage()
          const handle = message.info({
            message: `SSR ${label}`,
            duration: 5000,
            onClose: () => {
              closeCounts[label] += 1
            },
          })
          // Explicit close on SSR handle runs onClose at most once
          handle.close()
          handle.close()

          // Second unclosed message with a timer must not allocate a timer or outlive SSR
          message.warning({ message: `SSR pending ${label}`, duration: 5000 })
          return () => h('div', `rendered-${label}`)
        },
      })
      const app = createSSRApp(Comp)
      app.use(createFsusUI({ components: [] }))
      return app
    }

    const [htmlA, htmlB] = await Promise.all([
      renderToString(makeApp('a')),
      renderToString(makeApp('b')),
    ])
    expect(htmlA).toContain('rendered-a')
    expect(htmlB).toContain('rendered-b')

    const globalHandle = FsusMessage({
      message: 'SSR global',
      duration: 5000,
      onClose: () => {
        closeCounts.global += 1
      },
    })
    globalHandle.close()
    globalHandle.close()

    const manual = createFsusMessageService()
    const manualClose = vi.fn()
    manual.success({ message: 'SSR manual', duration: 5000, onClose: manualClose })
    manual.closeAll()
    manual.dispose()

    expect(closeCounts).toEqual({ a: 1, b: 1, global: 1 })
    expect(manualClose).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
  })
})
