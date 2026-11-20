import { nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { describe, expect, test, vi } from 'vitest'
import ImageViewer from '../src/image-viewer.vue'

const settle = async () => {
  await nextTick()
  await nextTick()
  await nextTick()
}
const urls = ['first.svg', 'second.svg']

describe('ImageViewer public modal contract', () => {
  test('names the dialog, images and caption and supports navigation-only composition', async () => {
    const wrapper = mount(ImageViewer, {
      props: {
        urlList: urls,
        altList: ['First figure', 'Second figure'],
        ariaLabel: 'Article images',
        showToolbar: false,
        labels: { close: 'Dismiss', previous: 'Back', next: 'Forward' },
      },
      slots: {
        caption: ({ alt, index }: { alt: string; index: number }) =>
          `${index}: ${alt}`,
      },
    })
    await settle()
    const dialog = wrapper.find('[role="dialog"]')
    expect(dialog.attributes('aria-modal')).toBe('true')
    expect(dialog.attributes('aria-label')).toBe('Article images')
    const caption = wrapper.find(`#${dialog.attributes('aria-describedby')}`)
    expect(caption.text()).toBe('0: First figure')
    expect(wrapper.find('img').attributes('alt')).toBe('First figure')
    expect(
      wrapper.findAll('[role="button"]').map((x) => x.attributes('aria-label')),
    ).toEqual(['Dismiss', 'Back', 'Forward'])
    await wrapper.find('[aria-label="Forward"]').trigger('click')
    await settle()
    expect(caption.text()).toBe('1: Second figure')
    expect(wrapper.emitted('next')).toEqual([[1]])
    await wrapper.find('[aria-label="Back"]').trigger('click')
    expect(wrapper.emitted('previous')).toEqual([[0]])
    wrapper.unmount()
  })

  test('synchronizes reactive index and shrinking/empty lists without NaN', async () => {
    const wrapper = mount(ImageViewer, {
      props: { urlList: urls, activeIndex: 0 },
    })
    await wrapper.setProps({ activeIndex: 1 })
    expect(wrapper.emitted('switch')).toEqual([[1]])
    await wrapper.setProps({ urlList: ['first.svg'] })
    expect(wrapper.emitted('update:activeIndex')).toEqual([[1], [0]])
    await wrapper.setProps({ urlList: [] })
    wrapper.vm.setActiveItem(-10)
    await settle()
    expect(wrapper.findAll('img')).toHaveLength(0)
    expect(wrapper.emitted('switch')).toEqual([[1], [0]])
    wrapper.unmount()
  })

  test('restores application inert state and nested modal ownership on interrupted disposal', async () => {
    const background = document.createElement('button')
    const original = document.createElement('div')
    original.setAttribute('inert', 'application')
    document.body.append(background, original)
    const first = mount(ImageViewer, {
      attachTo: document.body,
      props: { urlList: urls },
    })
    await settle()
    expect(background.hasAttribute('inert')).toBe(true)
    const second = mount(ImageViewer, {
      attachTo: document.body,
      props: { urlList: urls },
    })
    await settle()
    expect(
      first.find('[role="dialog"]').element.closest('[inert]'),
    ).not.toBeNull()
    expect(second.find('[role="dialog"]').element.closest('[inert]')).toBeNull()
    second.unmount()
    await settle()
    expect(first.find('[role="dialog"]').element.closest('[inert]')).toBeNull()
    expect(background.hasAttribute('inert')).toBe(true)
    first.unmount()
    await settle()
    expect(background.hasAttribute('inert')).toBe(false)
    expect(original.getAttribute('inert')).toBe('application')
    background.remove()
    original.remove()
  })

  test('reopens the same instance and cleans Escape and scroll ownership', async () => {
    const onClose = vi.fn()
    const wrapper = mount(ImageViewer, {
      attachTo: document.body,
      props: { visible: false, urlList: urls, onClose },
    })
    await wrapper.setProps({ visible: true })
    await settle()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await settle()
    expect(wrapper.emitted('close')).toHaveLength(1)
    await wrapper.setProps({ visible: false })
    await wrapper.setProps({ visible: true })
    await settle()
    await wrapper
      .find('[role="dialog"]')
      .trigger('keydown', { code: 'ArrowRight' })
    expect(wrapper.emitted('next')).toEqual([[1]])
    wrapper.unmount()
    await settle()
    await new Promise((resolve) => setTimeout(resolve, 250))
    expect(document.body.classList.contains('el-popup-parent--hidden')).toBe(
      false,
    )
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
