import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

let scrollTriggerRegistered = false

export const getGsap = (): typeof gsap => gsap

const ensureMatchMedia = () => {
  if (
    typeof window === 'undefined' ||
    typeof window.matchMedia === 'function'
  ) {
    return
  }

  window.matchMedia = (query: string): MediaQueryList =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    }) as MediaQueryList
}

export const registerScrollTrigger = () => {
  if (scrollTriggerRegistered) return ScrollTrigger

  ensureMatchMedia()
  gsap.registerPlugin(ScrollTrigger)
  scrollTriggerRegistered = true
  return ScrollTrigger
}

export const isScrollTriggerRegistered = () => scrollTriggerRegistered

export const refreshScrollTriggers = () => {
  if (!scrollTriggerRegistered) return
  ScrollTrigger.refresh()
}

export const killScrollTriggersFor = (target: Element) => {
  if (!scrollTriggerRegistered) return

  for (const trigger of ScrollTrigger.getAll()) {
    if (trigger.trigger === target) {
      trigger.kill()
    }
  }
}
