import { describe, expect, test, vi } from 'vitest'
import { clickCloseButton } from '../../../test-utils/dom'
import { EVENT_CODE } from '@element-plus/constants'

import makeMount from '@element-plus/test-utils/make-mount'
import UploadList from '../src/upload-list.vue'
import type { UploadFile, UploadUserFile } from '../src/upload'

const testName = 'test name'

const makeFile = (
  overrides: Partial<UploadFile> & Pick<UploadUserFile, 'name'> = {
    name: testName,
  },
): UploadFile =>
  ({
    name: overrides.name,
    uid: overrides.uid ?? 1,
    status: overrides.status ?? 'success',
    percentage: overrides.percentage,
    url: overrides.url,
    raw: overrides.raw,
    size: overrides.size,
    response: overrides.response,
  }) as UploadFile

const mount = makeMount(UploadList, {
  props: {
    files: [makeFile({ name: testName })],
  },
})

describe('<upload-list />', () => {
  describe('render test', () => {
    test('should render correct', () => {
      const wrapper = mount({
        slots: {
          default: ({ file }: { file: File }) => <div>{file.name}</div>,
        },
      })
      expect(wrapper.text()).toContain(testName)
    })

    test('text list renders flat status and always-visible remove (#456)', () => {
      const wrapper = mount({
        props: {
          listType: 'text',
          files: [
            makeFile({ name: 'report.pdf', status: 'success', uid: 1 }),
            makeFile({
              name: 'cover.png',
              status: 'uploading',
              percentage: 62,
              uid: 2,
            }),
            makeFile({ name: 'archive.zip', status: 'fail', uid: 3 }),
          ],
        },
      })

      const items = wrapper.findAll('.el-upload-list__item')
      expect(items).toHaveLength(3)
      expect(wrapper.classes()).toContain('el-upload-list--text')

      // Status text/icons present for each state (not color-only).
      expect(items[0].text()).toMatch(/Uploaded|已上传/)
      expect(items[0].find('.el-icon--circle-check').exists()).toBe(true)
      expect(items[1].text()).toMatch(/62%/)
      expect(items[2].text()).toMatch(/Failed|失败/)
      expect(items[2].find('.el-icon--circle-close').exists()).toBe(true)

      // Remove/cancel actions are in the DOM without requiring hover.
      const closes = wrapper.findAll('.el-icon--close')
      expect(closes.length).toBe(3)
      for (const close of closes) {
        expect(close.element.tagName).toBe('BUTTON')
        expect(close.attributes('aria-label')).toBeTruthy()
      }
      // Uploading row uses cancel labeling.
      expect(closes[1].attributes('aria-label')).toMatch(/Cancel|取消/)
    })
  })

  describe('functionalities', () => {
    test('handle preview works', async () => {
      const preview = vi.fn()
      const wrapper = mount({
        props: {
          handlePreview: preview,
        },
      })

      await wrapper.find('.el-upload-list__item-name').trigger('click')
      expect(preview).toHaveBeenCalled()

      await wrapper.setProps({
        listType: 'picture-card',
        files: [
          makeFile({
            name: 'pic.png',
            status: 'success',
            url: 'blob:test',
            uid: 10,
          }),
        ],
      })

      await wrapper.find('.el-upload-list__item-preview').trigger('click')
      expect(preview).toHaveBeenCalledTimes(2)
    })

    test('handle delete works', async () => {
      const remove = vi.fn()

      const wrapper = mount({
        props: {
          onRemove: remove,
        },
      })

      await clickCloseButton(wrapper, '.el-icon--close')
      expect(remove).toHaveBeenCalled()

      await wrapper.find('.el-upload-list__item').trigger('keydown', {
        key: EVENT_CODE.delete,
      })

      expect(remove).toHaveBeenCalledTimes(2)

      await wrapper.setProps({
        listType: 'picture-card',
        files: [
          makeFile({
            name: 'pic.png',
            status: 'success',
            url: 'blob:test',
            uid: 11,
          }),
        ],
      })

      await wrapper.find('.el-upload-list__item-delete').trigger('click')
      expect(remove).toHaveBeenCalledTimes(3)
    })

    test('remove action stays keyboard reachable without hover (#456)', async () => {
      const remove = vi.fn()
      const wrapper = mount({
        props: {
          listType: 'text',
          onRemove: remove,
          files: [makeFile({ name: 'a.txt', status: 'success', uid: 20 })],
        },
      })

      const closeButton = wrapper.find('.el-icon--close')
      expect(closeButton.exists()).toBe(true)
      expect(closeButton.attributes('aria-label')).toMatch(/Delete|删除/)

      // Focus path: item focus does not hide the action.
      await wrapper.find('.el-upload-list__item').trigger('focus')
      expect(wrapper.find('.el-icon--close').exists()).toBe(true)

      await closeButton.trigger('click')
      expect(remove).toHaveBeenCalledTimes(1)

      await wrapper.find('.el-upload-list__item').trigger('keydown', {
        key: EVENT_CODE.delete,
      })
      expect(remove).toHaveBeenCalledTimes(2)
    })

    test('disabled text list keeps status readable and hides remove', () => {
      const wrapper = mount({
        props: {
          listType: 'text',
          disabled: true,
          files: [makeFile({ name: 'a.txt', status: 'success', uid: 30 })],
        },
      })

      expect(wrapper.find('.el-upload-list__item').classes()).toContain(
        'is-disabled',
      )
      expect(wrapper.find('.el-upload-list__item-status-label').exists()).toBe(
        true,
      )
      expect(wrapper.find('.el-icon--close').exists()).toBe(false)
    })

    test('long CJK filename remains in the row without dropping status/actions', () => {
      const longName =
        '非常长的中文文件名用于验证省略与状态操作不互相覆盖-报告终稿-最终版.pdf'
      const wrapper = mount({
        props: {
          listType: 'text',
          files: [makeFile({ name: longName, status: 'success', uid: 40 })],
        },
      })

      expect(wrapper.find('.el-upload-list__item-file-name').text()).toBe(
        longName,
      )
      expect(wrapper.find('.el-upload-list__item-status-label').exists()).toBe(
        true,
      )
      expect(wrapper.find('.el-icon--close').exists()).toBe(true)
    })
  })
})
