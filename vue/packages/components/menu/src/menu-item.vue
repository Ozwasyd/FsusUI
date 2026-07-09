<template>
  <li
    :class="[
      nsMenuItem.b(),
      nsMenuItem.is('active', active),
      nsMenuItem.is('disabled', disabled),
    ]"
    role="menuitem"
    tabindex="-1"
    @click="handleClick"
  >
    <el-tooltip
      v-if="
        parentMenu.type.name === 'ElMenu' &&
        rootMenu.props.collapse &&
        $slots.title
      "
      :effect="rootMenu.props.popperEffect"
      placement="right"
      :fallback-placements="['left']"
      persistent
    >
      <template #content>
        <slot name="title" />
      </template>
      <div :class="nsMenu.be('tooltip', 'trigger')">
        <slot />
      </div>
    </el-tooltip>
    <template v-else>
      <slot />
      <slot name="title" />
    </template>
  </li>
</template>

<script lang="ts">
import {
  computed,
  defineComponent,
  getCurrentInstance,
  inject,
  onBeforeUnmount,
  onMounted,
  reactive,
} from 'vue'
import ElTooltip from '@element-plus/components/tooltip'
import { throwError } from '@element-plus/utils'
import { useNamespace } from '@element-plus/hooks'
import useMenu from './use-menu'
import { menuItemEmits, menuItemProps } from './menu-item'

import type { MenuItemRegistered, MenuProvider, SubMenuProvider } from './types'

const COMPONENT_NAME = 'ElMenuItem'
export default defineComponent({
  name: COMPONENT_NAME,
  components: {
    ElTooltip,
  },

  props: menuItemProps,
  emits: menuItemEmits,

  setup(props, { emit }) {
    const instance = getCurrentInstance()!
    const rootMenu = inject<MenuProvider>('rootMenu')
    const nsMenu = useNamespace('menu')
    const nsMenuItem = useNamespace('menu-item')
    if (!rootMenu) throwError(COMPONENT_NAME, 'can not inject root menu')
    const rootMenuContext = rootMenu as MenuProvider
    const itemIndex = computed(() => props.index ?? '')

    const { parentMenu, indexPath } = useMenu(instance, itemIndex)

    const subMenu = inject<SubMenuProvider>(`subMenu:${parentMenu.value.uid}`)
    if (!subMenu) throwError(COMPONENT_NAME, 'can not inject sub menu')
    const subMenuContext = subMenu as SubMenuProvider

    const active = computed(() => props.index === rootMenuContext.activeIndex)
    const item: MenuItemRegistered = reactive({
      index: itemIndex.value,
      indexPath,
      active,
    })

    const handleClick = () => {
      if (!props.disabled) {
        rootMenuContext.handleMenuItemClick({
          index: itemIndex.value,
          indexPath: indexPath.value,
          route: props.route,
        })
        emit('click', item)
      }
    }

    onMounted(() => {
      subMenuContext.addSubMenu(item)
      rootMenuContext.addMenuItem(item)
    })

    onBeforeUnmount(() => {
      subMenuContext.removeSubMenu(item)
      rootMenuContext.removeMenuItem(item)
    })

    return {
      parentMenu,
      rootMenu: rootMenuContext,
      active,
      nsMenu,
      nsMenuItem,
      handleClick,
    }
  },
})
</script>
