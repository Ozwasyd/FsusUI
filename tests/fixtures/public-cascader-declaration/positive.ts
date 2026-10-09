import Cascader, {
  ElCascader,
} from '@ozwasyd/element-plus/es/components/cascader'
import type { CascaderInstance } from '@ozwasyd/element-plus/es/components/cascader'
import type {
  CascaderNode,
  CascaderPanelInstance,
  CascaderValue,
} from '@ozwasyd/element-plus/es/components/cascader-panel'
import type { App, Plugin, Slots, VNode } from 'vue'

type Same<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? true
    : false
type Assert<T extends true> = T
type IsUntyped<T> = 0 extends 1 & T ? true : false
type InstanceIsTyped = Assert<Same<IsUntyped<CascaderInstance>, false>>
type DefaultAndNamed = Assert<Same<typeof Cascader, typeof ElCascader>>
type ParametersPreserved = Assert<
  Same<Parameters<CascaderInstance['getCheckedNodes']>, [leafOnly: boolean]>
>
type ReturnPreserved = Assert<
  Same<
    ReturnType<CascaderInstance['getCheckedNodes']>,
    CascaderNode[] | undefined
  >
>
type ToggleParameters = Assert<
  Same<Parameters<CascaderInstance['togglePopperVisible']>, [visible?: boolean]>
>
type ToggleReturn = Assert<
  Same<ReturnType<CascaderInstance['togglePopperVisible']>, void>
>
type ContentRef = Assert<
  Same<CascaderInstance['contentRef'], HTMLElement | undefined>
>

const props: InstanceType<typeof ElCascader>['$props'] = {
  modelValue: ['parent', 'child'],
  options: [
    { value: 'parent', label: 'Parent', children: [{ value: 'child' }] },
  ],
  props: { multiple: true, expandTrigger: 'hover', emitPath: true },
  size: 'small',
  disabled: false,
  clearable: true,
  filterable: true,
  filterMethod: (node, keyword) => node.text.includes(keyword),
  beforeFilter: (keyword: string) => Promise.resolve(keyword.length > 0),
  maxCollapseTags: 2,
  tagType: 'info',
  onChange: (value: CascaderValue) => void value,
  onVisibleChange: (visible: boolean) => void visible,
  onFocus: (event: FocusEvent) => void event,
}
declare const instance: CascaderInstance
declare const node: CascaderNode
declare const app: App
instance.$emit('update:modelValue', ['parent', 'child'])
instance.$emit('change', 'child')
instance.$emit('expandChange', [1, 2])
instance.$emit('removeTag', node.valueByOption)
instance.$emit('visibleChange', false)
instance.$emit('focus', new FocusEvent('focus'))
instance.$emit('blur', new FocusEvent('blur'))
const panel: CascaderPanelInstance | null = instance.cascaderPanelRef
const nodes: CascaderNode[] | undefined = instance.getCheckedNodes(false)
instance.togglePopperVisible()
instance.togglePopperVisible(true)
const slots: Slots = instance.$slots
const content: VNode[] | undefined = slots.default?.({ node, data: node.data })
const empty: VNode[] | undefined = slots.empty?.()
const prefix: VNode[] | undefined = slots.prefix?.()
const plugin: Plugin = ElCascader
app.use(plugin)
if (ElCascader.install) ElCascader.install(app)
void [props, panel, nodes, content, empty, prefix]
