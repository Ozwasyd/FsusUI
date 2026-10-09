import { useSelect as RepairedUseSelect, type SelectTooltipRef } from './vue/packages/components/select/src/useSelect'
import { useSelect as OriginalUseSelect } from './vue/packages/components/select/src/useSelect.original'
import RepairedSelect from './vue/packages/components/select/src/select.vue'
import OriginalSelect from './vue/packages/components/select/src/select.original'
import RepairedDefault, { ElSelect as RepairedInstalled, ElOption as RepairedOption, ElOptionGroup as RepairedGroup } from './vue/packages/components/select'
import OriginalDefault, { ElSelect as OriginalInstalled, ElOption as OriginalOption, ElOptionGroup as OriginalGroup } from './vue/packages/components/select/index.original'

type Assert<T extends true> = T
type Equal<T, U> = (<V>() => V extends T ? 1 : 2) extends (<V>() => V extends U ? 1 : 2) ? true : false
type Both<T, U> = [T] extends [U] ? [U] extends [T] ? true : false : false
type ParametersUnchanged = Assert<Equal<Parameters<typeof RepairedUseSelect>, Parameters<typeof OriginalUseSelect>>>
type ReturnKeysUnchanged = Assert<Equal<keyof ReturnType<typeof RepairedUseSelect>, keyof ReturnType<typeof OriginalUseSelect>>>
type ReturnUnchanged = Assert<Both<ReturnType<typeof RepairedUseSelect>, ReturnType<typeof OriginalUseSelect>>>
type RefUnchanged = Assert<Both<SelectTooltipRef, ReturnType<typeof OriginalUseSelect>['tooltipRef']>>
type RefValueUnchanged = Assert<Equal<SelectTooltipRef['value'], ReturnType<typeof OriginalUseSelect>['tooltipRef']['value']>>
type RawComponentUnchanged = Assert<Both<typeof RepairedSelect, typeof OriginalSelect>>
type InstanceUnchanged = Assert<Both<InstanceType<typeof RepairedSelect>, InstanceType<typeof OriginalSelect>>>
type InstanceKeysUnchanged = Assert<Equal<keyof InstanceType<typeof RepairedSelect>, keyof InstanceType<typeof OriginalSelect>>>
type PropsUnchanged = Assert<Equal<InstanceType<typeof RepairedSelect>['$props'], InstanceType<typeof OriginalSelect>['$props']>>
type EmitsUnchanged = Assert<Equal<InstanceType<typeof RepairedSelect>['$emit'], InstanceType<typeof OriginalSelect>['$emit']>>
type SlotsUnchanged = Assert<Equal<InstanceType<typeof RepairedSelect>['$slots'], InstanceType<typeof OriginalSelect>['$slots']>>
type InstalledUnchanged = Assert<Both<typeof RepairedInstalled, typeof OriginalInstalled>>
type DefaultUnchanged = Assert<Both<typeof RepairedDefault, typeof OriginalDefault>>
type OptionUnchanged = Assert<Equal<typeof RepairedOption, typeof OriginalOption>>
type GroupUnchanged = Assert<Equal<typeof RepairedGroup, typeof OriginalGroup>>
type OptionExtraUnchanged = Assert<Equal<typeof RepairedInstalled.Option, typeof OriginalInstalled.Option>>
type GroupExtraUnchanged = Assert<Equal<typeof RepairedInstalled.OptionGroup, typeof OriginalInstalled.OptionGroup>>
