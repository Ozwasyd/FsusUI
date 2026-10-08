<template>
  <slot :handle-keydown="onKeydown" />
</template>
<script lang="ts">
import {
  defineComponent,
  inject,
  nextTick,
  onBeforeUnmount,
  onMounted,
  provide,
  ref,
  unref,
  watch,
} from 'vue'
import { isNil } from 'lodash-unified'
import { EVENT_CODE } from '@element-plus/constants'
import { useEscapeKeydown } from '@element-plus/hooks'
import { isString } from '@element-plus/utils'
import { focusRestoreTargetKey } from './restore-target'
import {
  createFocusOutPreventedEvent,
  focusFirstDescendant,
  focusableStack,
  getEdges,
  getPointerFocusTarget,
  invalidateFocusableCache,
  isFocusCausedByUserEvent,
  obtainAllFocusableElements,
  tryFocus,
  useFocusReason,
} from './utils'
import {
  FOCUS_AFTER_RELEASED,
  FOCUS_AFTER_TRAPPED,
  FOCUS_AFTER_TRAPPED_OPTS,
  FOCUS_TRAP_INJECTION_KEY,
  ON_RELEASE_FOCUS_EVT,
  ON_TRAP_FOCUS_EVT,
} from './tokens'

import type { PropType } from 'vue'
import type { FocusLayer } from './utils'

export default defineComponent({
  name: 'ElFocusTrap',
  inheritAttrs: false,
  props: {
    loop: Boolean,
    trapped: Boolean,
    focusTrapEl: Object as PropType<HTMLElement>,
    focusStartEl: {
      type: [Object, String] as PropType<'container' | 'first' | HTMLElement>,
      default: 'first',
    },
  },
  emits: [
    ON_TRAP_FOCUS_EVT,
    ON_RELEASE_FOCUS_EVT,
    'focusin',
    'focusout',
    'focusout-prevented',
    'release-requested',
    'focus-layer-change',
  ],
  setup(props, { emit }) {
    const restoreTarget = inject(focusRestoreTargetKey, null)
    // Descendant traps must capture their own opener, not inherit this session.
    provide(focusRestoreTargetKey, null)
    const forwardRef = ref<HTMLElement | undefined>()
    let lastFocusBeforeTrapped: HTMLElement | null
    let lastFocusAfterTrapped: HTMLElement | null
    let focusableObserver: MutationObserver | undefined
    let trapGeneration = 0
    let trapActive = false
    let lastLayerState: { active: boolean; paused: boolean } | undefined

    const { focusReason } = useFocusReason()

    useEscapeKeydown((event) => {
      if (props.trapped && !focusLayer.paused) {
        emit('release-requested', event)
      }
    })

    const focusLayer: FocusLayer = {
      paused: false,
      pause() {
        this.paused = true
        notifyLayerState()
      },
      resume() {
        this.paused = false
        notifyLayerState()
      },
    }

    // Modal isolation observes this owner; it must not register another layer.
    function notifyLayerState() {
      const state = { active: trapActive, paused: focusLayer.paused }
      if (
        lastLayerState?.active === state.active &&
        lastLayerState.paused === state.paused
      )
        return
      lastLayerState = { ...state }
      emit('focus-layer-change', state)
    }

    const onKeydown = (e: KeyboardEvent) => {
      if (!props.loop && !props.trapped) return
      if (focusLayer.paused) return

      const { key, altKey, ctrlKey, metaKey, currentTarget, shiftKey } = e
      const { loop } = props
      const isTabbing =
        key === EVENT_CODE.tab && !altKey && !ctrlKey && !metaKey

      const currentFocusingEl = document.activeElement
      if (isTabbing && currentFocusingEl) {
        const container = currentTarget as HTMLElement
        const [first, last] = getEdges(container)
        const isTabbable = first && last
        if (!isTabbable) {
          if (currentFocusingEl === container) {
            const focusoutPreventedEvent = createFocusOutPreventedEvent({
              focusReason: focusReason.value,
            })
            emit('focusout-prevented', focusoutPreventedEvent)
            if (!focusoutPreventedEvent.defaultPrevented) {
              e.preventDefault()
            }
          }
        } else {
          if (!shiftKey && currentFocusingEl === last) {
            const focusoutPreventedEvent = createFocusOutPreventedEvent({
              focusReason: focusReason.value,
            })
            emit('focusout-prevented', focusoutPreventedEvent)
            if (!focusoutPreventedEvent.defaultPrevented) {
              e.preventDefault()
              if (loop) tryFocus(first, true)
            }
          } else if (
            shiftKey &&
            [first, container].includes(currentFocusingEl as HTMLElement)
          ) {
            const focusoutPreventedEvent = createFocusOutPreventedEvent({
              focusReason: focusReason.value,
            })
            emit('focusout-prevented', focusoutPreventedEvent)
            if (!focusoutPreventedEvent.defaultPrevented) {
              e.preventDefault()
              if (loop) tryFocus(last, true)
            }
          }
        }
      }
    }

    provide(FOCUS_TRAP_INJECTION_KEY, {
      focusTrapRef: forwardRef,
      onKeydown,
    })

    watch(
      () => props.focusTrapEl,
      (focusTrapEl) => {
        if (focusTrapEl) {
          forwardRef.value = focusTrapEl
        }
      },
      { immediate: true },
    )

    watch([forwardRef], ([forwardRef], [oldForwardRef]) => {
      if (forwardRef) {
        forwardRef.addEventListener('keydown', onKeydown)
        forwardRef.addEventListener('focusin', onFocusIn)
        forwardRef.addEventListener('focusout', onFocusOut)
        focusableObserver = new MutationObserver(() =>
          invalidateFocusableCache(forwardRef),
        )
        focusableObserver.observe(forwardRef, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ['disabled', 'hidden', 'tabindex', 'style', 'class'],
        })
      }
      if (oldForwardRef) {
        oldForwardRef.removeEventListener('keydown', onKeydown)
        oldForwardRef.removeEventListener('focusin', onFocusIn)
        oldForwardRef.removeEventListener('focusout', onFocusOut)
        invalidateFocusableCache(oldForwardRef)
        focusableObserver?.disconnect()
        focusableObserver = undefined
      }
    })

    const trapOnFocus = (e: Event) => {
      emit(ON_TRAP_FOCUS_EVT, e)
    }
    const releaseOnFocus = (e: Event) => emit(ON_RELEASE_FOCUS_EVT, e)

    const onFocusIn = (e: FocusEvent) => {
      const trapContainer = unref(forwardRef)
      if (!trapContainer) return

      const target = e.target as HTMLElement | null
      const relatedTarget = e.relatedTarget as HTMLElement | null
      const isFocusedInTrap = target && trapContainer.contains(target)

      if (!props.trapped) {
        const isPrevFocusedInTrap =
          relatedTarget && trapContainer.contains(relatedTarget)
        if (!isPrevFocusedInTrap) {
          lastFocusBeforeTrapped = relatedTarget
        }
      }

      if (isFocusedInTrap) emit('focusin', e)

      if (focusLayer.paused) return

      if (props.trapped) {
        if (isFocusedInTrap) {
          lastFocusAfterTrapped = target
        } else {
          tryFocus(lastFocusAfterTrapped, true)
        }
      }
    }

    const onFocusOut = (e: Event) => {
      const trapContainer = unref(forwardRef)
      if (focusLayer.paused || !trapContainer) return

      if (props.trapped) {
        const relatedTarget = (e as FocusEvent)
          .relatedTarget as HTMLElement | null
        if (!isNil(relatedTarget) && !trapContainer.contains(relatedTarget)) {
          // Give embedded focus layer time to pause this layer before reclaiming focus
          // And only reclaim focus if it should currently be trapping
          const generation = trapGeneration
          setTimeout(() => {
            if (
              generation === trapGeneration &&
              !focusLayer.paused &&
              props.trapped
            ) {
              const focusoutPreventedEvent = createFocusOutPreventedEvent({
                focusReason: focusReason.value,
              })
              emit('focusout-prevented', focusoutPreventedEvent)
              if (!focusoutPreventedEvent.defaultPrevented) {
                tryFocus(lastFocusAfterTrapped, true)
              }
            }
          }, 0)
        }
      } else {
        const target = e.target as HTMLElement | null
        const isFocusedInTrap = target && trapContainer.contains(target)
        if (!isFocusedInTrap) emit('focusout', e)
      }
    }

    async function startTrap() {
      const generation = ++trapGeneration
      const pointerTarget = restoreTarget?.value ?? getPointerFocusTarget()
      const activeElement = document.activeElement
      // Wait for forwardRef to resolve
      await nextTick()
      if (generation !== trapGeneration || !props.trapped) return
      const trapContainer = unref(forwardRef)
      if (trapContainer) {
        trapActive = true
        focusableStack.push(focusLayer)
        focusLayer.resume()
        const prevFocusedElement =
          pointerTarget?.isConnected && !trapContainer.contains(pointerTarget)
            ? pointerTarget
            : trapContainer.contains(activeElement)
              ? lastFocusBeforeTrapped
              : activeElement
        lastFocusBeforeTrapped = prevFocusedElement as HTMLElement | null
        const isPrevFocusContained = trapContainer.contains(prevFocusedElement)
        if (!isPrevFocusContained) {
          const focusEvent = new Event(
            FOCUS_AFTER_TRAPPED,
            FOCUS_AFTER_TRAPPED_OPTS,
          )
          trapContainer.addEventListener(FOCUS_AFTER_TRAPPED, trapOnFocus)
          trapContainer.dispatchEvent(focusEvent)
          if (!focusEvent.defaultPrevented) {
            nextTick(() => {
              if (
                generation !== trapGeneration ||
                !props.trapped ||
                focusLayer.paused ||
                trapContainer !== unref(forwardRef)
              )
                return
              let focusStartEl = props.focusStartEl
              if (!isString(focusStartEl)) {
                tryFocus(focusStartEl)
                if (document.activeElement !== focusStartEl) {
                  focusStartEl = 'first'
                }
              }
              if (focusStartEl === 'first') {
                focusFirstDescendant(
                  obtainAllFocusableElements(trapContainer),
                  true,
                )
              }
              if (
                document.activeElement === prevFocusedElement ||
                focusStartEl === 'container'
              ) {
                tryFocus(trapContainer)
              }
            })
          }
        }
      }
    }

    function stopTrap() {
      ++trapGeneration
      if (!trapActive) return
      trapActive = false
      const wasPaused = focusLayer.paused
      notifyLayerState()
      focusableStack.remove(focusLayer)
      const trapContainer = unref(forwardRef)

      if (trapContainer) {
        trapContainer.removeEventListener(FOCUS_AFTER_TRAPPED, trapOnFocus)

        const releasedEvent = new CustomEvent(FOCUS_AFTER_RELEASED, {
          ...FOCUS_AFTER_TRAPPED_OPTS,
          detail: {
            focusReason: focusReason.value,
          },
        })
        trapContainer.addEventListener(FOCUS_AFTER_RELEASED, releaseOnFocus)
        trapContainer.dispatchEvent(releasedEvent)
        if (
          !releasedEvent.defaultPrevented &&
          !wasPaused &&
          (focusReason.value == 'keyboard' ||
            !isFocusCausedByUserEvent() ||
            document.activeElement === document.body ||
            trapContainer.contains(document.activeElement))
        ) {
          tryFocus(
            lastFocusBeforeTrapped?.isConnected
              ? lastFocusBeforeTrapped
              : document.body,
          )
        }

        trapContainer.removeEventListener(FOCUS_AFTER_RELEASED, releaseOnFocus)
      }
    }

    onMounted(() => {
      notifyLayerState()
      if (props.trapped) {
        startTrap()
      }

      watch(
        () => props.trapped,
        (trapped) => {
          if (trapped) {
            startTrap()
          } else {
            stopTrap()
          }
        },
      )
    })

    onBeforeUnmount(() => {
      focusableObserver?.disconnect()
      focusableObserver = undefined
      stopTrap()
    })

    return {
      onKeydown,
    }
  },
})
</script>
