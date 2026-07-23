import { createSSRApp, defineComponent, ref } from 'vue'
import { renderToString } from '@vue/server-renderer'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useMutationObserver, useResizeObserver } from '../use-runtime'

describe('use-runtime SSR boundaries', () => {
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
})
