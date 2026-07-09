import {
  Check,
  CircleCheck,
  CircleClose,
  Close,
  InfoFilled,
  Loading,
  Warning,
} from '@element-plus/icons-vue'
import { definePropType } from './props'

import type { Component } from 'vue'

export const iconPropType = definePropType<string | Component>([
  String,
  Object,
  Function,
])

export const CloseComponents = {
  Close,
}

export const TypeComponents = {
  Close,
  Check,
  InfoFilled,
  Warning,
}

export const TypeComponentsMap = {
  success: Check,
  warning: Warning,
  error: Close,
  info: InfoFilled,
}

export const ValidateComponentsMap = {
  validating: Loading,
  success: CircleCheck,
  error: CircleClose,
}
