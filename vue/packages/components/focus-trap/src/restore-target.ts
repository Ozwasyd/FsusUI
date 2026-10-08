import type { InjectionKey, Ref } from 'vue'

// Private handoff from an opening session to its immediate focus trap.
export const focusRestoreTargetKey: InjectionKey<Ref<HTMLElement | null> | null> =
  Symbol('focusRestoreTarget')
