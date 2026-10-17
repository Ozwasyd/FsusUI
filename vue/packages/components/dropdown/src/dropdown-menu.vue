<template>
  <ul
    :ref="dropdownListWrapperRef"
    :class="dropdownKls"
    :style="rovingFocusGroupRootStyle"
    :tabindex="-1"
    :role="role"
    :aria-labelledby="triggerId"
    @blur="onBlur"
    @focus="onFocus"
    @keydown="handleKeydown"
    @mousedown.self="onMousedown"
  >
    <slot />
  </ul>
</template>
<script lang="ts">
import { computed, defineComponent, inject, onBeforeUnmount, unref } from 'vue'
import { composeEventHandlers, composeRefs } from '@element-plus/utils'
import { EVENT_CODE } from '@element-plus/constants'
import { FOCUS_TRAP_INJECTION_KEY } from '@element-plus/components/focus-trap'
import {
  ROVING_FOCUS_COLLECTION_INJECTION_KEY,
  ROVING_FOCUS_GROUP_INJECTION_KEY,
  focusFirst,
} from '@element-plus/components/roving-focus-group'
import { useNamespace } from '@element-plus/hooks'
import { DROPDOWN_INJECTION_KEY } from './tokens'
import {
  DROPDOWN_COLLECTION_INJECTION_KEY,
  FIRST_LAST_KEYS,
  LAST_KEYS,
  dropdownMenuProps,
} from './dropdown'
import { useDropdown } from './useDropdown'

import type { ComponentPublicInstance } from 'vue'

const TYPEAHEAD_TIMEOUT = 1000

const isTypeaheadEvent = (event: KeyboardEvent) =>
  event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey

const isEditableElement = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable ||
    ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))

const getItemTextValue = (item: Record<string, any>) => {
  const textValue = item.textValue ?? item['text-value']

  return `${
    typeof textValue === 'string' && textValue.trim().length > 0
      ? textValue
      : (item.ref?.textContent ?? '')
  }`
    .trim()
    .toLowerCase()
}

const normalizeTypeaheadSearch = (value: string) => {
  if (value.length <= 1) {
    return value
  }

  return new Set(value).size === 1 ? value[0] : value
}

export default defineComponent({
  name: 'ElDropdownMenu',
  props: dropdownMenuProps,
  setup(props) {
    const ns = useNamespace('dropdown')
    const { _elDropdownSize } = useDropdown()
    const size = _elDropdownSize.value

    const { focusTrapRef, onKeydown } = inject(
      FOCUS_TRAP_INJECTION_KEY,
      undefined,
    )!

    const { contentRef, role, triggerId, onMenuKeydown } = inject(
      DROPDOWN_INJECTION_KEY,
      undefined,
    )!

    const { collectionRef: dropdownCollectionRef, getItems } = inject(
      DROPDOWN_COLLECTION_INJECTION_KEY,
      undefined,
    )!

    const {
      rovingFocusGroupRef,
      rovingFocusGroupRootStyle,
      tabIndex,
      onItemFocus,
      onBlur,
      onFocus,
      onMousedown,
    } = inject(ROVING_FOCUS_GROUP_INJECTION_KEY, undefined)!

    const {
      collectionRef: rovingFocusGroupCollectionRef,
      getItems: getRovingFocusItems,
    } = inject(ROVING_FOCUS_COLLECTION_INJECTION_KEY, undefined)!

    const dropdownKls = computed(() => {
      return [ns.b('menu'), ns.bm('menu', size?.value)]
    })

    const assignWrapperRef = (
      element: Element | ComponentPublicInstance | undefined,
    ) => {
      const resolvedElement =
        element instanceof HTMLElement ? element : undefined

      contentRef.value = resolvedElement ?? null
      dropdownCollectionRef.value = resolvedElement ?? null
      focusTrapRef.value = resolvedElement
      rovingFocusGroupRef.value = resolvedElement ?? null
      rovingFocusGroupCollectionRef.value = resolvedElement ?? null
    }

    const dropdownListWrapperRef = composeRefs(assignWrapperRef)

    let typeaheadSearch = ''
    let typeaheadTimer: ReturnType<typeof setTimeout> | undefined

    const clearTypeaheadState = () => {
      typeaheadSearch = ''
      if (typeaheadTimer) {
        clearTimeout(typeaheadTimer)
        typeaheadTimer = undefined
      }
    }

    const focusMatchingItem = (
      search: string,
      currentTarget?: EventTarget | null,
    ) => {
      const items = getItems<{ disabled: boolean }>().filter(
        (item) => !item.disabled,
      )
      if (!items.length) return

      const activeElement = document.activeElement
      const activeIndex = items.findIndex(
        (item) => item.ref === activeElement || item.ref === currentTarget,
      )
      const orderedItems =
        activeIndex === -1
          ? items
          : [
              ...items.slice(activeIndex + 1),
              ...items.slice(0, activeIndex + 1),
            ]
      const normalizedSearch = normalizeTypeaheadSearch(search)
      const matchedItem = orderedItems.find((item) =>
        getItemTextValue(item).startsWith(normalizedSearch),
      )

      if (!matchedItem?.ref) return

      const rovingItem = getRovingFocusItems<{ id: string }>().find(
        (item) => item.ref === matchedItem.ref,
      )

      if (rovingItem?.id) {
        onItemFocus(rovingItem.id)
      }

      focusFirst([matchedItem.ref])
    }

    const handleTypeaheadSearch = (event: KeyboardEvent) => {
      if (!isTypeaheadEvent(event) || isEditableElement(event.target)) {
        return false
      }

      typeaheadSearch = `${typeaheadSearch}${event.key.toLowerCase()}`
      focusMatchingItem(typeaheadSearch, event.target)

      if (typeaheadTimer) {
        clearTimeout(typeaheadTimer)
      }

      typeaheadTimer = setTimeout(() => {
        typeaheadSearch = ''
        typeaheadTimer = undefined
      }, TYPEAHEAD_TIMEOUT)

      return true
    }

    onBeforeUnmount(() => {
      clearTypeaheadState()
    })

    const composedKeydown = composeEventHandlers(
      (e: KeyboardEvent) => {
        props.onKeydown?.(e)
      },
      (e) => {
        const { currentTarget, code, target } = e
        const content = unref(contentRef)

        if (
          target &&
          (currentTarget as Node).contains(target as Node) &&
          handleTypeaheadSearch(e)
        ) {
          e.preventDefault()
          return
        }

        if (EVENT_CODE.tab === code && target === content) {
          e.stopImmediatePropagation()
          return
        }

        if (target !== content) return
        if (!FIRST_LAST_KEYS.includes(code)) return
        e.preventDefault()
        const items = getItems<{ disabled: boolean }>().filter(
          (item) => !item.disabled,
        )
        const targets = items.map((item) => item.ref!)
        if (LAST_KEYS.includes(code)) {
          targets.reverse()
        }
        focusFirst(targets)
      },
    )

    const handleKeydown = (e: KeyboardEvent) => {
      composedKeydown(e)
      onKeydown(e)
      if (!e.cancelBubble) onMenuKeydown(e)
    }

    return {
      size,
      rovingFocusGroupRootStyle,
      tabIndex,
      dropdownKls,
      role,
      triggerId,
      dropdownListWrapperRef,
      handleKeydown,
      onMenuKeydown,
      onBlur,
      onFocus,
      onMousedown,
    }
  },
})
</script>
