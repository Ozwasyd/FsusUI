<template>
  <li
    :class="[
      ns.e('item'),
      ns.is('collapsed', isCollapsed),
      ns.is('collapse-anchor', showsCollapse),
    ]"
    :aria-current="isCurrent ? 'page' : undefined"
  >
    <details
      v-if="showsCollapse"
      ref="collapseDetails"
      :class="ns.e('collapse')"
    >
      <summary
        :class="ns.e('collapse-trigger')"
        aria-label="Show complete breadcrumb path"
      >
        <span aria-hidden="true">…</span>
      </summary>
      <ol :class="ns.e('collapse-menu')" aria-label="Complete breadcrumb path">
        <li
          v-for="item in breadcrumbContext?.items.value"
          :key="item.uid"
          :class="ns.e('collapse-menu-item')"
        >
          <button
            v-if="item.interactive"
            type="button"
            :class="ns.e('collapse-menu-target')"
            @click="navigateFromMenu(item)"
          >
            {{ item.label }}
          </button>
          <span v-else :class="ns.e('collapse-menu-target')">
            {{ item.label }}
          </span>
        </li>
      </ol>
    </details>
    <span
      ref="link"
      :class="[ns.e('inner'), ns.is('link', !!to)]"
      :role="to ? 'link' : undefined"
      :tabindex="to ? 0 : undefined"
      @click="onClick"
      @keydown.enter.prevent="onClick"
      @keydown.space.prevent="onClick"
    >
      <slot />
    </span>
    <span
      v-if="breadcrumbContext?.props.separatorIcon"
      :class="[ns.e('separator'), 'el-icon']"
      aria-hidden="true"
    >
      <el-icon>
        <component :is="breadcrumbContext.props.separatorIcon" />
      </el-icon>
    </span>
    <span v-else :class="ns.e('separator')" aria-hidden="true">
      {{ breadcrumbContext?.props.separator }}
    </span>
  </li>
</template>

<script lang="ts" setup>
import {
  computed,
  getCurrentInstance,
  inject,
  onBeforeUnmount,
  onMounted,
  onUpdated,
  reactive,
  ref,
} from 'vue'
import ElIcon from '@element-plus/components/icon'
import { useNamespace } from '@element-plus/hooks'
import { breadcrumbKey } from './constants'
import { breadcrumbItemProps } from './breadcrumb-item'

import type { BreadcrumbRouterLike } from './breadcrumb-item'
import type { BreadcrumbItemState } from './constants'

defineOptions({
  name: 'ElBreadcrumbItem',
})

const props = defineProps(breadcrumbItemProps)

const instance = getCurrentInstance()!
const breadcrumbContext = inject(breadcrumbKey, undefined)
const ns = useNamespace('breadcrumb')
const uid = instance.uid

const router = computed(
  () =>
    props.routerInstance ??
    (instance.appContext.config.globalProperties.$router as
      | BreadcrumbRouterLike
      | undefined),
)

const link = ref<HTMLSpanElement>()
const collapseDetails = ref<HTMLDetailsElement>()

const onClick = () => {
  if (!props.to || !router.value) return
  props.replace ? router.value.replace(props.to) : router.value.push(props.to)
}

const itemState = reactive<BreadcrumbItemState>({
  uid,
  interactive: !!props.to,
  label: '',
  navigate: onClick,
})

const itemIndex = computed(
  () =>
    breadcrumbContext?.items.value.findIndex((item) => item.uid === uid) ?? -1,
)
const itemCount = computed(() => breadcrumbContext?.items.value.length ?? 0)
const showsCollapse = computed(
  () => itemCount.value > 4 && itemIndex.value === 1,
)
const isCollapsed = computed(
  () =>
    itemCount.value > 4 &&
    itemIndex.value > 0 &&
    itemIndex.value < itemCount.value - 2,
)
const isCurrent = computed(
  () => itemCount.value > 0 && itemIndex.value === itemCount.value - 1,
)

const updateLabel = () => {
  itemState.label = link.value?.textContent?.trim() ?? ''
}

const navigateFromMenu = (item: BreadcrumbItemState) => {
  item.navigate()
  collapseDetails.value?.removeAttribute('open')
}

breadcrumbContext?.addItem(itemState)
onMounted(updateLabel)
onUpdated(updateLabel)
onBeforeUnmount(() => breadcrumbContext?.removeItem(uid))
</script>
