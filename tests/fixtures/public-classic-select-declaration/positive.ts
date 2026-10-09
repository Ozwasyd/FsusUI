import Select, { ElSelect, ElOption, ElOptionGroup } from '@ozwasyd/element-plus/es/components/select'
import CjsSelect, { ElSelect as CjsNamedSelect } from '@ozwasyd/element-plus/lib/components/select'
import { useSelect, type SelectTooltipRef } from '@ozwasyd/element-plus/es/components/select/src/useSelect'
import type { App } from 'vue'

declare const app: App
Select.install(app)
ElOption.install(app)
ElOptionGroup.install(app)
const defaultIsNamed: typeof ElSelect = Select
const cjsDefaultIsNamed: typeof CjsNamedSelect = CjsSelect
const esmIsCjs: typeof CjsNamedSelect = ElSelect
const optionExtra: typeof ElSelect.Option = ElOption
const groupExtra: typeof ElSelect.OptionGroup = ElOptionGroup

const props: InstanceType<typeof Select>['$props'] = {
  modelValue: ['one', 2, false, { value: 3 }], multiple: true,
  size: 'small', disabled: false, clearable: true, filterable: true,
  collapseTags: true, maxCollapseTags: 2, placeholder: 'Choose',
}
const optionProps: InstanceType<typeof ElOption>['$props'] = { value: { id: 1 }, label: 'One', disabled: false }
const groupProps: InstanceType<typeof ElOptionGroup>['$props'] = { label: 'Group', disabled: false }
declare const instance: InstanceType<typeof Select>
instance.focus()
instance.blur()
instance.$emit('visible-change', true)
instance.$emit('update:modelValue', ['one'])
instance.$emit('focus', new FocusEvent('focus'))
instance.$slots.default?.()
instance.$slots.prefix?.()
instance.$slots.empty?.()
declare const result: ReturnType<typeof useSelect>
const tooltip: SelectTooltipRef = result.tooltipRef
tooltip.value?.updatePopper()
tooltip.value?.isFocusInsideContent(new FocusEvent('blur'))
tooltip.value = result.tagTooltipRef.value
result.toggleMenu(new PointerEvent('click'))
result.handleBlur(new FocusEvent('blur'))

void [defaultIsNamed, cjsDefaultIsNamed, esmIsCjs, optionExtra, groupExtra, props, optionProps, groupProps]
