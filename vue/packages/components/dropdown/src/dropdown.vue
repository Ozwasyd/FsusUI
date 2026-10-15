<template>
  <div
    v-bind="componentMotionAttrs"
    :class="[ns.b(), ns.is('disabled', disabled)]"
    @keydown="handleTriggerKeydown"
  >
    <el-tooltip ref="popperRef" v-bind="tooltipBindings" v-on="tooltipEvents">
      <template #content>
        <el-scrollbar
          ref="scrollbar"
          :wrap-style="wrapStyle"
          tag="div"
          :view-class="ns.e('list')"
        >
          <el-roving-focus-group
            v-bind="rovingFocusGroupBindings"
            v-on="rovingFocusGroupEvents"
          >
            <el-dropdown-collection>
              <slot name="dropdown" />
            </el-dropdown-collection>
          </el-roving-focus-group>
        </el-scrollbar>
      </template>
      <template v-if="!splitButton" #default>
        <el-only-child ref="triggeringElementRef" v-bind="defaultTriggerAttrs">
          <slot name="default" />
        </el-only-child>
      </template>
    </el-tooltip>
    <template v-if="splitButton">
      <el-button-group>
        <el-button
          ref="referenceElementRef"
          v-bind="mainButtonAttrs"
          :size="dropdownSize"
          :type="type"
          :disabled="disabled"
          @click="handlerMainButtonClick"
        >
          <slot name="default" />
        </el-button>
        <el-button
          ref="triggeringElementRef"
          v-bind="caretButtonAttrs"
          :size="dropdownSize"
          :type="type"
          :class="ns.e('caret-button')"
          :disabled="disabled"
        >
          <el-icon :class="ns.e('icon')"><arrow-down /></el-icon>
        </el-button>
      </el-button-group>
    </template>
  </div>
</template>
<script lang="ts">
import {
  computed,
  defineComponent,
  getCurrentInstance,
  nextTick,
  onBeforeUnmount,
  provide,
  ref,
  toRef,
} from 'vue'
import ElButton from '@element-plus/components/button'
import ElTooltip from '@element-plus/components/tooltip'
import ElScrollbar from '@element-plus/components/scrollbar'
import ElIcon from '@element-plus/components/icon'
import ElRovingFocusGroup from '@element-plus/components/roving-focus-group'
import { ElOnlyChild } from '@element-plus/components/slot'
import { useFormSize } from '@element-plus/components/form'
import { addUnit, ensureArray } from '@element-plus/utils'
import { ArrowDown } from '@element-plus/icons-vue'
import { EVENT_CODE } from '@element-plus/constants'
import { useId, useLocale, useNamespace } from '@element-plus/hooks'
import {
  resolveComponentTransitionName,
  useComponentMotionAttrs,
} from '@element-plus/components/motion'
import { ElCollection as ElDropdownCollection, dropdownProps } from './dropdown'
import { DROPDOWN_INJECTION_KEY } from './tokens'
import { dropdownViewportModifiers } from './viewport-modifiers'

import type { CSSProperties, ComponentPublicInstance } from 'vue'
import type { Measurable } from '@element-plus/components/popper'
import type { Placement } from '@element-plus/components/popper'

const { ButtonGroup: ElButtonGroup } = ElButton

export default defineComponent({
  name: 'ElDropdown',
  components: {
    ElButton,
    ElButtonGroup,
    ElScrollbar,
    ElDropdownCollection,
    ElTooltip,
    ElRovingFocusGroup,
    ElOnlyChild,
    ElIcon,
    ArrowDown,
  },
  props: dropdownProps,
  emits: ['visible-change', 'click', 'command'],
  setup(props, { emit }) {
    const _instance = getCurrentInstance()
    const ns = useNamespace('dropdown')
    const { t } = useLocale()

    const triggeringElementRef = ref<
      (ComponentPublicInstance & { $el: HTMLElement }) | null
    >(null)
    const referenceElementRef = ref<
      (ComponentPublicInstance & { $el: HTMLElement }) | null
    >(null)
    const popperRef = ref<InstanceType<typeof ElTooltip> | null>(null)
    let focusRestoreGeneration = 0
    let stopFocusRestore: (() => void) | undefined
    let focusRestoreRequest:
      | { generation: number; trigger: HTMLElement; content: HTMLElement }
      | undefined
    let popupVisible = false
    const contentRef = ref<HTMLElement | null>(null)
    const scrollbar = ref(null)
    const currentTabId = ref<string | null>(null)
    const isUsingKeyboard = ref(false)
    const triggerKeys = [
      EVENT_CODE.enter,
      EVENT_CODE.space,
      EVENT_CODE.down,
      EVENT_CODE.up,
    ]
    const triggerTargetEl = computed(() => contentRef.value ?? undefined)
    const virtualRef = computed<Measurable | undefined>(
      () => triggeringElementRef.value?.$el ?? undefined,
    )

    const wrapStyle = computed<CSSProperties>(() => ({
      maxHeight: props.viewportBounded
        ? `min(${addUnit(props.maxHeight) || '274px'}, calc(var(--el-dropdown-viewport-height, 100dvh) - 24px))`
        : addUnit(props.maxHeight),
    }))
    const dropdownTriggerKls = computed(() => [ns.m(dropdownSize.value)])
    const trigger = computed(() => ensureArray(props.trigger))
    const componentMotionAttrs = useComponentMotionAttrs(
      toRef(props, 'motion'),
      'fade-down',
    )
    const dropdownTransitionName = computed(() =>
      resolveComponentTransitionName(
        props.motion,
        `${ns.namespace.value}-zoom-in-top`,
        {
          'fade-down': `${ns.namespace.value}-zoom-in-top`,
          'scale-fade': `${ns.namespace.value}-zoom-in-top`,
        },
      ),
    )

    const defaultTriggerId = useId().value
    const triggerId = computed<string>(() => {
      return props.id || defaultTriggerId
    })
    const fallbackPlacements: Placement[] = ['bottom', 'top']
    const tooltipBindings = computed(() => ({
      role: props.role,
      effect: props.effect,
      fallbackPlacements,
      popperOptions: props.viewportBounded
        ? {
            ...props.popperOptions,
            modifiers: [
              ...dropdownViewportModifiers(),
              ...(props.popperOptions.modifiers || []),
            ],
          }
        : props.popperOptions,
      hideAfter: trigger.value.includes('hover') ? props.hideTimeout : 0,
      placement: props.placement,
      popperClass: [
        ns.e('popper'),
        ns.is('viewport-bounded', props.viewportBounded),
        props.popperClass,
      ],
      referenceElement: referenceElementRef.value?.$el,
      trigger: trigger.value,
      triggerKeys,
      triggerTargetEl: triggerTargetEl.value,
      showAfter: trigger.value.includes('hover') ? props.showTimeout : 0,
      stopPopperMouseEvent: false,
      virtualRef: virtualRef.value,
      virtualTriggering: props.splitButton,
      disabled: props.disabled,
      transition: dropdownTransitionName.value,
      teleported: props.teleported,
      pure: true,
      persistent: false,
    }))
    const tooltipEvents = {
      'before-show': handleBeforeShowTooltip,
      show: handleShowTooltip,
      'before-hide': handleBeforeHideTooltip,
    }
    const rovingFocusGroupBindings = computed(() => ({
      loop: props.loop,
      currentTabId: currentTabId.value,
      orientation: 'horizontal',
    }))
    const rovingFocusGroupEvents = {
      currentTabIdChange: handleCurrentTabIdChange,
      entryFocus: handleEntryFocus,
    }
    const defaultTriggerAttrs = computed(() => ({
      id: triggerId.value,
      role: 'button',
      tabindex: props.tabindex,
    }))
    const mainButtonAttrs = computed<Record<string, unknown>>(() => ({
      ...(props.buttonProps ?? {}),
      tabindex: props.tabindex,
    }))
    const caretButtonAttrs = computed<Record<string, unknown>>(() => ({
      ...(props.buttonProps ?? {}),
      id: triggerId.value,
      role: 'button',
      tabindex: props.tabindex,
      'aria-label': t('el.dropdown.toggleDropdown'),
    }))

    function handleClick() {
      handleClose()
    }

    function handleClose() {
      cancelFocusRestore()
      popperRef.value?.onClose()
    }

    function handleOpen() {
      cancelFocusRestore()
      popperRef.value?.onOpen()
    }

    const dropdownSize = useFormSize()

    function commandHandler(...args: any[]) {
      emit('command', ...args)
    }

    function onItemEnter() {
      // NOOP for now
    }

    function onItemLeave() {
      currentTabId.value = null
    }

    function handleCurrentTabIdChange(id: string) {
      currentTabId.value = id
    }

    function handleEntryFocus(e: Event) {
      if (!isUsingKeyboard.value) {
        e.preventDefault()
        e.stopImmediatePropagation()
      }
    }

    function handleBeforeShowTooltip(event?: Event) {
      popupVisible = true
      cancelFocusRestore()
      isUsingKeyboard.value = event?.type === 'keydown'
      emit('visible-change', true)
    }

    function handleShowTooltip(event?: Event) {
      if (event?.type === 'keydown') {
        contentRef.value?.focus()
      }
    }

    function handleBeforeHideTooltip() {
      popupVisible = false
      const request = focusRestoreRequest
      emit('visible-change', false)

      if (!request) return
      nextTick(() => {
        if (
          focusRestoreRequest !== request ||
          request.generation !== focusRestoreGeneration ||
          popupVisible
        ) {
          return
        }

        const { trigger, content } = request
        const document = trigger.ownerDocument
        const focused = document.activeElement
        const ownsFocus =
          content.contains(focused) ||
          (!content.isConnected && focused === document.body)
        cancelFocusRestore()
        if (
          ownsFocus &&
          document.hasFocus() &&
          trigger === triggeringElementRef.value?.$el &&
          trigger.isConnected &&
          !props.disabled
        ) {
          trigger.focus({ preventScroll: true })
        }
      })
    }

    function handleContentKeydown(event: KeyboardEvent) {
      if (event.code === EVENT_CODE.esc) requestFocusRestore()
    }

    function handleTriggerKeydown(event: KeyboardEvent) {
      if (!props.disabled && triggerKeys.includes(event.code)) {
        cancelFocusRestore()
      }
      if (event.code !== EVENT_CODE.esc) return

      if (popupVisible) {
        event.preventDefault()
        event.stopPropagation()
        requestFocusRestore()
      }
      // onClose also replaces a show-timeout before before-show has fired.
      popperRef.value?.onClose(event)
    }

    function cancelFocusRestore() {
      ++focusRestoreGeneration
      focusRestoreRequest = undefined
      stopFocusRestore?.()
      stopFocusRestore = undefined
    }

    function requestFocusRestore() {
      cancelFocusRestore()
      const trigger = triggeringElementRef.value?.$el
      const content = contentRef.value
      if (!popupVisible || !trigger || !content) return
      const document = trigger.ownerDocument
      if (!content.contains(document.activeElement)) return

      const request = { generation: focusRestoreGeneration, trigger, content }
      focusRestoreRequest = request
      const revoke = () => {
        if (focusRestoreRequest === request) cancelFocusRestore()
      }
      const onFocusIn = (event: FocusEvent) => {
        if (!content.contains(event.target as Node)) revoke()
      }
      // A released trap or newer input owns focus; never reclaim it after leave.
      document.addEventListener('focusin', onFocusIn, true)
      document.addEventListener('keydown', revoke, true)
      document.addEventListener('pointerdown', revoke, true)
      document.addEventListener('pointermove', revoke, true)
      stopFocusRestore = () => {
        document.removeEventListener('focusin', onFocusIn, true)
        document.removeEventListener('keydown', revoke, true)
        document.removeEventListener('pointerdown', revoke, true)
        document.removeEventListener('pointermove', revoke, true)
      }
    }

    onBeforeUnmount(cancelFocusRestore)

    provide(DROPDOWN_INJECTION_KEY, {
      contentRef,
      role: computed(() => props.role),
      triggerId,
      isUsingKeyboard,
      onItemEnter,
      onItemLeave,
      onMenuKeydown: handleContentKeydown,
    })

    provide('elDropdown', {
      instance: _instance,
      dropdownSize,
      handleClick,
      commandHandler,
      trigger: toRef(props, 'trigger'),
      hideOnClick: toRef(props, 'hideOnClick'),
    })

    const onFocusAfterTrapped = (e: Event) => {
      e.preventDefault()
      contentRef.value?.focus?.({
        preventScroll: true,
      })
    }

    const handlerMainButtonClick = (event: MouseEvent) => {
      emit('click', event)
    }

    return {
      t,
      ns,
      scrollbar,
      wrapStyle,
      dropdownTriggerKls,
      dropdownSize,
      componentMotionAttrs,
      triggerId,
      triggerKeys,
      tooltipBindings,
      tooltipEvents,
      rovingFocusGroupBindings,
      rovingFocusGroupEvents,
      defaultTriggerAttrs,
      mainButtonAttrs,
      caretButtonAttrs,
      triggerTargetEl,
      virtualRef,
      currentTabId,
      handleCurrentTabIdChange,
      handlerMainButtonClick,
      handleEntryFocus,
      handleClose,
      handleOpen,
      handleBeforeShowTooltip,
      handleShowTooltip,
      handleBeforeHideTooltip,
      handleContentKeydown,
      handleTriggerKeydown,
      onFocusAfterTrapped,
      popperRef,
      contentRef,
      triggeringElementRef,
      referenceElementRef,
    }
  },
})
</script>
