<template>
  <nav ref="breadcrumb" :class="ns.b()" :aria-label="ariaLabel">
    <ol :class="ns.e('list')">
      <slot />
    </ol>
  </nav>
</template>

<script lang="ts" setup>
import { getCurrentInstance, provide, ref } from 'vue'
import { useNamespace, useOrderedChildren } from '@element-plus/hooks'
import { breadcrumbKey } from './constants'
import { breadcrumbProps } from './breadcrumb'

import type { BreadcrumbItemState } from './constants'

defineOptions({
  name: 'ElBreadcrumb',
})

const props = defineProps(breadcrumbProps)
const { ariaLabel } = props

const ns = useNamespace('breadcrumb')
const breadcrumb = ref<HTMLElement>()
const {
  children: items,
  addChild: addItem,
  removeChild: removeItem,
} = useOrderedChildren<BreadcrumbItemState>(
  getCurrentInstance()!,
  'ElBreadcrumbItem',
)

provide(breadcrumbKey, {
  props,
  items,
  addItem,
  removeItem,
})
</script>
