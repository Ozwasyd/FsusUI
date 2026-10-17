import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { describe, expect, test, vi } from 'vitest'
import ResizeSeparatorAuditFixture from '../../../demo-app/src/ResizeSeparatorAuditFixture.vue'

// Real public components; local geometry/capture simulation is not browser proof.
const pointer = async (element: Element, type: string, clientX: number) => {
  const event = new Event(type, { bubbles: true, cancelable: true })
  Object.assign(event, { pointerId: 7, isPrimary: true, button: 0, clientX })
  element.dispatchEvent(event)
  await nextTick()
}

const rect = (left: number, top: number, width: number, height: number) =>
  ({
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
  }) as DOMRect

const render = async () => {
  const wrapper = mount(ResizeSeparatorAuditFixture, {
    attachTo: document.body,
  })
  const vertical = wrapper.get('[data-resize-frame="vertical"]')
  const horizontal = wrapper.get('[data-resize-frame="horizontal"]')
  vi.spyOn(vertical.element, 'getBoundingClientRect').mockReturnValue(
    rect(100, 100, 400, 120),
  )
  vi.spyOn(horizontal.element, 'getBoundingClientRect').mockReturnValue(
    rect(100, 250, 400, 200),
  )
  vi.spyOn(
    vertical.element.children[1],
    'getBoundingClientRect',
  ).mockReturnValue(rect(280, 100, 40, 120))
  vi.spyOn(
    horizontal.element.children[1],
    'getBoundingClientRect',
  ).mockReturnValue(rect(100, 330, 400, 40))
  await vertical.trigger('keydown', { key: 'Tab' })
  return { wrapper, vertical, horizontal }
}

describe('ResizeSeparator real audit fixture', () => {
  test('mounts both public orientations with actual region associations', async () => {
    const { wrapper } = await render()
    const handles = wrapper.findAll('[role="separator"]')
    expect(handles).toHaveLength(2)
    for (const [index, orientation] of ['vertical', 'horizontal'].entries()) {
      expect(handles[index].attributes('aria-orientation')).toBe(orientation)
      expect(handles[index].attributes('aria-valuenow')).toBe('0.5')
      expect(handles[index].attributes('aria-disabled')).toBeUndefined()
      const regions = handles[index].attributes('aria-controls').split(' ')
      expect(regions).toHaveLength(2)
      for (const region of regions)
        expect(document.getElementById(region)).not.toBeNull()
    }
  })

  test('accepts keyboard proposals independently and reaches both closed bounds', async () => {
    const { wrapper, vertical, horizontal } = await render()
    const first = vertical.get('[role="separator"]')
    const second = horizontal.get('[role="separator"]')
    await first.trigger('keydown', { key: 'ArrowRight' })
    expect(first.attributes('aria-valuenow')).toBe('0.55')
    expect(second.attributes('aria-valuenow')).toBe('0.5')
    expect(vertical.attributes('style')).toContain('0.55fr')
    await second.trigger('keydown', { key: 'ArrowUp' })
    expect(second.attributes('aria-valuenow')).toBe('0.45')
    await first.trigger('keydown', { key: 'Home' })
    expect(first.attributes('aria-valuenow')).toBe('0.2')
    await first.trigger('keydown', { key: 'End' })
    expect(first.attributes('aria-valuenow')).toBe('0.8')
    expect(wrapper.get('output').text()).toContain(
      'Vertical 0.8; horizontal 0.45',
    )
  })

  test('uses the owned frame mapping for pointer proposals and releases capture', async () => {
    const { vertical } = await render()
    const handle = vertical.get('[role="separator"]')
    const captured = new Set<number>()
    const release = vi.fn((id: number) => captured.delete(id))
    Object.assign(handle.element, {
      setPointerCapture: (id: number) => captured.add(id),
      hasPointerCapture: (id: number) => captured.has(id),
      releasePointerCapture: release,
    })
    await pointer(handle.element, 'pointerdown', 300)
    expect(captured.has(7)).toBe(true)
    await pointer(handle.element, 'pointermove', 354)
    expect(handle.attributes('aria-valuenow')).toBe('0.65')
    await pointer(handle.element, 'pointerup', 354)
    expect(release).toHaveBeenCalledExactlyOnceWith(7)
    expect(captured.size).toBe(0)
  })

  test('public disabled control disables both handles and blocks proposals', async () => {
    const { wrapper } = await render()
    await wrapper.get('input[type="checkbox"]').setValue(true)
    for (const handle of wrapper.findAll('[role="separator"]')) {
      expect(handle.attributes('aria-disabled')).toBe('true')
      expect(handle.attributes('tabindex')).toBe('-1')
      await handle.trigger('keydown', { key: 'End' })
      expect(handle.attributes('aria-valuenow')).toBe('0.5')
    }
  })
})
