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

// The canonical focus layer activates or suspends isolation synchronously.
// Retain only that owner's writes, without maintaining another modal order.
// Restore attributes exactly, including inert owned by the application.
let inertOwner: { root: Ref<HTMLElement | undefined> } | undefined
const inertAttributes = new Map<HTMLElement, string | null>()
let inertObserver: MutationObserver | undefined

const refreshInert = () => {
  const targets = new Set<HTMLElement>()
  let branch = inertOwner?.root.value
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
    if (inertOwner !== layer) return
    inertOwner = undefined
    inertObserver?.disconnect()
    inertObserver = undefined
    if (isClient) refreshInert()
  }
  watch(
    [active, root],
    ([enabled, element]) => {
      if (!isClient) return
      if (!enabled || !element) return release()
      inertOwner = layer
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
