import { nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { describe, expect, test, vi } from 'vitest'
import ImageViewer from '../src/image-viewer.vue'

const urls = [
  'data:image/svg+xml,<svg/>#first',
  'data:image/svg+xml,<svg/>#second',
]
const settle = async () => {
  await nextTick()
  await nextTick()
  await nextTick()
}
const complete = (image: HTMLImageElement, value: boolean) => {
  Object.defineProperty(image, 'complete', { configurable: true, value })
}
const mountViewer = () =>
  mount(ImageViewer, {
    props: {
      urlList: urls,
      activeIndex: 0,
      altList: ['First figure', ''],
      labels: { zoomIn: 'Zoom in', toggleMode: 'Original size' },
    },
  })
const loadedFirst = async () => {
  const wrapper = mountViewer()
  const images = wrapper.findAll('img')
  complete(images[0].element, true)
  complete(images[1].element, false)
  await images[0].trigger('load')
  await settle()
  return { wrapper, images }
}

describe('ImageViewer current-image loading state', () => {
  test.each(['zoom', 'original size', 'drag'])(
    'cached current image enables %s while another image is pending',
    async (action) => {
      const { wrapper, images } = await loadedFirst()
      await wrapper.setProps({ activeIndex: 1 })
      await settle()
      await wrapper.setProps({ activeIndex: 0 })
      await settle()

      if (action === 'zoom') {
        await wrapper.get('[aria-label="Zoom in"]').trigger('click')
        expect(images[0].element.style.transform).toContain('scale(1.2)')
      } else if (action === 'original size') {
        await wrapper.get('[aria-label="Original size"]').trigger('click')
        expect(images[0].element.style.maxWidth).toBe('none')
        await wrapper.get('[aria-label="Original size"]').trigger('click')
        expect(images[0].element.style.maxWidth).toBe('100%')
      } else {
        images[0].element.dispatchEvent(
          new MouseEvent('mousedown', {
            button: 0,
            clientX: 10,
            clientY: 20,
            bubbles: true,
          }),
        )
        document.dispatchEvent(
          new MouseEvent('mousemove', {
            clientX: 60,
            clientY: 70,
            bubbles: true,
          }),
        )
        await settle()
        try {
          expect(images[0].element.style.transform).toContain(
            'translate(50px, 50px)',
          )
        } finally {
          document.dispatchEvent(new MouseEvent('mouseup'))
        }
      }
      expect(images[1].element.complete).toBe(false)
      wrapper.unmount()
    },
  )

  test.each(['load', 'error'])(
    'hidden image %s cannot unlock the pending current image',
    async (event) => {
      const { wrapper, images } = await loadedFirst()
      await wrapper.setProps({ activeIndex: 1 })
      await settle()
      await images[0].trigger(event)
      await wrapper.get('[aria-label="Zoom in"]').trigger('click')
      expect(images[1].element.style.transform).toContain('scale(1)')
      expect(images[0].attributes('alt')).toBe('First figure')

      complete(images[1].element, true)
      await images[1].trigger('load')
      await wrapper.get('[aria-label="Zoom in"]').trigger('click')
      expect(images[1].element.style.transform).toContain('scale(1.2)')
      wrapper.unmount()
    },
  )

  test.each(['load', 'error'])(
    'current image %s unlocks controls and retains error-alt semantics',
    async (event) => {
      const { wrapper, images } = await loadedFirst()
      await wrapper.setProps({ activeIndex: 1 })
      await settle()
      complete(images[1].element, true)
      await images[1].trigger(event)
      await wrapper.get('[aria-label="Zoom in"]').trigger('click')
      expect(images[1].element.style.transform).toContain('scale(1.2)')
      if (event === 'error') expect(images[1].attributes('alt')).not.toBe('')
      else expect(images[1].attributes('alt')).toBe('')
      wrapper.unmount()
    },
  )

  test('initially cached image enables controls without waiting for a load event', async () => {
    const cache = vi
      .spyOn(HTMLImageElement.prototype, 'complete', 'get')
      .mockReturnValue(true)
    try {
      const wrapper = mountViewer()
      await settle()
      await wrapper.get('[aria-label="Zoom in"]').trigger('click')
      expect(wrapper.get('img').element.style.transform).toContain('scale(1.2)')
      wrapper.unmount()
    } finally {
      cache.mockRestore()
    }
  })

  test('same-URL navigation blocks pending keyboard zoom and enables it after completion', async () => {
    const wrapper = mount(ImageViewer, {
      props: { urlList: [urls[0], urls[0]] },
    })
    const images = wrapper.findAll('img')
    complete(images[0].element, true)
    complete(images[1].element, false)
    await images[0].trigger('load')
    const viewer = wrapper.get('.el-image-viewer__wrapper')
    await viewer.trigger('keydown', { code: 'ArrowRight' })
    await settle()
    expect(images[1].element.style.display).not.toBe('none')
    await viewer.trigger('keydown', { code: 'ArrowUp' })
    expect(images[1].element.style.transform).toContain('scale(1)')

    complete(images[1].element, true)
    await images[1].trigger('load')
    document.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowUp' }))
    await settle()
    expect(images[1].element.style.transform).toContain('scale(1)')
    await viewer.trigger('keydown', { code: 'ArrowUp' })
    expect(images[1].element.style.transform).toContain('scale(1.2)')
    wrapper.unmount()
  })

  test('a remounted cached image clears the previous pending loading state', async () => {
    const { wrapper } = await loadedFirst()
    await wrapper.setProps({ activeIndex: 1 })
    await settle()
    await wrapper.setProps({ visible: false })
    const cache = vi
      .spyOn(HTMLImageElement.prototype, 'complete', 'get')
      .mockReturnValue(true)
    try {
      await wrapper.setProps({ visible: true })
      await settle()
      await wrapper.get('[aria-label="Zoom in"]').trigger('click')
      expect(wrapper.findAll('img')[1].element.style.transform).toContain(
        'scale(1.2)',
      )
      wrapper.unmount()
    } finally {
      cache.mockRestore()
    }
  })

  test('replacement current image stays blocked until its own completion', async () => {
    const { wrapper, images } = await loadedFirst()
    await wrapper.setProps({
      urlList: ['data:image/svg+xml,<svg/>#replacement', urls[1]],
    })
    const replacement = wrapper.findAll('img')[0]
    complete(replacement.element, false)
    await settle()
    images[0].element.dispatchEvent(new Event('load'))
    await wrapper.get('[aria-label="Zoom in"]').trigger('click')
    expect(replacement.element.style.transform).toContain('scale(1)')
    complete(replacement.element, true)
    await replacement.trigger('load')
    await wrapper.get('[aria-label="Zoom in"]').trigger('click')
    expect(replacement.element.style.transform).toContain('scale(1.2)')
    wrapper.unmount()
  })

  test('hidden failures keep the fallback alt without changing current loading', async () => {
    const { wrapper, images } = await loadedFirst()
    complete(images[0].element, false)
    await images[1].trigger('error')
    expect(images[1].attributes('alt')).not.toBe('')
    await wrapper.setProps({ activeIndex: 1 })
    await settle()
    await images[0].trigger('error')
    await wrapper.get('[aria-label="Zoom in"]').trigger('click')
    expect(images[1].element.style.transform).toContain('scale(1)')
    wrapper.unmount()
  })

  test('events from a disposed viewer cannot unlock a new pending viewer', async () => {
    const first = await loadedFirst()
    first.wrapper.unmount()
    const wrapper = mountViewer()
    const image = wrapper.findAll('img')[0]
    complete(image.element, false)
    await settle()
    first.images[0].element.dispatchEvent(new Event('load'))
    first.images[0].element.dispatchEvent(new Event('error'))
    await wrapper.get('[aria-label="Zoom in"]').trigger('click')
    expect(image.element.style.transform).toContain('scale(1)')
    await wrapper.get('.el-image-viewer__close').trigger('click')
    expect(wrapper.emitted('close')).toEqual([[]])
    wrapper.unmount()
  })
})
