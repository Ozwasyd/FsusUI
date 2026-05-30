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
      'Article list'
    )
    expect(wrapper.findAll('.compact-card').map((card) => card.text())).toEqual(
      ['First', 'Second']
    )
  })
})
