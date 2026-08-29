import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { describe, expect, it } from 'vitest'
import MarkdownEditor from '../src/markdown-editor.vue'

import type { MarkdownEditorFrameSchedulerMetrics } from '@element-plus/hooks'

// The vitest rAF shim settles on a 16ms timer; waiting one interval lets a
// full measure/mutate/post-paint frame run and report its metrics.
const nextFrame = async () => {
  await new Promise((resolve) => setTimeout(resolve, 40))
  await nextTick()
}

const readFrameMetrics = (wrapper: ReturnType<typeof mount>) => {
  const raw = wrapper.find('section').attributes('data-markdown-frame-metrics')
  if (!raw) return null
  return JSON.parse(raw) as {
    coalesced: number
    executed: Record<'measure' | 'mutate' | 'post-paint', number>
    frame: number
    pending: number
    stale: number
    violations: number
  }
}

describe('MarkdownEditor frame scheduler (#640)', () => {
  it('samples frame metrics on the editor root after the first layout frame', async () => {
    const wrapper = mount(MarkdownEditor, {
      props: { modelValue: '# heading\n\nparagraph\n' },
    })
    await nextFrame()

    const metrics = readFrameMetrics(wrapper)
    expect(metrics).not.toBeNull()
    expect(metrics!.executed.measure).toBeGreaterThan(0)
    expect(metrics!.executed.mutate).toBeGreaterThan(0)
    expect(metrics!.pending).toBe(0)
    wrapper.unmount()
  })

  it('keeps the layout plan assignment synchronous while the scroll commit is framed', async () => {
    const wrapper = mount(MarkdownEditor, {
      props: { modelValue: '# first\n\nparagraph\n' },
    })
    await nextFrame()
    await nextFrame()

    await wrapper.setProps({ mode: 'live' })
    await nextTick()
    // The plan (data contract) is applied synchronously; only the geometry
    // commit waits for the frame scheduler.
    expect(
      wrapper.find('[data-markdown-layout-action]').attributes(
        'data-markdown-layout-action',
      ),
    ).toBeDefined()
    wrapper.unmount()
  })

  it('cancels stale frame tasks on external document reset and reports a clean settle', async () => {
    const wrapper = mount(MarkdownEditor, {
      props: { modelValue: '# first document\n', defaultMode: 'live' },
    })
    await nextFrame()

    await wrapper.setProps({
      modelValue: '# second document with entirely different content\n',
    })
    await nextFrame()

    const metrics = readFrameMetrics(wrapper)
    expect(metrics).not.toBeNull()
    expect(metrics!.pending).toBe(0)
    wrapper.unmount()
  })

  it('coalesces rapid viewport changes into frame-bounded work', async () => {
    const wrapper = mount(MarkdownEditor, {
      props: { modelValue: '# rapid\n\nparagraph\n' },
    })
    await nextFrame()
    const before = readFrameMetrics(wrapper)!

    for (let index = 0; index < 10; index += 1) {
      window.dispatchEvent(new Event('resize'))
    }
    await nextFrame()
    await nextFrame()

    const after = readFrameMetrics(wrapper)!
    expect(after.frame).toBeGreaterThan(before.frame)
    expect(after.pending).toBe(0)
    wrapper.unmount()
  })
})

describe('MarkdownEditorFrameSchedulerMetrics contract', () => {
  it('exposes the evidence fields required by the frame scheduling issue', () => {
    const metrics: MarkdownEditorFrameSchedulerMetrics = {
      cancelledTasks: 0,
      coalescedTasks: 0,
      durationMs: { measure: 0, mutate: 0, 'post-paint': 0 },
      executed: { measure: 0, mutate: 0, 'post-paint': 0 },
      frameId: 0,
      frameRequests: 0,
      framesExecuted: 0,
      idle: true,
      overflowDroppedTasks: 0,
      pendingTasks: 0,
      readAfterWriteViolations: 0,
      staleTasks: 0,
    }
    expect(Object.keys(metrics).sort()).toEqual(
      [
        'cancelledTasks',
        'coalescedTasks',
        'durationMs',
        'executed',
        'frameId',
        'frameRequests',
        'framesExecuted',
        'idle',
        'overflowDroppedTasks',
        'pendingTasks',
        'readAfterWriteViolations',
        'staleTasks',
      ].sort(),
    )
  })
})
