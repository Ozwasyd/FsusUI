import { CHANGE_EVENT, UPDATE_MODEL_EVENT } from '@element-plus/constants'
import { useSizeProp } from '@element-plus/hooks'
import { buildProps, definePropType } from '@element-plus/utils'
import { themeModes } from '@element-plus/components/config-provider'

import type { ExtractPropTypes } from 'vue'
import type { ThemeMode } from '@element-plus/components/config-provider'
import type ThemeModeToggle from './theme-mode-toggle.vue'

export const themeModeToggleVisibility = ['always', 'desktop', 'mobile'] as const
export const themeModeToggleVariants = ['segmented', 'menu-button'] as const

export interface ThemeModeToggleLabels {
  light?: string
  dark?: string
  system?: string
  lightShort?: string
  darkShort?: string
  systemShort?: string
}

export const themeModeToggleProps = buildProps({
  /**
   * @description selected theme mode
   */
  modelValue: {
    type: String,
    values: themeModes,
  },
  /**
   * @description default selected theme mode when uncontrolled
   */
  defaultValue: {
    type: String,
    values: themeModes,
    default: 'system',
  },
  /**
   * @description compact labels for constrained toolbars
   */
  compact: {
    type: Boolean,
    default: false,
  },
  /**
   * @description visual presentation
   */
  variant: {
    type: String,
    values: themeModeToggleVariants,
    default: 'segmented',
  },
  /**
   * @description consumer-provided mode labels
   */
  labels: {
    type: definePropType<ThemeModeToggleLabels>(Object),
    default: () => ({}),
  },
  /**
   * @description CSS-only responsive visibility
   */
  visibility: {
    type: String,
    values: themeModeToggleVisibility,
    default: 'always',
  },
  /**
   * @description radio button size
   */
  size: useSizeProp,
  /**
   * @description accessible label
   */
  label: {
    type: String,
    default: 'Theme mode',
  },
} as const)

export const themeModeToggleEmits = {
  [UPDATE_MODEL_EVENT]: (value: ThemeMode) => themeModes.includes(value),
  [CHANGE_EVENT]: (value: ThemeMode) => themeModes.includes(value),
}

export type ThemeModeToggleProps = ExtractPropTypes<
  typeof themeModeToggleProps
>
export type ThemeModeToggleEmits = typeof themeModeToggleEmits
export type ThemeModeToggleVisibility =
  (typeof themeModeToggleVisibility)[number]
export type ThemeModeToggleVariant = (typeof themeModeToggleVariants)[number]
export type ThemeModeToggleInstance = InstanceType<typeof ThemeModeToggle>
