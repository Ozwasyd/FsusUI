import { nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { describe, expect, test } from 'vitest'
import { IMAGE_SUCCESS } from '@element-plus/test-utils/mock'
import ImageViewer from '../src/image-viewer.vue'

async function doubleWait() {
  await nextTick()
  await nextTick()
}

describe('<image-viewer />', () => {
  test('big image preview', async () => {
    const wrapper = mount(<ImageViewer urlList={[IMAGE_SUCCESS]} />)

    await doubleWait()
    const viewer = wrapper.find('.el-image-viewer__wrapper')
    expect(viewer.exists()).toBe(true)
    await wrapper.find('.el-image-viewer__close').trigger('click')
    expect(wrapper.emitted('close')).toEqual([[]])
    wrapper.unmount()
  })

  test('image preview hide-click-on-modal', async () => {
    const wrapper = mount(<ImageViewer urlList={[IMAGE_SUCCESS]} />)

    await doubleWait()
    const viewer = wrapper.find('.el-image-viewer__wrapper')
    expect(viewer.exists()).toBe(true)
    await wrapper.find('.el-image-viewer__mask').trigger('click')
    expect(wrapper.emitted('close')).toBeUndefined()

    await wrapper.setProps({
      hideOnClickModal: true,
    })

    await wrapper.find('.el-image-viewer__mask').trigger('click')
    expect(wrapper.emitted('close')).toBeDefined()
    wrapper.unmount()
  })

  test('manually switch image', async () => {
    const wrapper = mount(
      <ImageViewer urlList={[IMAGE_SUCCESS, IMAGE_SUCCESS]} />
    )

    await doubleWait()
    const viewer = wrapper.find('.el-image-viewer__wrapper')
    expect(viewer.exists()).toBe(true)

    const imgList = wrapper.findAll('.el-image-viewer__img')
    expect(imgList[0].attributes('style')).not.contains('display: none;')
    expect(imgList[1].attributes('style')).contains('display: none;')

    ;(wrapper.vm as any).setActiveItem(1)
    await doubleWait()
    expect(imgList[0].attributes('style')).contains('display: none;')
    expect(imgList[1].attributes('style')).not.contains('display: none;')
    wrapper.unmount()
  })
})

describe('<image-viewer /> keyboard and pointer scope', () => {
  test('closes on document escape even when wrapper is not focused', async () => {
    const wrapper = mount(<ImageViewer urlList={[IMAGE_SUCCESS]} />)

    await doubleWait()
    document.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape' }))
    await doubleWait()

    expect(wrapper.emitted('close')).toEqual([[]])
    wrapper.unmount()
  })

  test('does not close on document escape when closeOnPressEscape is false', async () => {
    const wrapper = mount(
      <ImageViewer urlList={[IMAGE_SUCCESS]} closeOnPressEscape={false} />
    )

    await doubleWait()
    document.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape' }))
    await doubleWait()

    expect(wrapper.emitted('close')).toBeUndefined()
    wrapper.unmount()
  })

  test('arrow and zoom shortcuts only work on wrapper keydown', async () => {
    const wrapper = mount(
      <ImageViewer urlList={[IMAGE_SUCCESS, IMAGE_SUCCESS]} />
    )

    await doubleWait()
    const viewer = wrapper.find('.el-image-viewer__wrapper')
    const vm = wrapper.vm as any
    vm.loading = false

    document.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowRight' }))
    await doubleWait()
    expect(vm.activeIndex).toBe(0)

    await viewer.trigger('keydown', { code: 'ArrowRight' })
    await doubleWait()
    expect(vm.activeIndex).toBe(1)

    const scaleBeforeWrapperZoom = vm.transform.scale
    document.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowUp' }))
    await doubleWait()
    expect(vm.transform.scale).toBe(scaleBeforeWrapperZoom)

    await viewer.trigger('keydown', { code: 'ArrowUp' })
    await doubleWait()
    expect(vm.transform.scale).toBeGreaterThan(scaleBeforeWrapperZoom)
    wrapper.unmount()
  })

  test('wheel zoom only works on wrapper', async () => {
    const wrapper = mount(<ImageViewer urlList={[IMAGE_SUCCESS]} />)

    await doubleWait()
    const viewer = wrapper.find('.el-image-viewer__wrapper')
    const vm = wrapper.vm as any
    vm.loading = false
    const initialScale = vm.transform.scale

    document.dispatchEvent(
      new WheelEvent('wheel', { deltaY: -120, cancelable: true })
    )
    await doubleWait()
    expect(vm.transform.scale).toBe(initialScale)

    await viewer.trigger('wheel', { deltaY: -120 })
    await doubleWait()
    expect(vm.transform.scale).toBeGreaterThan(initialScale)
    wrapper.unmount()
  })
})
