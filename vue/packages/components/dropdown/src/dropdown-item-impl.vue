<template>
  <li
    v-if="divided"
    role="separator"
    :class="ns.bem('menu', 'item', 'divided')"
    v-bind="$attrs"
  />
  <li
    :ref="itemRef"
    v-bind="{ ...dataset, ...$attrs }"
    :aria-disabled="disabled"
    :aria-checked="checkedState"
    :class="[
      ns.be('menu', 'item'),
      ns.is('disabled', disabled),
      ns.is('multiline', multiline),
      { selected: checkedState === true },
    ]"
    :tabindex="tabIndex"
    :role="role"
    @click="(e) => $emit('clickimpl', e)"
    @focus="handleFocus"
    @keydown.self="handleKeydown"
    @mousedown="handleMousedown"
    @pointermove="(e) => $emit('pointermove', e)"
    @pointerleave="(e) => $emit('pointerleave', e)"
  >
    <el-icon v-if="icon">
      <component :is="icon" />
    </el-icon>
    <template v-if="multiline">
      <span :class="ns.be('menu', 'item-content')">
        <span :class="ns.be('menu', 'item-label')"><slot /></span>
        <span
          v-if="$slots.description"
          :class="ns.be('menu', 'item-description')"
        >
          <slot name="description" />
        </span>
      </span>
    </template>
    <slot v-else />
    <span v-if="$slots.suffix" :class="ns.be('menu', 'item-suffix')">
      <slot name="suffix" />
    </span>
  </li>
</template>

<script lang="ts">
import { computed, defineComponent, inject } from 'vue'
import {
  ROVING_FOCUS_GROUP_ITEM_INJECTION_KEY,
  ROVING_FOCUS_ITEM_COLLECTION_INJECTION_KEY,
} from '@element-plus/components/roving-focus-group'
import { COLLECTION_ITEM_SIGN } from '@element-plus/components/collection'
import { ElIcon } from '@element-plus/components/icon'
import { useNamespace } from '@element-plus/hooks'
import { composeEventHandlers, composeRefs } from '@element-plus/utils'
import { EVENT_CODE } from '@element-plus/constants'
import {
  DROPDOWN_COLLECTION_ITEM_INJECTION_KEY,
  dropdownItemProps,
} from './dropdown'
import { DROPDOWN_INJECTION_KEY } from './tokens'

import type { ComponentPublicInstance } from 'vue'

export default defineComponent({
  name: 'DropdownItemImpl',
  components: {
    ElIcon,
  },
  props: dropdownItemProps,
  emits: ['pointermove', 'pointerleave', 'click', 'clickimpl'],
  setup(props, { emit }) {
    const ns = useNamespace('dropdown')

    const { role: menuRole } = inject(DROPDOWN_INJECTION_KEY, undefined)!

    const { collectionItemRef: dropdownCollectionItemRef } = inject(
      DROPDOWN_COLLECTION_ITEM_INJECTION_KEY,
      undefined,
    )!

    const { collectionItemRef: rovingFocusCollectionItemRef } = inject(
      ROVING_FOCUS_ITEM_COLLECTION_INJECTION_KEY,
      undefined,
    )!

    const {
      rovingFocusGroupItemRef,
      tabIndex,
      handleFocus,
      handleKeydown: handleItemKeydown,
      handleMousedown,
    } = inject(ROVING_FOCUS_GROUP_ITEM_INJECTION_KEY, undefined)!

    const assignElementRef = (
      element: Element | ComponentPublicInstance | undefined,
    ) => {
      const resolvedElement =
        element instanceof HTMLElement ? element : undefined

      dropdownCollectionItemRef.value = resolvedElement ?? null
      rovingFocusCollectionItemRef.value = resolvedElement ?? null
      rovingFocusGroupItemRef.value = resolvedElement ?? null
    }

    const itemRef = composeRefs(assignElementRef)

    const role = computed<string>(() => {
      if (menuRole.value === 'menu') {
        return props.checked === undefined ? 'menuitem' : 'menuitemradio'
      } else if (menuRole.value === 'navigation') {
        return 'link'
      }
      return 'button'
    })
    const checkedState = computed(() =>
      menuRole.value === 'menu' ? props.checked : undefined,
    )

    const handleKeydown = composeEventHandlers((e: KeyboardEvent) => {
      const { code } = e
      if (code === EVENT_CODE.enter || code === EVENT_CODE.space) {
        e.preventDefault()
        e.stopImmediatePropagation()
        emit('clickimpl', e)
        return true
      }
    }, handleItemKeydown)

    return {
      ns,
      itemRef,
      dataset: {
        [COLLECTION_ITEM_SIGN]: '',
      },
      role,
      checkedState,
      tabIndex,
      handleFocus,
      handleKeydown,
      handleMousedown,
    }
  },
})
</script>
