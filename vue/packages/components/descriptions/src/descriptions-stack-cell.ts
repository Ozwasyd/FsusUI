import { defineComponent, h, withDirectives } from 'vue'
import { getNormalizedProps } from '@element-plus/utils'
import { useNamespace } from '@element-plus/hooks'

import type { DirectiveArguments, PropType, VNode } from 'vue'
import type { IDescriptionsItemInject } from './descriptions.type'
import type { DescriptionItemVNode } from './description-item'

export default defineComponent({
  name: 'ElDescriptionsStackCell',
  props: {
    cell: {
      type: Object as PropType<DescriptionItemVNode>,
      required: true,
    },
  },
  setup() {
    return {
      ns: useNamespace('descriptions'),
    }
  },
  render() {
    const item = getNormalizedProps(
      this.cell as VNode,
    ) as IDescriptionsItemInject
    const directives = (this.cell.dirs || []).map((directive) => {
      const { dir, arg, modifiers, value } = directive
      return [dir, value, arg, modifiers]
    }) as DirectiveArguments
    const label =
      (
        this.cell.children?.label as ((...args: any[]) => any) | undefined
      )?.() ?? item.label
    const content = this.cell.children?.default?.()

    return withDirectives(
      h('div', { class: this.ns.e('stack-item') }, [
        h(
          'dt',
          {
            class: [this.ns.e('stack-label'), item.labelClassName],
          },
          label,
        ),
        h(
          'dd',
          {
            class: [this.ns.e('stack-value'), item.className],
          },
          content,
        ),
      ]),
      directives,
    )
  },
})
