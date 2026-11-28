import type { ComputedRef, InjectionKey } from 'vue'
import type { FsusSize, FsusVariant } from '@fsusui/core'

export interface FsusButtonGroupContext {
  size?: FsusSize
  variant?: FsusVariant
  disabled?: boolean
}

export const FSUS_BUTTON_GROUP_KEY: InjectionKey<ComputedRef<FsusButtonGroupContext>> =
  Symbol('fsus-button-group')
