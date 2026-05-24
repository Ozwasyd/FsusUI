<template>
  <span :class="ns.e('item')">
    <span
      ref="link"
      :class="[ns.e('inner'), ns.is('link', !!to)]"
      role="link"
      @click="onClick"
    >
      <slot />
    </span>
    <el-icon v-if="breadcrumbContext?.separatorIcon" :class="ns.e('separator')">
      <component :is="breadcrumbContext.separatorIcon" />
    </el-icon>
    <span v-else :class="ns.e('separator')" role="presentation">
      {{ breadcrumbContext?.separator }}
    </span>
  </span>
</template>

<script lang="ts" setup>
import { computed, getCurrentInstance, inject, ref } from 'vue'
import ElIcon from '@element-plus/components/icon'
import { useNamespace } from '@element-plus/hooks'
import { breadcrumbKey } from './constants'
import { breadcrumbItemProps } from './breadcrumb-item'

import type { BreadcrumbRouterLike } from './breadcrumb-item'

defineOptions({
  name: 'ElBreadcrumbItem',
})

const props = defineProps(breadcrumbItemProps)

const instance = getCurrentInstance()!
const breadcrumbContext = inject(breadcrumbKey, undefined)
const ns = useNamespace('breadcrumb')

const router = computed(
  () =>
    props.routerInstance ??
    (instance.appContext.config.globalProperties.$router as
      | BreadcrumbRouterLike
      | undefined),
)

const link = ref<HTMLSpanElement>()

const onClick = () => {
  if (!props.to || !router.value) return
  props.replace ? router.value.replace(props.to) : router.value.push(props.to)
}
</script>
