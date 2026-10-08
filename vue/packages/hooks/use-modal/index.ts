import { onScopeDispose, watch } from 'vue'
import { isClient, useEventListener } from '../use-runtime'
import { EVENT_CODE } from '@element-plus/constants'

import type { Ref } from 'vue'

type ModalInstance = {
  handleClose: () => void
}

const modalStack: ModalInstance[] = []

const closeModal = (e: KeyboardEvent) => {
  if (modalStack.length === 0) return
  if (e.code === EVENT_CODE.esc) {
    e.stopPropagation()
    const topModal = modalStack[modalStack.length - 1]
    topModal.handleClose()
  }
}

export const useModal = (instance: ModalInstance, visibleRef: Ref<boolean>) => {
  watch(visibleRef, (val) => {
    if (val) {
      modalStack.push(instance)
    } else {
      modalStack.splice(modalStack.indexOf(instance), 1)
    }
  })
}

if (isClient) useEventListener(document, 'keydown', closeModal)

// Inert ownership is shared between modal instances, including nested viewers.
// Only the top modal's ancestor path remains interactive. Restore attributes
// exactly, including an inert attribute owned by the application.
const inertLayers: { root: Ref<HTMLElement | undefined> }[] = []
const inertAttributes = new Map<HTMLElement, string | null>()
let inertObserver: MutationObserver | undefined

const refreshInert = () => {
  const targets = new Set<HTMLElement>()
  let branch = inertLayers.at(-1)?.root.value
  while (branch?.parentElement) {
    const parent = branch.parentElement
    for (const sibling of parent.children) {
      if (sibling !== branch && sibling instanceof HTMLElement) {
        targets.add(sibling)
      }
    }
    if (parent === document.body) break
    branch = parent
  }
  for (const [element, original] of inertAttributes) {
    if (targets.has(element)) continue
    if (original === null) element.removeAttribute('inert')
    else element.setAttribute('inert', original)
    inertAttributes.delete(element)
  }
  for (const element of targets) {
    if (!inertAttributes.has(element)) {
      inertAttributes.set(element, element.getAttribute('inert'))
    }
    element.setAttribute('inert', '')
  }
}

export const useModalInert = (
  root: Ref<HTMLElement | undefined>,
  active: Ref<boolean>,
) => {
  const layer = { root }
  const release = () => {
    const index = inertLayers.indexOf(layer)
    if (index !== -1) inertLayers.splice(index, 1)
    if (!inertLayers.length) {
      inertObserver?.disconnect()
      inertObserver = undefined
    }
    if (isClient) refreshInert()
  }
  watch(
    [active, root],
    ([enabled, element]) => {
      if (!isClient) return
      if (!enabled || !element) return release()
      if (!inertLayers.includes(layer)) inertLayers.push(layer)
      refreshInert()
      if (!inertObserver) {
        inertObserver = new MutationObserver(refreshInert)
        inertObserver.observe(document.body, { childList: true, subtree: true })
      }
    },
    { flush: 'sync' },
  )
  onScopeDispose(release)
}
