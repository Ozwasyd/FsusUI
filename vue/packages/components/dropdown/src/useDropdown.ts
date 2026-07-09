import { computed, inject, ref } from 'vue'
import { addClass, generateId } from '@element-plus/utils'
import { EVENT_CODE } from '@element-plus/constants'
import { useNamespace } from '@element-plus/hooks'
import type { Nullable } from '@element-plus/utils'
import type { IElDropdownInstance } from './dropdown'

export const useDropdown = () => {
  const elDropdown = inject<IElDropdownInstance>('elDropdown', {})
  const _elDropdownSize = computed(() => elDropdown?.dropdownSize)

  return {
    elDropdown,
    _elDropdownSize,
  }
}

type DropdownLegacyInstance = {
  props: {
    hideOnClick: boolean
    splitButton: boolean
    tabindex: string | number
  }
  handleClick: () => void
  hide: () => void
}

type DropdownVNodeContainer = {
  subTree?: {
    el?: Element | null
  }
}

export const initDropdownDomEvent = (
  dropdownChildren: DropdownVNodeContainer | undefined,
  triggerElm: HTMLElement,
  _instance: DropdownLegacyInstance
) => {
  const ns = useNamespace('dropdown')
  const menuItems = ref<Nullable<HTMLButtonElement[]>>(null)
  const menuItemsArray = ref<Nullable<HTMLElement[]>>(null)
  const dropdownElm = ref<Nullable<HTMLElement>>(null)
  const listId = ref(`dropdown-menu-${generateId()}`)
  dropdownElm.value =
    dropdownChildren?.subTree?.el instanceof HTMLElement
      ? dropdownChildren.subTree.el
      : null

  function removeTabindex() {
    triggerElm.setAttribute('tabindex', '-1')
    menuItemsArray.value?.forEach((item) => {
      item.setAttribute('tabindex', '-1')
    })
  }

  function resetTabindex(ele?: HTMLElement | null) {
    removeTabindex()
    ele?.setAttribute('tabindex', '0')
  }

  function handleTriggerKeyDown(ev: KeyboardEvent) {
    const code = ev.code
    if ([EVENT_CODE.up, EVENT_CODE.down].includes(code)) {
      removeTabindex()
      resetTabindex(menuItems.value?.[0])
      menuItems.value?.[0]?.focus()
      ev.preventDefault()
      ev.stopPropagation()
    } else if (code === EVENT_CODE.enter) {
      _instance.handleClick()
    } else if ([EVENT_CODE.tab, EVENT_CODE.esc].includes(code)) {
      _instance.hide()
    }
  }

  function handleItemKeyDown(ev: KeyboardEvent) {
    const code = ev.code
    const target = ev.target as HTMLElement | null
    const currentIndex = menuItemsArray.value?.indexOf(target as HTMLElement) ?? -1
    const max = (menuItemsArray.value?.length ?? 0) - 1
    if ([EVENT_CODE.up, EVENT_CODE.down].includes(code)) {
      const nextIndex =
        code === EVENT_CODE.up
          ? currentIndex !== 0
            ? currentIndex - 1
            : 0
          : currentIndex < max
            ? currentIndex + 1
            : max
      removeTabindex()
      resetTabindex(menuItems.value?.[nextIndex])
      menuItems.value?.[nextIndex]?.focus()
      ev.preventDefault()
      ev.stopPropagation()
    } else if (code === EVENT_CODE.enter) {
      triggerElmFocus()
      target?.click()
      if (_instance.props.hideOnClick) {
        _instance.hide()
      }
    } else if ([EVENT_CODE.tab, EVENT_CODE.esc].includes(code)) {
      _instance.hide()
      triggerElmFocus()
    }
  }

  function initAria() {
    dropdownElm.value?.setAttribute('id', listId.value)
    triggerElm.setAttribute('aria-haspopup', 'list')
    triggerElm.setAttribute('aria-controls', listId.value)
    if (!_instance.props.splitButton) {
      triggerElm.setAttribute('role', 'button')
      triggerElm.setAttribute('tabindex', `${_instance.props.tabindex}`)
      addClass(triggerElm, ns.b('selfdefine'))
    }
  }

  function initEvent() {
    triggerElm?.addEventListener('keydown', handleTriggerKeyDown)
    dropdownElm.value?.addEventListener('keydown', handleItemKeyDown, true)
  }

  function initDomOperation() {
    if (!dropdownElm.value) {
      return
    }

    menuItems.value = dropdownElm.value.querySelectorAll(
      "[tabindex='-1']"
    ) as unknown as HTMLButtonElement[]
    menuItemsArray.value = Array.from(menuItems.value)

    initEvent()
    initAria()
  }

  function triggerElmFocus() {
    triggerElm.focus()
  }

  initDomOperation()
}
