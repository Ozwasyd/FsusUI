import { h, nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { afterAll, beforeAll, expect, it, vi } from 'vitest'
import { DynamicSizeList } from '..'
import setupMock from '../setup-mock'
import type { CSSProperties } from 'vue'

const { pending, estimateRowHeights } = vi.hoisted(() => {
  type Estimate = { ok: true; value: number[] }
  const pending: Array<(result: Estimate) => void> = []
  return {
    pending,
    estimateRowHeights: vi.fn(
      () => new Promise<Estimate>((resolve) => pending.push(resolve)),
    ),
  }
})
vi.mock('@element-plus/wasm', () => ({ estimateRowHeights }))
let cleanup: () => void
beforeAll(() => {
  cleanup = setupMock()
})
afterAll(() => cleanup())
const settle = async () => {
  for (let i = 0; i < 5; i++) {
    await Promise.resolve()
    await nextTick()
  }
}
const create = () =>
  mount(DynamicSizeList, {
    props: {
      data: Array.from({ length: 3000 }, (_, i) => ({ label: `Row ${i}` })),
      total: 3000,
      height: 240,
      width: 320,
      itemSize: () => 20,
      estimatedItemSize: 20,
    },
    slots: {
      default: ({ index, style }: { index: number; style: CSSProperties }) =>
        h('div', { 'data-row-index': String(index), style }, String(index)),
    },
  })

it('refreshes completed background row metadata without replacing visible row DOM', async () => {
  pending.length = 0
  const wrapper = create()
  try {
    await settle()
    expect(pending).toHaveLength(1)
    const first = wrapper.find('[data-row-index="0"]').element as HTMLElement
    expect(first.style.height).toBe('20px')
    expect(Number.parseFloat(wrapper.vm.innerRef.style.height)).toBe(60000)
    pending[0]({
      ok: true,
      value: Array.from({ length: 3000 }, (_, i) => 38 + (i % 4) * 22),
    })
    await settle()
    expect(wrapper.find('[data-row-index="0"]').element).toBe(first)
    expect(first.style.height).toBe('38px')
    expect(
      (wrapper.find('[data-row-index="1"]').element as HTMLElement).style.top,
    ).toBe('38px')
    expect(Number.parseFloat(wrapper.vm.innerRef.style.height)).toBe(213000)
    wrapper.vm.scrollToItem(1500, 'start')
    await settle()
    expect(wrapper.vm.states.scrollOffset).toBe(106500)
    expect(
      (wrapper.find('[data-row-index="1500"]').element as HTMLElement).style
        .top,
    ).toBe('106500px')
    wrapper.vm.resetAfterIndex(1400, true)
    await settle()
    expect(wrapper.vm.states.scrollOffset).toBe(106500)
    for (const row of wrapper.findAll('[data-row-index]')) {
      expect((row.element as HTMLElement).style.height).toBe('20px')
    }
  } finally {
    wrapper.unmount()
  }
})

it('preserves a random-access scroll offset while estimates are pending and after publication', async () => {
  pending.length = 0
  const wrapper = create()
  try {
    await settle()
    wrapper.vm.scrollToItem(2000, 'start')
    await settle()
    expect(wrapper.vm.states.scrollOffset).toBe(40000)
    expect(
      (wrapper.find('[data-row-index="2000"]').element as HTMLElement).style
        .top,
    ).toBe('40000px')
    pending[0]({
      ok: true,
      value: Array.from({ length: 3000 }, (_, i) => 38 + (i % 3) * 22),
    })
    await settle()
    expect(wrapper.vm.states.scrollOffset).toBe(40000)
    expect(Number.parseFloat(wrapper.vm.innerRef.style.height)).toBe(180000)
    wrapper.vm.scrollToItem(2999, 'end')
    await settle()
    expect(wrapper.vm.states.scrollOffset).toBe(179760)
    expect(
      (wrapper.find('[data-row-index="2999"]').element as HTMLElement).style
        .height,
    ).toBe('82px')
  } finally {
    wrapper.unmount()
  }
})
