import { ElSelect, ElOption, ElOptionGroup } from '@ozwasyd/element-plus/es/components/select'
import type { SelectTooltipRef } from '@ozwasyd/element-plus/es/components/select/src/useSelect'

const invalidSize: InstanceType<typeof ElSelect>['$props'] = { size: 'giant' }
const invalidDisabled: InstanceType<typeof ElSelect>['$props'] = { disabled: 'yes' }
const invalidOption: InstanceType<typeof ElOption>['$props'] = { value: Symbol('bad') }
const invalidGroup: InstanceType<typeof ElOptionGroup>['$props'] = { label: 42 }
declare const instance: InstanceType<typeof ElSelect>
instance.focus('bad')
instance.blur('bad')
declare const tooltip: SelectTooltipRef
tooltip.value = 42
tooltip.value?.isFocusInsideContent('bad')

void [invalidSize, invalidDisabled, invalidOption, invalidGroup]
