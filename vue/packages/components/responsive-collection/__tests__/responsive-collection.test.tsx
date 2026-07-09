import { mount } from '@vue/test-utils'
import { describe, expect, test } from 'vitest'
import ResponsiveCollection from '../src/responsive-collection.vue'

const items = [
  { id: 1, title: 'First' },
  { id: 2, title: 'Second' },
]

describe('ResponsiveCollection.vue', () => {
  test('renders table slot with shared items', () => {
    const wrapper = mount(() => (
      <ResponsiveCollection
        items={items}
        v-slots={{
          table: ({ items }) => (
            <div class="desktop-table">{items.length} rows</div>
          ),
        }}
      />
    ))

    expect(wrapper.find('.desktop-table').text()).toBe('2 rows')
    expect(wrapper.classes()).not.toContain('is-compact')
  })

  test('renders compact card slots with stable keys', () => {
    const wrapper = mount(() => (
      <ResponsiveCollection
        items={items}
        rowKey="id"
        compact
        ariaLabel="Article list"
        v-slots={{
          card: ({ item }) => (
            <article class="compact-card">{item.title}</article>
          ),
        }}
      />
    ))

    expect(wrapper.classes()).toContain('is-compact')
    expect(wrapper.find('[role="list"]').attributes('aria-label')).toBe(
      'Article list',
    )
    expect(wrapper.findAll('.compact-card').map((card) => card.text())).toEqual(
      ['First', 'Second'],
    )
  })

  test('mounts only the active branch initially in lazy strategy', async () => {
    const wrapper = mount(ResponsiveCollection, {
      props: {
        compact: false,
        items,
      },
      slots: {
        table: '<div class="desktop-table">desktop</div>',
        card: '<article class="compact-card">compact</article>',
      },
    })

    expect(wrapper.find('.desktop-table').exists()).toBe(true)
    expect(wrapper.find('.compact-card').exists()).toBe(false)

    await wrapper.setProps({ compact: true })

    expect(wrapper.find('.desktop-table').exists()).toBe(true)
    expect(wrapper.find('.compact-card').exists()).toBe(true)
    expect(
      (
        wrapper.find('.el-responsive-collection__desktop')
          .element as HTMLElement
      ).style.display,
    ).toBe('none')
  })

  test('can preserve the legacy eager two-branch DOM strategy', () => {
    const wrapper = mount(ResponsiveCollection, {
      props: {
        compact: false,
        items,
        renderStrategy: 'show-both',
      },
      slots: {
        table: '<div class="desktop-table">desktop</div>',
        card: '<article class="compact-card">compact</article>',
      },
    })

    expect(wrapper.find('.desktop-table').exists()).toBe(true)
    expect(wrapper.find('.compact-card').exists()).toBe(true)
  })
})
