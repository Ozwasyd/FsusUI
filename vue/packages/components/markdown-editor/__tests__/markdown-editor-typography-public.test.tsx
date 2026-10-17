import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import {
  ElMarkdownEditor,
  type MarkdownEditorTypographyProfile,
} from '../../../element-plus/index'

const documentIdentity = { id: ' /opaque#same-source\0 ', epoch: 4 }
const profile: MarkdownEditorTypographyProfile = {
  schemaVersion: 1,
  fontFamily: 'system-sans',
  fontSize: 'standard',
  lineHeight: 'standard',
  canvasWidth: 'standard',
  paragraphSpacing: 'standard',
}
const request = () => ({
  profile,
  expectedDocumentIdentity: { ...documentIdentity },
  expectedRevision: 0,
  requestId: 'typography:test',
})
const editor = () =>
  mount(ElMarkdownEditor, {
    attachTo: document.body,
    props: {
      modelValue: 'same source 中文 👩‍💻 עברית\n\nparagraph',
      documentIdentity,
      mode: 'source',
      editorProfile: 'prose',
    },
  })

describe('typography refusal through the real public editor', () => {
  it('rejects a same-source different document without normalizing its opaque ID', async () => {
    const wrapper = editor()
    const result = await wrapper.vm.applyTypography({
      ...request(),
      expectedDocumentIdentity: {
        ...documentIdentity,
        id: '/opaque#same-source',
      },
    })
    expect(result).toMatchObject({
      status: 'rejected',
      reason: 'stale-document',
      visualCommitted: false,
    })
    expect(wrapper.emitted('transaction')).toBeUndefined()
    expect(wrapper.emitted('history-change')).toBeUndefined()
  })

  it('rejects stale epochs and stale source revisions', async () => {
    const wrapper = editor()
    expect(
      await wrapper.vm.applyTypography({
        ...request(),
        expectedDocumentIdentity: { ...documentIdentity, epoch: 3 },
      }),
    ).toMatchObject({ reason: 'stale-document' })
    expect(
      await wrapper.vm.applyTypography({ ...request(), expectedRevision: 1 }),
    ).toMatchObject({ reason: 'stale-revision' })
  })

  it('blocks unsupported upstream values before a style commit', async () => {
    const wrapper = editor()
    expect(
      await wrapper.vm.applyTypography({
        ...request(),
        profile: { ...profile, fontFamily: 'reading-serif' },
      }),
    ).toMatchObject({ status: 'rejected', reason: 'unsupported-profile' })
    expect(wrapper.classes()).not.toContain('is-typography-baseline')
  })

  it('yields to real composition and pointer selection gestures', async () => {
    const composing = editor()
    await composing.find('textarea').trigger('compositionstart', { data: '中' })
    expect(await composing.vm.applyTypography(request())).toMatchObject({
      reason: 'composition-active',
    })
    const pointer = editor()
    await pointer.find('textarea').trigger('pointerdown')
    expect(await pointer.vm.applyTypography(request())).toMatchObject({
      reason: 'user-scroll',
    })
  })

  it('yields to the existing manual wheel handler', async () => {
    const wrapper = editor()
    await wrapper.find('textarea').trigger('wheel', { deltaY: 100 })
    expect(await wrapper.vm.applyTypography(request())).toMatchObject({
      status: 'rejected',
      reason: 'user-scroll',
    })
  })

  it('rejects the old identity after same-source document replacement', async () => {
    const wrapper = editor()
    await wrapper.setProps({ documentIdentity: { id: 'other', epoch: 5 } })
    expect(await wrapper.vm.applyTypography(request())).toMatchObject({
      reason: 'stale-document',
    })
  })

  it('rejects apply on a disposed real public instance', async () => {
    const wrapper = editor()
    const apply = wrapper.vm.applyTypography
    wrapper.unmount()
    expect(await apply(request())).toMatchObject({
      status: 'rejected',
      reason: 'disposed',
    })
  })

  it('does not invent completion when jsdom has no native text geometry', async () => {
    const wrapper = editor()
    expect(await wrapper.vm.applyTypography(request())).toMatchObject({
      status: 'rejected',
      reason: 'geometry-unavailable',
      settle: 'not-applied',
    })
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    expect(wrapper.emitted('transaction')).toBeUndefined()
    expect(wrapper.emitted('history-change')).toBeUndefined()
  })
})
