import { computed, nextTick, provide } from 'vue'
import { mount } from '@vue/test-utils'
import { describe, expect, test, vi } from 'vitest'
import { uploadContextKey } from '../src/constants'
import UploadDragger from '../src/upload-dragger.vue'

const AXIOM = 'Rem is the best girl'

const _mount = (props: Record<string, unknown> = {}) =>
  mount({
    setup() {
      provide(uploadContextKey, { accept: computed(() => 'video/*') })
      return () => <UploadDragger {...props}>{AXIOM}</UploadDragger>
    },
  })

describe('<upload-dragger />', () => {
  describe('render test', () => {
    test('should render correct', () => {
      const wrapper = _mount()

      expect(wrapper.text()).toBe(AXIOM)
      expect(wrapper.find('.el-upload-dragger').exists()).toBe(true)
    })
  })

  describe('functionality', () => {
    test('onDrag works', async () => {
      const wrapper = _mount()
      const surface = wrapper.find('.el-upload-dragger')
      await surface.trigger('dragover')
      expect(surface.classes()).toContain('is-dragover')
      await surface.trigger('dragleave')
      expect(surface.classes()).not.toContain('is-dragover')
    })

    test('disabled blocks dragover and drop emission', async () => {
      const wrapper = _mount({ disabled: true })
      const surface = wrapper.find('.el-upload-dragger')
      const dragger = wrapper.findComponent(UploadDragger)

      await surface.trigger('dragover')
      expect(surface.classes()).not.toContain('is-dragover')

      await surface.trigger('drop', {
        dataTransfer: {
          files: [{ type: 'video/mp4', name: 'test.mp4' }],
        },
      })
      expect(dragger.emitted('file')).toBeUndefined()
    })

    test('ondrop works for any given video type', async () => {
      const onDrop = vi.fn()
      const wrapper = _mount({ onDrop })
      const dragger = wrapper.findComponent(UploadDragger)

      await dragger.trigger('drop', {
        dataTransfer: {
          files: [
            {
              type: 'video/mp4',
              name: 'test.mp4',
            },
          ],
        },
      })
      expect(onDrop).toHaveBeenCalledTimes(1)
      expect(dragger.emitted('file')).toHaveLength(1)
      await dragger.trigger('drop', {
        dataTransfer: {
          files: [
            {
              type: 'video/mov',
              name: 'test.mov',
            },
          ],
        },
      })
      expect(dragger.emitted('file')).toHaveLength(2)
    })

    test('drop clears dragover state without mutating accept filtering', async () => {
      const wrapper = _mount()
      const surface = wrapper.find('.el-upload-dragger')
      const dragger = wrapper.findComponent(UploadDragger)

      await surface.trigger('dragover')
      expect(surface.classes()).toContain('is-dragover')

      await surface.trigger('drop', {
        dataTransfer: {
          files: [
            { type: 'image/png', name: 'skip.png' },
            { type: 'video/webm', name: 'keep.webm' },
          ],
        },
      })
      await nextTick()

      expect(surface.classes()).not.toContain('is-dragover')
      const emitted = dragger.emitted('file')
      expect(emitted).toHaveLength(1)
      expect(emitted![0][0]).toEqual([
        expect.objectContaining({ name: 'keep.webm' }),
      ])
    })
  })
})
