import { nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { describe, expect, test, vi } from 'vitest'
import { clickActionButton } from '../../../test-utils/dom'
import Collapse from '../src/collapse.vue'
import CollapseItem from '../src/collapse-item.vue'
import type { VueWrapper } from '@vue/test-utils'
import type { CollapseModelValue } from '../src/collapse'
import type { CollapseItemInstance } from '../src/instance'

const mountCollapse = (
  props: {
    accordion?: boolean
    onChange?: (value: CollapseModelValue) => void
  } = {},
  mounted?: (this: { activeNames: string[] }) => void
) =>
  mount({
    data() {
      return { activeNames: ['1'] }
    },
    ...(mounted && { mounted }),
    render() {
      return (
        <Collapse v-model={(this as any).activeNames} {...props}>
          <CollapseItem title="title1" name="1">
            <div class="content">111</div>
          </CollapseItem>
          <CollapseItem title="title2" name="2">
            <div class="content">222</div>
          </CollapseItem>
          <CollapseItem title="title3" name="3">
            <div class="content">333</div>
          </CollapseItem>
          <CollapseItem title="title4" name="4">
            <div class="content">444</div>
          </CollapseItem>
        </Collapse>
      )
    },
  })

const findCollapseItems = (wrapper: ReturnType<typeof mountCollapse>) =>
  wrapper.findComponent(Collapse).findAllComponents(
    CollapseItem
  ) as VueWrapper<CollapseItemInstance>[]

describe('Collapse.vue', () => {
  test('create', async () => {
    const wrapper = mountCollapse()

    const vm = wrapper.vm as any
    const collapseItemWrappers = findCollapseItems(wrapper)
    const collapseItemHeaderEls = vm.$el.querySelectorAll(
      '.el-collapse-item__header'
    )
    expect(collapseItemWrappers[0].vm.isActive).toBe(true)

    await clickActionButton(collapseItemHeaderEls[2] as HTMLElement)
    await nextTick()
    expect(collapseItemWrappers[0].vm.isActive).toBe(true)
    expect(collapseItemWrappers[2].vm.isActive).toBe(true)
    await clickActionButton(collapseItemHeaderEls[0] as HTMLElement)
    await nextTick()
    expect(collapseItemWrappers[0].vm.isActive).toBe(false)
  })

  test('accordion', async () => {
    const wrapper = mountCollapse({ accordion: true })

    const vm = wrapper.vm as any
    const collapseItemWrappers = findCollapseItems(wrapper)
    const collapseItemHeaderEls = vm.$el.querySelectorAll(
      '.el-collapse-item__header'
    )
    expect(collapseItemWrappers[0].vm.isActive).toBe(true)

    await clickActionButton(collapseItemHeaderEls[2] as HTMLElement)
    await nextTick()
    expect(collapseItemWrappers[0].vm.isActive).toBe(false)
    expect(collapseItemWrappers[2].vm.isActive).toBe(true)
    await clickActionButton(collapseItemHeaderEls[0] as HTMLElement)
    await nextTick()
    expect(collapseItemWrappers[0].vm.isActive).toBe(true)
    expect(collapseItemWrappers[2].vm.isActive).toBe(false)
  })

  test('event:change', async () => {
    const onChange = vi.fn()
    const wrapper = mountCollapse({ onChange })

    const vm = wrapper.vm as any
    const collapseItemWrappers = findCollapseItems(wrapper)
    const collapseItemHeaderEls = vm.$el.querySelectorAll(
      '.el-collapse-item__header'
    )
    expect(collapseItemWrappers[0].vm.isActive).toBe(true)
    expect((vm as any).activeNames).toEqual(['1'])
    expect(onChange).not.toHaveBeenCalled()
    await clickActionButton(collapseItemHeaderEls[2] as HTMLElement)
    await nextTick()
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(collapseItemWrappers[0].vm.isActive).toBe(true)
    expect(collapseItemWrappers[2].vm.isActive).toBe(true)
    expect((vm as any).activeNames).toEqual(['1', '3'])
    await clickActionButton(collapseItemHeaderEls[0] as HTMLElement)
    await nextTick()
    expect(onChange).toHaveBeenCalledTimes(2)
    expect(collapseItemWrappers[0].vm.isActive).toBe(false)
    expect((vm as any).activeNames).toEqual(['3'])
  })

  test('deep watch modelValue', async () => {
    const wrapper = mountCollapse({}, function () {
      this.activeNames.push('2')
    })

    await nextTick()
    const collapseItemWrappers = findCollapseItems(wrapper)
    expect(collapseItemWrappers[0].vm.isActive).toBe(true)
    expect(collapseItemWrappers[1].vm.isActive).toBe(true)
  })
})
