import type {
  ElColorPicker,
  ElConversationListItem,
  FsusConversationListItem,
  ElTreeV2,
} from '@ozwasyd/element-plus'
import type { TreeNode } from '@ozwasyd/element-plus/es/components/tree-v2/src/types'

declare const picker: InstanceType<typeof ElColorPicker>
declare const conversation: InstanceType<typeof ElConversationListItem>
declare const alias: InstanceType<typeof FsusConversationListItem>
declare const tree: InstanceType<typeof ElTreeV2>
declare const focus: FocusEvent
declare const mouse: MouseEvent
declare const event: Event
declare const node: TreeNode
const data = { id: 'alpha', event: 'consumer-owned field' }

type IsUntyped<T> = 0 extends 1 & T ? true : false
const pickerEmitIsTyped: IsUntyped<typeof picker.$emit> = false
const conversationEmitIsTyped: IsUntyped<typeof conversation.$emit> = false
const aliasEmitIsTyped: IsUntyped<typeof alias.$emit> = false
const treeEmitIsTyped: IsUntyped<typeof tree.$emit> = false
void [
  pickerEmitIsTyped,
  conversationEmitIsTyped,
  aliasEmitIsTyped,
  treeEmitIsTyped,
]

picker.$emit('focus', focus)
picker.$emit('blur', focus)
conversation.$emit('select', mouse)
alias.$emit('select', mouse)
tree.$emit('node-contextmenu', event, data, node)

// @ts-expect-error FocusEvent retains its relatedTarget contract
picker.$emit('focus', event)
// @ts-expect-error Focus payload is required
picker.$emit('focus')
// @ts-expect-error Blur payload retains the same FocusEvent contract
picker.$emit('blur', 'blur')
// @ts-expect-error Select retains MouseEvent's coordinate/button contract
conversation.$emit('select', focus)
// @ts-expect-error Alias retains the base component's payload contract
alias.$emit('select', event)
// @ts-expect-error Wire name remains select
conversation.$emit('payload', mouse)
// @ts-expect-error Event remains the first contextmenu argument
tree.$emit('node-contextmenu', data, event, node)
// @ts-expect-error TreeNode remains the final contextmenu argument
tree.$emit('node-contextmenu', event, data, data)
// @ts-expect-error Contextmenu requires all three arguments
tree.$emit('node-contextmenu', event, data)
