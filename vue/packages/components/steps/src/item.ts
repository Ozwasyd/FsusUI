import {
  buildProps,
  iconPropType,
  isNumber,
  isString,
} from '@element-plus/utils'
import type Step from './item.vue'
import type { ExtractPropTypes } from 'vue'

export const stepProps = buildProps({
  /**
   * @description step title
   */
  title: {
    type: String,
    default: '',
  },
  /**
   * @description step custom icon. Icons can be passed via named slot as well
   */
  icon: {
    type: iconPropType,
  },
  /**
   * @description step description
   */
  description: {
    type: String,
    default: '',
  },
  /**
   * @description whether the full step is an interactive target
   */
  clickable: Boolean,
  /**
   * @description current status. It will be automatically set by Steps if not configured.
   */
  status: {
    type: String,
    values: ['', 'wait', 'process', 'finish', 'error', 'success'],
    default: '',
  },
} as const)

export type StepProps = ExtractPropTypes<typeof stepProps>

export const stepEmits = {
  click: (index: number, status: string) => isNumber(index) && isString(status),
}
export type StepEmits = typeof stepEmits

export type StepInstance = InstanceType<typeof Step>
