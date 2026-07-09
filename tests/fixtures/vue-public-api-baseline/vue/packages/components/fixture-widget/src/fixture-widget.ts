import { UPDATE_MODEL_EVENT } from '@element-plus/constants'
import { buildProps } from '@element-plus/utils'

export const fixtureWidgetProps = buildProps({
  label: String,
  modelValue: String,
  /**
   * @deprecated use modelValue instead
   */
  legacyMode: Boolean,
} as const)

export const fixtureWidgetEmits = {
  [UPDATE_MODEL_EVENT]: (value: string) => typeof value === 'string',
  submit: (value: string) => typeof value === 'string',
}
