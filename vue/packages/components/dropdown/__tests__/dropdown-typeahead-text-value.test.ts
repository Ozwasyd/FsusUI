import { nextTick, reactive } from 'vue'
import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { rAF } from '@element-plus/test-utils/tick'
import Dropdown from '../src/dropdown.vue'
import DropdownItem from '../src/dropdown-item.vue'
import DropdownMenu from '../src/dropdown-menu.vue'

const mountDropdown = async (initialTextValue: string | null = 'alpha') => {
  const state = reactive({
    textValue: initialTextValue ?? undefined,
    label: 'Alpha',
    disabled: false,
    checked: false,
  })
  const wrapper = mount(
    {
      components: { Dropdown, DropdownItem, DropdownMenu },
      setup: () => ({ state }),
      template: `
        <dropdown trigger="click" :teleported="false" :hide-on-click="false">
          <button>Open</button>
          <template #dropdown>
            <dropdown-menu>
              <dropdown-item key="changing" :text-value="state.textValue"
                :disabled="state.disabled" :checked="state.checked">
                {{ state.label }}
              </dropdown-item>
              <dropdown-item>Beta</dropdown-item>
            </dropdown-menu>
          </template>
        </dropdown>
      `,
    },
    { attachTo: document.body },
  )
  await wrapper.get('button').trigger('click')
  await rAF()
  const items = wrapper.findAll('.el-dropdown-menu__item')
  const changing = items[0].element as HTMLElement
  const beta = items[1].element as HTMLElement
  beta.focus()
  await nextTick()
  vi.useFakeTimers()

  const press = async (key: string) => {
    document.activeElement!.dispatchEvent(
      new KeyboardEvent('keydown', {
        key,
        code: `Key${key.toUpperCase()}`,
        bubbles: true,
      }),
    )
    await nextTick()
  }
  const resetSearch = async () => {
    await vi.advanceTimersByTimeAsync(1001)
    beta.focus()
    await nextTick()
  }

  return { wrapper, state, changing, beta, press, resetSearch }
}

describe('Dropdown reactive text-value typeahead', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  test('matches a replacement text-value on the same item after nextTick', async () => {
    const { wrapper, state, changing, beta, press } = await mountDropdown()
    state.textValue = 'zebra'
    state.label = 'Zebra'
    await nextTick()

    expect(wrapper.findAll('.el-dropdown-menu__item')[0].element).toBe(changing)
    expect(document.activeElement).toBe(beta)
    await press('z')
    expect(document.activeElement).toBe(changing)
  })

  test('prefers the updated explicit value over a different visible label', async () => {
    const { state, changing, beta, press, resetSearch } = await mountDropdown()
    state.textValue = 'zebra'
    await nextTick()

    await press('z')
    expect(document.activeElement).toBe(changing)
    await resetSearch()
    await press('a')
    expect(document.activeElement).toBe(beta)
  })

  test('does not match the stale text-value after replacement', async () => {
    const { state, beta, press } = await mountDropdown()
    state.textValue = 'zebra'
    state.label = 'Zebra'
    await nextTick()

    await press('a')
    expect(document.activeElement).toBe(beta)
  })

  test.each([undefined, '', '   '])(
    'falls back to the current label after text-value becomes %j',
    async (textValue) => {
      const { state, changing, beta, press, resetSearch } =
        await mountDropdown()
      state.textValue = textValue
      state.label = 'Zebra'
      await nextTick()

      await press('a')
      expect(document.activeElement).toBe(beta)
      await resetSearch()
      await press('z')
      expect(document.activeElement).toBe(changing)

      await resetSearch()
      state.label = 'Yak'
      await nextTick()
      expect(document.activeElement).toBe(beta)
      await press('y')
      expect(document.activeElement).toBe(changing)
    },
  )

  test('uses a changing label when no explicit text-value was mounted', async () => {
    const { state, changing, press } = await mountDropdown(null)
    state.textValue = undefined
    state.label = 'Zebra'
    await nextTick()

    await press('z')
    expect(document.activeElement).toBe(changing)
  })

  test('keeps an empty label unmatched after removing text-value', async () => {
    const { state, beta, press, resetSearch } = await mountDropdown()
    state.textValue = undefined
    state.label = ''
    await nextTick()

    await press('a')
    expect(document.activeElement).toBe(beta)
    await resetSearch()
    await press('z')
    expect(document.activeElement).toBe(beta)
  })

  test('skips a disabled updated item and matches it when enabled', async () => {
    const { state, changing, beta, press, resetSearch } = await mountDropdown()
    state.textValue = 'zebra'
    state.label = 'Zebra'
    state.disabled = true
    await nextTick()

    expect(changing.getAttribute('aria-disabled')).toBe('true')
    await press('z')
    expect(document.activeElement).toBe(beta)
    await resetSearch()
    state.disabled = false
    await nextTick()
    await press('z')
    expect(document.activeElement).toBe(changing)
  })

  test('does not take focus when text-value and checked change', async () => {
    const { state, changing, beta, press } = await mountDropdown()
    state.textValue = 'zebra'
    state.label = 'Zebra'
    state.checked = true
    await nextTick()
    await vi.advanceTimersByTimeAsync(300)

    expect(changing.getAttribute('aria-checked')).toBe('true')
    expect(document.activeElement).toBe(beta)
    await press('z')
    expect(document.activeElement).toBe(changing)
  })
})
