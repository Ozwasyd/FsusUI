import { withInstall, withNoopInstall } from '@element-plus/utils'

import Select from './src/select.vue'
import Option from './src/option.vue'
import OptionGroup from './src/option-group.vue'
import type { SFCWithInstall } from '@element-plus/utils'

export const ElSelect: SFCWithInstall<typeof Select> & {
  Option: typeof Option
  OptionGroup: typeof OptionGroup
} = withInstall(Select, {
  Option,
  OptionGroup,
})
export default ElSelect
export const ElOption = withNoopInstall(Option)
export const ElOptionGroup = withNoopInstall(OptionGroup)

export * from './src/token'
