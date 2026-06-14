import { mount } from '@vue/test-utils'
import { describe, expect, test } from 'vitest'
import CollectionToolbar from '../src/collection-toolbar.vue'
import FilterGroup from '../src/filter-group.vue'
import SegmentedControl from '../src/segmented-control.vue'
import CollectionSummary from '../src/collection-summary.vue'
import PaginationBar from '../src/pagination-bar.vue'

const segmentedItems = [
  { label: 'All', value: 'all' },
  { label: 'Open', value: 'open' },
  { label: 'Closed', value: 'closed', disabled: true },
]

describe('collection primitives', () => {
  test('renders toolbar slots with accessible labelling', () => {
    const wrapper = mount(() => (
      <CollectionToolbar
        ariaLabel="Collection controls"
        density="compact"
        v-slots={{
          primary: () => <input aria-label="Search" />,
          filters: () => <button type="button">Filters</button>,
          actions: () => <button type="button">Action</button>,
        }}
      />
    ))

    expect(wrapper.classes()).toContain('el-collection-toolbar--compact')
    expect(wrapper.attributes('aria-label')).toBe('Collection controls')
    expect(wrapper.find('.el-collection-toolbar__primary').exists()).toBe(true)
    expect(wrapper.find('.el-collection-toolbar__filters').text()).toBe(
      'Filters',
    )
    expect(wrapper.find('.el-collection-toolbar__actions').text()).toBe(
      'Action',
    )
  })

  test('renders filter groups as labelled fieldsets', () => {
    const wrapper = mount(() => (
      <FilterGroup label="State">
        <select aria-label="State" />
      </FilterGroup>
    ))

    expect(wrapper.element.tagName).toBe('FIELDSET')
    expect(wrapper.find('.el-filter-group__label').text()).toBe('State')
    expect(wrapper.find('select').exists()).toBe(true)
  })

  test('emits segmented control changes from click and keyboard', async () => {
    const wrapper = mount(SegmentedControl, {
      props: {
        modelValue: 'all',
        items: segmentedItems,
        ariaLabel: 'Filter state',
      },
    })

    expect(wrapper.attributes('role')).toBe('radiogroup')
    expect(wrapper.attributes('aria-label')).toBe('Filter state')
    expect(wrapper.find('[aria-checked="true"]').text()).toBe('All')

    await wrapper.findAll('button')[1]?.trigger('click')
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['open'])
    expect(wrapper.emitted('change')?.[0]).toEqual(['open'])

    await wrapper.setProps({ modelValue: 'open' })
    await wrapper
      .findAll('button')[1]
      ?.trigger('keydown', { key: 'ArrowRight' })
    expect(wrapper.emitted('update:modelValue')?.[1]).toEqual(['all'])
  })

  test('renders collection summary counts and opt-in live region', () => {
    const wrapper = mount(() => (
      <CollectionSummary
        title="Results"
        total={12}
        visible={3}
        state="Filtered"
        ariaLive="polite"
      />
    ))

    expect(wrapper.attributes('role')).toBe('status')
    expect(wrapper.attributes('aria-live')).toBe('polite')
    expect(wrapper.find('.el-collection-summary__title').text()).toBe('Results')
    expect(wrapper.find('.el-collection-summary__count').text()).toBe(
      '3 of 12 items',
    )
    expect(wrapper.find('.el-collection-summary__meta').text()).toBe('Filtered')
  })

  test('renders pagination summary and controls slots', () => {
    const wrapper = mount(() => (
      <PaginationBar
        ariaLabel="Results pagination"
        v-slots={{
          summary: () => <span>Page 1 of 4</span>,
          pagination: () => <button type="button">Next</button>,
        }}
      />
    ))

    expect(wrapper.element.tagName).toBe('NAV')
    expect(wrapper.attributes('aria-label')).toBe('Results pagination')
    expect(wrapper.find('.el-pagination-bar__summary').text()).toBe(
      'Page 1 of 4',
    )
    expect(wrapper.find('.el-pagination-bar__controls').text()).toBe('Next')
  })
})
