import type { ComputedRef, InjectionKey } from 'vue'
import type {
  FsusFieldValidationResult,
  FsusSize,
  FsusValidationRule,
  FsusValidationTrigger,
} from '@fsusui/core'

export interface FsusFormItemInstance {
  prop?: string
  validate: (trigger?: FsusValidationTrigger) => Promise<FsusFieldValidationResult>
  clearValidate: () => void
  resetField: () => void
}

export interface FsusFormContext {
  model?: Record<string, any>
  rules?: Record<string, FsusValidationRule | FsusValidationRule[]>
  size: FsusSize
  disabled: boolean
  labelPosition: 'top' | 'left' | 'right'
  labelWidth?: string | number
  registerField: (field: FsusFormItemInstance) => void
  unregisterField: (field: FsusFormItemInstance) => void
}

export interface FsusFormItemContext {
  id: string
  invalid: boolean
  disabled: boolean
  size: FsusSize
  notifyTrigger: (trigger: FsusValidationTrigger) => void
}

export const FSUS_FORM_KEY: InjectionKey<ComputedRef<FsusFormContext>> = Symbol('fsus-form')
export const FSUS_FORM_ITEM_KEY: InjectionKey<ComputedRef<FsusFormItemContext>> =
  Symbol('fsus-form-item')
