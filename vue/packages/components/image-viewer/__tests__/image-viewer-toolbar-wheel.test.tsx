import { nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { describe, expect, test } from 'vitest'
import { IMAGE_SUCCESS } from '@element-plus/test-utils/mock'
import ImageViewer from '../src/image-viewer.vue'

describe('ImageViewer toolbar wheel ownership', () => {
  test.each([
    '.el-image-viewer__actions',
    '.el-image-viewer__action',
    '.el-image-viewer__action svg',
  ])(
    'preserves native scrolling over %s while the canvas still zooms',
    async (selector) => {
      const wrapper = mount(<ImageViewer urlList={[IMAGE_SUCCESS]} />)
      try {
        await wrapper.get('img').trigger('load')
        const image = wrapper.get('img')
        const initialStyle = image.attributes('style')
        for (const delta of [{ deltaY: 120 }, { deltaX: -120 }]) {
          const wheel = new WheelEvent('wheel', {
            ...delta,
            bubbles: true,
            cancelable: true,
          })
          wrapper.get(selector).element.dispatchEvent(wheel)
          await nextTick()
          expect(wheel.defaultPrevented).toBe(false)
          expect(image.attributes('style')).toBe(initialStyle)
        }

        const canvasWheel = new WheelEvent('wheel', {
          deltaY: -120,
          bubbles: true,
          cancelable: true,
        })
        wrapper
          .get('.el-image-viewer__canvas')
          .element.dispatchEvent(canvasWheel)
        await nextTick()
        expect(canvasWheel.defaultPrevented).toBe(true)
        expect(image.attributes('style')).not.toBe(initialStyle)
      } finally {
        wrapper.unmount()
      }
    },
  )
})
