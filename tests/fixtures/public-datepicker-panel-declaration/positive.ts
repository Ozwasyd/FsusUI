import { getPanel } from '@ozwasyd/element-plus/es/components/date-picker/src/panel-utils'
import type DatePickPanel from '@ozwasyd/element-plus/es/components/date-picker/src/date-picker-com/panel-date-pick.vue'
import type DateRangePickPanel from '@ozwasyd/element-plus/es/components/date-picker/src/date-picker-com/panel-date-range.vue'
import type MonthRangePickPanel from '@ozwasyd/element-plus/es/components/date-picker/src/date-picker-com/panel-month-range.vue'
import type { IDatePickerType } from '@ozwasyd/element-plus/es/components/date-picker/src/date-picker.type'

type Same<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? true
    : false
type Assert<T extends true> = T
type ParameterContract = Assert<
  Same<Parameters<typeof getPanel>, [type: IDatePickerType]>
>
type ReturnContract = Assert<
  Same<
    ReturnType<typeof getPanel>,
    | typeof DatePickPanel
    | typeof DateRangePickPanel
    | typeof MonthRangePickPanel
  >
>

const modes: IDatePickerType[] = [
  'year',
  'month',
  'date',
  'dates',
  'week',
  'datetime',
  'datetimerange',
  'daterange',
  'monthrange',
]
const panels: ReturnType<typeof getPanel>[] = modes.map(getPanel)
export { panels }
export type { ParameterContract, ReturnContract }
