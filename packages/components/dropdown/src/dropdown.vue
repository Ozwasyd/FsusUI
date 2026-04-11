<template>
  <div :class="[ns.b(), ns.is('disabled', disabled)]">
    <el-tooltip ref="popperRef" v-bind="tooltipBindings" v-on="tooltipEvents">
      <template #content>
        <el-scrollbar
          ref="scrollbar"
          :wrap-style="wrapStyle"
          tag="div"
          :view-class="ns.e('list')"
        >
          <el-roving-focus-group v-bind="rovingFocusGroupBindings" v-on="rovingFocusGroupEvents">
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
  onBeforeUnmount,
  provide,
  ref,
  toRef,
  unref,
  watch,
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
import { ElCollection as ElDropdownCollection, dropdownProps } from './dropdown'
import { DROPDOWN_INJECTION_KEY } from './tokens'

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

    const triggeringElementRef = ref<(ComponentPublicInstance & { $el: HTMLElement }) | null>(null)
    const referenceElementRef = ref<(ComponentPublicInstance & { $el: HTMLElement }) | null>(null)
    const popperRef = ref<InstanceType<typeof ElTooltip> | null>(null)
    const contentRef = ref<HTMLElement | null>(null)
    const scrollbar = ref(null)
    const currentTabId = ref<string | null>(null)
    const isUsingKeyboard = ref(false)
    const triggerKeys = [EVENT_CODE.enter, EVENT_CODE.space, EVENT_CODE.down]
    const triggerTargetEl = computed(() => contentRef.value ?? undefined)
    const virtualRef = computed<Measurable | undefined>(
      () => triggeringElementRef.value?.$el ?? undefined
    )

    const wrapStyle = computed<CSSProperties>(() => ({
      maxHeight: addUnit(props.maxHeight),
    }))
    const dropdownTriggerKls = computed(() => [ns.m(dropdownSize.value)])
    const trigger = computed(() => ensureArray(props.trigger))

    const defaultTriggerId = useId().value
    const triggerId = computed<string>(() => {
      return props.id || defaultTriggerId
    })
    const fallbackPlacements: Placement[] = ['bottom', 'top']
    const tooltipBindings = computed(() => ({
      role: props.role,
      effect: props.effect,
      fallbackPlacements,
      popperOptions: props.popperOptions,
      gpuAcceleration: false,
      hideAfter: trigger.value.includes('hover') ? props.hideTimeout : 0,
      placement: props.placement,
      popperClass: [ns.e('popper'), props.popperClass],
      referenceElement: referenceElementRef.value?.$el,
      trigger: trigger.value,
      triggerKeys,
      triggerTargetEl: triggerTargetEl.value,
      showAfter: trigger.value.includes('hover') ? props.showTimeout : 0,
      stopPopperMouseEvent: false,
      virtualRef: virtualRef.value,
      virtualTriggering: props.splitButton,
      disabled: props.disabled,
      transition: `${ns.namespace.value}-zoom-in-top`,
      teleported: props.teleported,
      pure: true,
      persistent: true,
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

    // The goal of this code is to focus on the tooltip triggering element when it is hovered.
    // This is a temporary fix for where closing the dropdown through pointerleave event focuses on a
    // completely different element. For a permanent solution, remove all calls to any "element.focus()"
    // that are triggered through pointer enter/leave events.
    watch(
      [triggeringElementRef, trigger],
      ([triggeringElement, trigger], [prevTriggeringElement]) => {
        if (prevTriggeringElement?.$el?.removeEventListener) {
          prevTriggeringElement.$el.removeEventListener(
            'pointerenter',
            onAutofocusTriggerEnter
          )
        }
        if (triggeringElement?.$el?.removeEventListener) {
          triggeringElement.$el.removeEventListener(
            'pointerenter',
            onAutofocusTriggerEnter
          )
        }
        if (
          triggeringElement?.$el?.addEventListener &&
          trigger.includes('hover')
        ) {
          triggeringElement.$el.addEventListener(
            'pointerenter',
            onAutofocusTriggerEnter
          )
        }
      },
      { immediate: true }
    )

    onBeforeUnmount(() => {
      if (triggeringElementRef.value?.$el?.removeEventListener) {
        triggeringElementRef.value.$el.removeEventListener(
          'pointerenter',
          onAutofocusTriggerEnter
        )
      }
    })

    function handleClick() {
      handleClose()
    }

    function handleClose() {
      popperRef.value?.onClose()
    }

    function handleOpen() {
      popperRef.value?.onOpen()
    }

    const dropdownSize = useFormSize()

    function commandHandler(...args: any[]) {
      emit('command', ...args)
    }

    function onAutofocusTriggerEnter() {
      triggeringElementRef.value?.$el?.focus()
    }

    function onItemEnter() {
      // NOOP for now
    }

    function onItemLeave() {
      const contentEl = unref(contentRef)

      if (trigger.value.includes('hover')) {
        contentEl?.focus()
      }
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

    function handleBeforeShowTooltip() {
      emit('visible-change', true)
    }

    function handleShowTooltip(event?: Event) {
      if (event?.type === 'keydown') {
        contentRef.value?.focus()
      }
    }

    function handleBeforeHideTooltip() {
      emit('visible-change', false)
    }

    provide(DROPDOWN_INJECTION_KEY, {
      contentRef,
      role: computed(() => props.role),
      triggerId,
      isUsingKeyboard,
      onItemEnter,
      onItemLeave,
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
      onFocusAfterTrapped,
      popperRef,
      contentRef,
      triggeringElementRef,
      referenceElementRef,
    }
  },
})
</script>
