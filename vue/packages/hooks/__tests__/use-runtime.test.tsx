import { createSSRApp, defineComponent, effectScope, nextTick, ref } from 'vue'
import { renderToString } from '@vue/server-renderer'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useMutationObserver, useResizeObserver } from '../use-runtime'

describe('use-runtime observers', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('does not evaluate the browser Element constructor during SSR', async () => {
    vi.stubGlobal('Element', undefined)

    const Probe = defineComponent(() => {
      const target = ref<HTMLElement>()
      useResizeObserver(target, () => undefined)
      useMutationObserver(target, () => undefined)
      return () => <div ref={target}>SSR observer probe</div>
    })

    await expect(renderToString(createSSRApp(Probe))).resolves.toContain(
      'SSR observer probe',
    )
  })

  it.each([
    ['ResizeObserver', useResizeObserver],
    ['MutationObserver', useMutationObserver],
  ] as const)(
    'reconnects %s on target changes and stops with its scope',
    async (name, useObserver) => {
      const instances: Observer[] = []
      const callback = vi.fn()
      class Observer {
        observe = vi.fn()
        disconnect = vi.fn()

        constructor(readonly onChange: unknown) {
          instances.push(this)
        }
      }
      vi.stubGlobal(name, Observer)

      const initial = document.createElement('div')
      const updated = document.createElement('div')
      const target = ref(initial)
      const options = { box: 'border-box', childList: true } as const
      const scope = effectScope()
      const result = scope.run(() => useObserver(target, callback, options))

      expect(result?.isSupported.value).toBe(true)
      expect(instances[0].onChange).toBe(callback)
      expect(instances[0].observe).toHaveBeenCalledWith(initial, options)

      target.value = updated
      await nextTick()
      expect(instances[0].disconnect).toHaveBeenCalledOnce()
      expect(instances[1].observe).toHaveBeenCalledWith(updated, options)

      scope.stop()
      expect(instances[1].disconnect).toHaveBeenCalledOnce()
      target.value = initial
      await nextTick()
      expect(instances).toHaveLength(2)
    },
  )
})
