import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { describe, expect, it } from 'vitest'
import MarkdownEditor from '../src/markdown-editor.vue'
import { insertMarkdownTable, parseMarkdownTableBlock } from '../src/markdown-editor-table'
import { resolveMarkdownTableCellAtOffset } from '../src/markdown-editor-table-structure'

const source = insertMarkdownTable({ rows: 2, columns: 2 })

const selectOffset = async (
  wrapper: ReturnType<typeof mount>,
  offset: number,
) => {
  const textarea = wrapper.find('textarea')
  const element = textarea.element as HTMLTextAreaElement
  element.setSelectionRange(offset, offset)
  await textarea.trigger('select')
  await nextTick()
  return textarea
}

describe('MarkdownEditor table integration', () => {
  it('discovers a table introduced through native input', async () => {
    const wrapper = mount(MarkdownEditor, { props: { modelValue: 'draft' } })
    const textarea = wrapper.find('textarea')
    await textarea.setValue(source)
    const offset = source.indexOf('Column 1')
    await selectOffset(wrapper, offset)
    expect(wrapper.find('button[aria-label="表格操作"]').exists()).toBe(true)
    expect(wrapper.find('[role="menu"][aria-label="表格操作"]').exists()).toBe(false)
  })

  it('anchors the active cell with source identity and renders contextual actions', async () => {
    const wrapper = mount(MarkdownEditor, { props: { modelValue: source } })
    const offset = source.lastIndexOf('|  |  |') + 2
    await selectOffset(wrapper, offset)

    const identity = resolveMarkdownTableCellAtOffset(
      source,
      { epoch: 1, id: 'integration' },
      offset,
    )
    expect(identity).toMatchObject({ row: 2, column: 0, status: 'current' })
    expect(identity?.cellId).toContain(':cell:')
    expect(identity?.anchor).toEqual(expect.objectContaining({ start: expect.any(Number) }))
    expect(wrapper.find('button[aria-label="表格操作"]').exists()).toBe(true)
    expect(wrapper.find('[role="menu"][aria-label="表格操作"]').exists()).toBe(false)
  })

  it('uses the selected row for contextual structure actions', async () => {
    const wrapper = mount(MarkdownEditor, { props: { modelValue: source } })
    const offset = source.lastIndexOf('|  |  |') + 2
    await selectOffset(wrapper, offset)

    await wrapper.get('button[aria-label="表格操作"]').trigger('click')
    const button = wrapper
      .findAll('[role="menu"][aria-label="表格操作"] button')
      .find((item) => item.attributes('aria-label') === '在下方插入行')
    if (!button) throw new Error('missing insert-row action')
    await button.trigger('click')

    const next = wrapper.emitted('update:modelValue')?.at(-1)?.[0]
    expect(typeof next).toBe('string')
    expect(parseMarkdownTableBlock(next as string)?.rows).toHaveLength(3)
  })

  it('routes Tab navigation and TSV paste through the table transaction path', async () => {
    const wrapper = mount(MarkdownEditor, { props: { modelValue: source } })
    const first = source.indexOf('Column 1')
    const textarea = await selectOffset(wrapper, first)

    await textarea.trigger('keydown', { key: 'Tab' })
    await nextTick()
    expect((textarea.element as HTMLTextAreaElement).selectionStart).toBe(
      source.indexOf('Column 2') - 1,
    )

    await textarea.trigger('paste', {
      clipboardData: {
        files: [],
        getData: (type: string) =>
          type === 'text/tab-separated-values' ? 'A\tB\nC\tD' : '',
        items: [],
        types: ['text/tab-separated-values'],
      },
    })
    const next = wrapper.emitted('update:modelValue')?.at(-1)?.[0] as string
    expect(next).toContain('| Column 1 | A | B |')
    expect(next).toContain('|  | C | D |')
  })

  it('does not treat file clipboard input as table-data authority', async () => {
    const wrapper = mount(MarkdownEditor, { props: { modelValue: source } })
    const textarea = await selectOffset(wrapper, source.indexOf('Column 1'))

    await textarea.trigger('paste', {
      clipboardData: {
        files: [new File(['A\tB'], 'table.tsv', { type: 'text/tab-separated-values' })],
        getData: (type: string) =>
          type === 'text/tab-separated-values' ? 'A\tB\nC\tD' : '',
        items: [],
        types: ['Files', 'text/tab-separated-values'],
      },
    })

    const values = (wrapper.emitted('update:modelValue') ?? []).map(
      ([value]) => value as string,
    )
    expect(values.every((value) => !value.includes('| Column 1 | A | B |'))).toBe(true)
  })
})
