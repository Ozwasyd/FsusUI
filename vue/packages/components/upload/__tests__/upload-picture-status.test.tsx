import { mount } from '@vue/test-utils'
import { describe, expect, test, vi } from 'vitest'
import { ElUpload } from '../index'
import type { UploadStatus, UploadUserFile } from '../src/upload'

const picture = (status: UploadStatus): UploadUserFile => ({
  name: '年度报告-cover.png',
  uid: 300,
  status,
  percentage: 62,
  url: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
})

describe('picture upload status (#300)', () => {
  test.each([false, true])(
    'keeps named success feedback, disabled=%s',
    (disabled) => {
      const wrapper = mount(ElUpload, {
        props: {
          listType: 'picture',
          fileList: [picture('success')],
          disabled,
        },
      })
      const status = wrapper.get('[role="status"]')
      expect(status.attributes('aria-label')).toMatch(/Uploaded|已上传/)
      expect(status.text()).toMatch(/Uploaded|已上传/)
      expect(status.find('.el-icon--upload-success').exists()).toBe(true)
      expect(wrapper.get('.el-upload-list__item-file-name').text()).toBe(
        picture('success').name,
      )
      expect(wrapper.find('.el-icon--close').exists()).toBe(!disabled)
      wrapper.unmount()
    },
  )

  test.each(['ready', 'uploading', 'fail'] as const)(
    '%s does not announce or render success',
    (state) => {
      const wrapper = mount(ElUpload, {
        props: { listType: 'picture', fileList: [picture(state)] },
      })
      const status = wrapper.get('[role="status"]')
      expect(status.attributes('aria-label')).toBeTruthy()
      expect(status.text()).toMatch(
        state === 'ready'
          ? /Pending|待上传/
          : state === 'uploading'
            ? /62%/
            : /Failed|失败/,
      )
      expect(status.text()).not.toMatch(/Uploaded|已上传/)
      expect(wrapper.find('.el-icon--upload-success').exists()).toBe(false)
      expect(wrapper.find('.el-progress').exists()).toBe(state === 'uploading')
      wrapper.unmount()
    },
  )

  test('reactive status changes preserve file identity and public preview/remove callbacks', async () => {
    const onPreview = vi.fn()
    const onRemove = vi.fn()
    const file = picture('uploading')
    const wrapper = mount(ElUpload, {
      props: { listType: 'picture', fileList: [file], onPreview, onRemove },
    })
    await wrapper.setProps({ fileList: [{ ...file, status: 'success' }] })
    expect(wrapper.get('[role="status"]').text()).toMatch(/Uploaded|已上传/)
    await wrapper.get('.el-upload-list__item-name').trigger('click')
    expect(onPreview).toHaveBeenCalledWith(
      expect.objectContaining({ uid: file.uid, status: 'success' }),
    )
    await wrapper.get('.el-icon--close').trigger('click')
    expect(onRemove).toHaveBeenCalledWith(
      expect.objectContaining({ uid: file.uid }),
      [],
    )
    wrapper.unmount()
  })
})
