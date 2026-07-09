import { mount } from '@vue/test-utils'
import { describe, expect, test } from 'vitest'
import EmptyState from '../src/empty-state.vue'
import { ElEmptyState, FsusEmptyState } from '..'

describe('EmptyState.vue', () => {
  test('renders an inline empty state without an illustration by default', () => {
    const wrapper = mount(() => (
      <EmptyState title="No rows" description="Adjust filters and try again.">
        Clear filters
      </EmptyState>
    ))

    expect(wrapper.classes()).toContain('el-empty-state--inline')
    expect(wrapper.find('.el-empty-state__illustration').exists()).toBe(false)
    expect(wrapper.find('.el-empty-state__title').text()).toBe('No rows')
    expect(wrapper.find('.el-empty-state__description').text()).toBe(
      'Adjust filters and try again.',
    )
    expect(wrapper.find('.el-empty-state__actions').text()).toBe(
      'Clear filters',
    )
    expect(wrapper.find('.el-empty-state__actions').classes()).toContain(
      'el-empty-state__actions--link',
    )
  })

  test('renders a compact secondary action preset', () => {
    const wrapper = mount(() => (
      <EmptyState size="compact" title="Nothing selected">
        Select one
      </EmptyState>
    ))

    expect(wrapper.classes()).toContain('el-empty-state--compact')
    expect(wrapper.find('.el-empty-state__actions').classes()).toContain(
      'el-empty-state__actions--secondary',
    )
  })

  test('renders page illustration automatically and allows primary actions', () => {
    const wrapper = mount(() => (
      <EmptyState size="page" title="No results" actionVariant="primary">
        Create item
      </EmptyState>
    ))

    expect(wrapper.classes()).toContain('el-empty-state--page')
    expect(wrapper.classes()).toContain('is-with-illustration')
    expect(wrapper.find('.el-empty-state__illustration').exists()).toBe(true)
    expect(
      wrapper.find('.el-empty-state__illustration').attributes(),
    ).toMatchObject({
      'aria-hidden': 'true',
    })
    expect(wrapper.find('.el-empty-state__actions').classes()).toContain(
      'el-empty-state__actions--primary',
    )
  })

  test('can suppress page illustrations explicitly', () => {
    const wrapper = mount(() => (
      <EmptyState size="page" title="No results" illustration={false} />
    ))

    expect(wrapper.classes()).not.toContain('is-with-illustration')
    expect(wrapper.find('.el-empty-state__illustration').exists()).toBe(false)
  })

  test('sets live-region attributes only when requested', () => {
    const passive = mount(() => <EmptyState title="Quiet state" />)
    const live = mount(() => (
      <EmptyState title="Updated" role="status" ariaLive="polite" />
    ))

    expect(passive.attributes('aria-live')).toBeUndefined()
    expect(passive.attributes('role')).toBeUndefined()
    expect(live.attributes('aria-live')).toBe('polite')
    expect(live.attributes('role')).toBe('status')
  })

  test('renders title, description, action, and illustration slots', () => {
    const wrapper = mount(() => (
      <EmptyState
        size="page"
        v-slots={{
          illustration: () => <span class="custom-mark">mark</span>,
          title: () => <span>Slot title</span>,
          description: () => <span>Slot description</span>,
          actions: () => <button type="button">Slot action</button>,
        }}
      />
    ))

    expect(wrapper.find('.custom-mark').text()).toBe('mark')
    expect(wrapper.find('.el-empty-state__title').text()).toBe('Slot title')
    expect(wrapper.find('.el-empty-state__description').text()).toBe(
      'Slot description',
    )
    expect(wrapper.find('.el-empty-state__actions button').text()).toBe(
      'Slot action',
    )
  })

  test('exports El and Fsus component names', () => {
    expect(ElEmptyState.name).toBe('ElEmptyState')
    expect(FsusEmptyState.name).toBe('FsusEmptyState')
  })
})
