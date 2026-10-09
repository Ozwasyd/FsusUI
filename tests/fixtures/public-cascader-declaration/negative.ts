import { ElCascader } from '@ozwasyd/element-plus/es/components/cascader'
import type { CascaderInstance } from '@ozwasyd/element-plus/es/components/cascader'
declare const instance: CascaderInstance
const disabled: InstanceType<typeof ElCascader>['$props'] = { disabled: 'yes' } // invalid
const size: InstanceType<typeof ElCascader>['$props'] = { size: 'giant' } // invalid
const config: InstanceType<typeof ElCascader>['$props'] = {
  props: { expandTrigger: 'keyboard' },
} // invalid
const filter: InstanceType<typeof ElCascader>['$props'] = {
  filterMethod: () => 'yes',
} // invalid
instance.$emit('visibleChange', 'yes') // invalid
instance.$emit('focus', new Event('focus')) // invalid
instance.$emit('change', { unexpected: true }) // invalid
instance.$emit('expandChange', false) // invalid
instance.$emit('removeTag', false) // invalid
instance.$emit('unknownEvent', true) // invalid
instance.getCheckedNodes('yes') // invalid
instance.getCheckedNodes() // invalid
instance.togglePopperVisible('yes') // invalid
const nodes: string[] = instance.getCheckedNodes(true) // invalid
const element: number = instance.contentRef // invalid
const slot: string = instance.$slots.default?.({}) // invalid
ElCascader.install?.('invalid') // invalid
instance.$emit('change', null) // invalid
instance.$emit('update:modelValue', false) // invalid
instance.$emit('blur', new Event('blur')) // invalid
