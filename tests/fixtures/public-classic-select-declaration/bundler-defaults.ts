import CjsDefault, { ElSelect, ElOption, ElOptionGroup } from '@ozwasyd/element-plus/lib/components/select'

export const evidence = {
  cjsDefaultIsNamed: CjsDefault === ElSelect,
  optionExtra: CjsDefault.Option === ElOption,
  groupExtra: CjsDefault.OptionGroup === ElOptionGroup,
  installer: typeof CjsDefault.install === 'function',
}
