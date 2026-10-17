import { mount } from '@vue/test-utils'
import { defineComponent, h, nextTick, ref, watch } from 'vue'
import { afterEach, describe, expect, test } from 'vitest'
import DataList from '../src/data-list.vue'

const initialRows = [
  { id: 'a', name: 'Alpha' },
  { id: 'b', name: 'Beta' },
  { id: 'c', name: 'Gamma' },
]
const columns = [{ key: 'name', label: 'Name' }]

afterEach(() => {
  document.body.innerHTML = ''
})

describe('DataList focus recovery', () => {
  test.each(['disabledKeys', 'loadingKey', 'loading'] as const)(
    'keeps removal recovery across a post-flush %s update',
    async (state) => {
      const rows = ref(initialRows)
      const disabledKeys = ref<string[]>([])
      const loadingKey = ref<string | null>(null)
      const loading = ref(false)
      const wrapper = mount(
        defineComponent({
          setup() {
            watch(
              rows,
              () => {
                if (state === 'disabledKeys') disabledKeys.value = ['c']
                else if (state === 'loadingKey') loadingKey.value = 'c'
                else loading.value = true
              },
              { flush: 'post' },
            )
            return () =>
              h(DataList, {
                rows: rows.value,
                columns,
                activeKey: 'a',
                disabledKeys: disabledKeys.value,
                loadingKey: loadingKey.value,
                loading: loading.value,
              })
          },
        }),
        { attachTo: document.body },
      )
      const list = wrapper.findComponent(DataList)
      ;(list.findAll('button')[0].element as HTMLButtonElement).focus()

      rows.value = initialRows.slice(1)
      await nextTick()
      await nextTick()

      expect(document.activeElement).toBe(
        state === 'loading' ? list.element : list.findAll('button')[0].element,
      )
      expect(list.props('activeKey')).toBe('a')
      expect(list.emitted('change')).toBeUndefined()
      if (state === 'loading') {
        loading.value = false
        await nextTick()
        await nextTick()
        expect(document.activeElement).toBe(list.findAll('button')[0].element)
      }
    },
  )

  test('does not take focus from another control during post-flush recovery', async () => {
    const rows = ref(initialRows)
    const disabledKeys = ref<string[]>([])
    const outside = document.createElement('button')
    document.body.append(outside)
    const wrapper = mount(
      defineComponent({
        setup() {
          watch(
            rows,
            () => {
              disabledKeys.value = ['c']
              outside.focus()
            },
            { flush: 'post' },
          )
          return () =>
            h(DataList, {
              rows: rows.value,
              columns,
              disabledKeys: disabledKeys.value,
            })
        },
      }),
      { attachTo: document.body },
    )
    ;(wrapper.findAll('button')[0].element as HTMLButtonElement).focus()

    rows.value = initialRows.slice(1)
    await nextTick()
    await nextTick()
    expect(document.activeElement).toBe(outside)

    disabledKeys.value = []
    await nextTick()
    await nextTick()
    expect(document.activeElement).toBe(outside)
  })

  test('keeps the removed row position across superseding updates', async () => {
    const rows = ref(initialRows)
    const disabledKeys = ref<string[]>([])
    const wrapper = mount(
      defineComponent({
        setup() {
          watch(
            rows,
            () => {
              disabledKeys.value = ['a']
            },
            { flush: 'post' },
          )
          return () =>
            h(DataList, {
              rows: rows.value,
              columns,
              disabledKeys: disabledKeys.value,
            })
        },
      }),
      { attachTo: document.body },
    )
    ;(wrapper.findAll('button')[1].element as HTMLButtonElement).focus()

    rows.value = [initialRows[0], initialRows[2]]
    await nextTick()
    await nextTick()
    expect(document.activeElement).toBe(wrapper.findAll('button')[1].element)
  })
})
