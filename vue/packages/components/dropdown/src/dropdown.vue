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
  watch,
} from 'vue'
import ElButton from '@element-plus/components/button'
import ElTooltip from '@element-plus/components/tooltip'
import ElScrollbar from '@element-plus/components/scrollbar'
import ElIcon from '@element-plus/components/icon'
import ElRovingFocusGroup from '@element-plus/components/roving-focus-group'
import { FOCUS_AFTER_RELEASED } from '@element-plus/components/focus-trap'
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

import type { CSSProperties, ComponentPublicInstance, Ref } from 'vue'
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
    let entryFocusRequest:
      | {
          reason: Event
          trigger: HTMLElement
          content: HTMLElement | null
          initialFocus: Element | null
        }
      | undefined
    let stopEntryFocus: (() => void) | undefined
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
      cancelEntryFocus()
      cancelFocusRestore()
      popperRef.value?.onClose()
    }

    function handleOpen() {
      cancelEntryFocus()
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
      requestEntryFocus(event)
      emit('visible-change', true)
    }

    function handleShowTooltip(event?: Event) {
      const request = entryFocusRequest
      if (!request || request.reason !== event) return
      const content = contentRef.value
      const { trigger, initialFocus } = request
      cancelEntryFocus()
      if (
        popupVisible &&
        !props.disabled &&
        trigger === triggeringElementRef.value?.$el &&
        trigger.isConnected &&
        !trigger.matches(':disabled, [aria-disabled="true"]') &&
        content &&
        content === request.content &&
        content.isConnected &&
        trigger.ownerDocument.activeElement === initialFocus
      ) {
        content.focus()
      }
    }

    function cancelEntryFocus() {
      entryFocusRequest = undefined
      stopEntryFocus?.()
      stopEntryFocus = undefined
    }

    function requestEntryFocus(reason?: Event) {
      cancelEntryFocus()
      const trigger = triggeringElementRef.value?.$el
      if (reason?.type !== 'keydown' || !trigger) return
      const document = trigger.ownerDocument
      const initialFocus = document.activeElement
      if (initialFocus !== trigger && initialFocus !== document.body) return

      const request = {
        reason,
        trigger,
        content: contentRef.value,
        initialFocus,
      }
      entryFocusRequest = request
      const revoke = () => {
        if (entryFocusRequest === request) cancelEntryFocus()
      }
      // The original keydown owns entry only until newer input or focus wins.
      document.addEventListener('focusin', revoke, true)
      document.addEventListener('keydown', revoke, true)
      document.addEventListener('pointerdown', revoke, true)
      document.addEventListener('visibilitychange', revoke)
      document.defaultView?.addEventListener('blur', revoke)
      stopEntryFocus = () => {
        document.removeEventListener('focusin', revoke, true)
        document.removeEventListener('keydown', revoke, true)
        document.removeEventListener('pointerdown', revoke, true)
        document.removeEventListener('visibilitychange', revoke)
        document.defaultView?.removeEventListener('blur', revoke)
      }
    }

    watch(
      [contentRef, () => triggeringElementRef.value?.$el, () => props.disabled],
      () => {
        const request = entryFocusRequest
        if (!request) return
        if (
          props.disabled ||
          request.trigger !== triggeringElementRef.value?.$el ||
          (request.content && request.content !== contentRef.value)
        ) {
          cancelEntryFocus()
        } else if (!request.content) {
          request.content = contentRef.value
        }
      },
      { flush: 'sync' },
    )

    function handleBeforeHideTooltip() {
      popupVisible = false
      cancelEntryFocus()
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
          (!contentRef.value || contentRef.value === content) &&
          (content.contains(focused) ||
            (!content.isConnected && focused === document.body))
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

    function handleContentKeydown(
      event: KeyboardEvent,
      trapRef: Ref<HTMLElement | undefined>,
    ) {
      if (event.code === EVENT_CODE.esc) requestFocusRestore(trapRef)
    }

    function handleTriggerKeydown(event: KeyboardEvent) {
      if (!props.disabled && triggerKeys.includes(event.code)) {
        cancelFocusRestore()
      }
      if (event.code !== EVENT_CODE.esc) return

      if (popupVisible) {
        event.preventDefault()
        event.stopPropagation()
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

    function requestFocusRestore(trapRef: Ref<HTMLElement | undefined>) {
      cancelFocusRestore()
      const trigger = triggeringElementRef.value?.$el
      const content = contentRef.value
      const trap = trapRef.value
      if (!popupVisible || !trigger || !content || !trap) return
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
      const onFocusReleased = (event: Event) => {
        const focused = document.activeElement
        if (
          event.target === trap &&
          trapRef.value === trap &&
          contentRef.value === content &&
          focusRestoreRequest === request &&
          request.generation === focusRestoreGeneration &&
          trigger === triggeringElementRef.value?.$el &&
          trigger.isConnected &&
          !props.disabled &&
          document.hasFocus() &&
          (content.contains(focused) ||
            (!content.isConnected && focused === document.body))
        ) {
          // This Escape owns the return to its trigger, not the trap's prior input.
          event.preventDefault()
        }
      }
      trap.addEventListener(FOCUS_AFTER_RELEASED, onFocusReleased, true)
      // External focus or newer input revokes ownership; leave never reclaims it.
      document.addEventListener('focusin', onFocusIn, true)
      document.addEventListener('keydown', revoke, true)
      document.addEventListener('pointerdown', revoke, true)
      document.addEventListener('pointermove', revoke, true)
      stopFocusRestore = () => {
        trap.removeEventListener(FOCUS_AFTER_RELEASED, onFocusReleased, true)
        document.removeEventListener('focusin', onFocusIn, true)
        document.removeEventListener('keydown', revoke, true)
        document.removeEventListener('pointerdown', revoke, true)
        document.removeEventListener('pointermove', revoke, true)
      }
    }

    onBeforeUnmount(() => {
      cancelEntryFocus()
      cancelFocusRestore()
    })

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
