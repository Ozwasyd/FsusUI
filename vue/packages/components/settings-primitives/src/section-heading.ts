import { computed, useSlots } from 'vue'
import { useNamespace } from '@element-plus/hooks'

import type { SectionHeaderProps } from './shared'

export const useSectionHeading = (block: string, props: SectionHeaderProps) => {
  const slots = useSlots()
  const ns = useNamespace(block)
  const hasTitle = () => Boolean(props.title || slots.title)
  const hasDescription = () => Boolean(props.description || slots.description)
  const hasActions = () => Boolean(slots.actions)
  const sectionKls = computed(() => [
    ns.b(),
    ns.m(props.density),
    ns.is('danger', props.danger),
  ])

  return { ns, hasTitle, hasDescription, hasActions, sectionKls }
}
