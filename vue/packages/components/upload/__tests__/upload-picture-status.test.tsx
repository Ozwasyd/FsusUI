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

describe('picture-card upload status (#300)', () => {
  test.each([false, true])(
    'renders success checkmark and named status on success, disabled=%s',
    (disabled) => {
      const wrapper = mount(ElUpload, {
        props: {
          listType: 'picture-card',
          fileList: [picture('success')],
          disabled,
        },
      })
      const item = wrapper.get('.el-upload-list__item')
      expect(item.classes()).toContain('is-success')

      const status = wrapper.get('[role="status"]')
      expect(status.classes()).toContain('el-upload-list__item-status-label')
      expect(status.attributes('aria-label')).toMatch(/Uploaded|已上传/)
      expect(status.find('.el-icon--upload-success').exists()).toBe(true)
      expect(status.find('.el-icon--check').exists()).toBe(true)
      expect(wrapper.find('.el-icon--upload-fail').exists()).toBe(false)
      expect(wrapper.find('.el-upload-list__item-preview').exists()).toBe(true)
      expect(wrapper.find('.el-upload-list__item-delete').exists()).toBe(
        !disabled,
      )
      wrapper.unmount()
    },
  )

  test('renders non-color fail indicator without success checkmark on fail', () => {
    const wrapper = mount(ElUpload, {
      props: {
        listType: 'picture-card',
        fileList: [picture('fail')],
      },
    })
    const item = wrapper.get('.el-upload-list__item')
    expect(item.classes()).toContain('is-fail')

    const status = wrapper.get('[role="status"]')
    expect(status.classes()).toContain('el-upload-list__item-status-label')
    expect(status.attributes('aria-label')).toMatch(/Failed|失败/)
    expect(status.attributes('aria-label')).not.toMatch(/Uploaded|已上传/)
    expect(status.find('.el-icon--upload-fail').exists()).toBe(true)
    expect(status.find('.el-icon--circle-close').exists()).toBe(true)
    expect(wrapper.find('.el-icon--upload-success').exists()).toBe(false)
    expect(wrapper.find('.el-icon--check').exists()).toBe(false)
    expect(wrapper.find('.el-upload-list__item-thumbnail').exists()).toBe(true)
    expect(wrapper.find('.el-upload-list__item-actions').exists()).toBe(true)
    wrapper.unmount()
  })

  test.each(['uploading', 'ready'] as const)(
    '%s does not render success checkmark or fail indicator',
    (state) => {
      const wrapper = mount(ElUpload, {
        props: {
          listType: 'picture-card',
          fileList: [picture(state)],
        },
      })
      const item = wrapper.get('.el-upload-list__item')
      expect(item.classes()).toContain(`is-${state}`)
      expect(wrapper.find('.el-upload-list__item-status-label').exists()).toBe(
        false,
      )
      expect(wrapper.find('[role="status"]').exists()).toBe(false)
      expect(wrapper.find('.el-icon--upload-success').exists()).toBe(false)
      expect(wrapper.find('.el-icon--check').exists()).toBe(false)
      expect(wrapper.find('.el-icon--upload-fail').exists()).toBe(false)
      expect(wrapper.find('.el-progress').exists()).toBe(state === 'uploading')
      expect(wrapper.find('.el-upload-list__item-thumbnail').exists()).toBe(
        state === 'ready',
      )
      wrapper.unmount()
    },
  )

  test('reactive status transitions update picture-card indicator without stale success', async () => {
    const file = picture('ready')
    const wrapper = mount(ElUpload, {
      props: {
        listType: 'picture-card',
        fileList: [file],
      },
    })
    expect(wrapper.find('.el-upload-list__item-status-label').exists()).toBe(
      false,
    )

    await wrapper.setProps({ fileList: [{ ...file, status: 'uploading' }] })
    expect(wrapper.find('.el-progress').exists()).toBe(true)
    expect(wrapper.find('.el-icon--upload-success').exists()).toBe(false)

    await wrapper.setProps({ fileList: [{ ...file, status: 'fail' }] })
    expect(wrapper.get('[role="status"]').attributes('aria-label')).toMatch(
      /Failed|失败/,
    )
    expect(wrapper.find('.el-icon--upload-fail').exists()).toBe(true)
    expect(wrapper.find('.el-icon--upload-success').exists()).toBe(false)

    await wrapper.setProps({ fileList: [{ ...file, status: 'success' }] })
    expect(wrapper.get('[role="status"]').attributes('aria-label')).toMatch(
      /Uploaded|已上传/,
    )
    expect(wrapper.find('.el-icon--upload-success').exists()).toBe(true)
    expect(wrapper.find('.el-icon--upload-fail').exists()).toBe(false)
    wrapper.unmount()
  })
})
