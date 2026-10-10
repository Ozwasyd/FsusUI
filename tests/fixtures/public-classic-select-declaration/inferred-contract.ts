import type { useSelect as RepairedUseSelect, SelectTooltipRef } from './packages/components/select/src/useSelect'
import type { useSelect as OriginalUseSelect } from './packages/components/select/src/useSelect.original'
import type RepairedSelect from './packages/components/select/src/select.vue'
import type OriginalSelect from './packages/components/select/src/select.original'
import type { ElSelect as RepairedInstalled, ElOption as RepairedOption, ElOptionGroup as RepairedGroup } from './packages/components/select'
import type RepairedDefault from './packages/components/select'
import type { ElSelect as OriginalInstalled, ElOption as OriginalOption, ElOptionGroup as OriginalGroup } from './packages/components/select/index.original'
import type OriginalDefault from './packages/components/select/index.original'

type Assert<T extends true> = T
type Equal<T, U> = (<V>() => V extends T ? 1 : 2) extends (<V>() => V extends U ? 1 : 2) ? true : false
type Both<T, U> = [T] extends [U] ? [U] extends [T] ? true : false : false
export type ParametersUnchanged = Assert<Equal<Parameters<typeof RepairedUseSelect>, Parameters<typeof OriginalUseSelect>>>
export type ReturnKeysUnchanged = Assert<Equal<keyof ReturnType<typeof RepairedUseSelect>, keyof ReturnType<typeof OriginalUseSelect>>>
export type ReturnUnchanged = Assert<Both<ReturnType<typeof RepairedUseSelect>, ReturnType<typeof OriginalUseSelect>>>
export type RefUnchanged = Assert<Both<SelectTooltipRef, ReturnType<typeof OriginalUseSelect>['tooltipRef']>>
export type RefValueUnchanged = Assert<Equal<SelectTooltipRef['value'], ReturnType<typeof OriginalUseSelect>['tooltipRef']['value']>>
export type RawComponentUnchanged = Assert<Both<typeof RepairedSelect, typeof OriginalSelect>>
export type InstanceUnchanged = Assert<Both<InstanceType<typeof RepairedSelect>, InstanceType<typeof OriginalSelect>>>
export type InstanceKeysUnchanged = Assert<Equal<keyof InstanceType<typeof RepairedSelect>, keyof InstanceType<typeof OriginalSelect>>>
export type PropsUnchanged = Assert<Equal<InstanceType<typeof RepairedSelect>['$props'], InstanceType<typeof OriginalSelect>['$props']>>
export type EmitsUnchanged = Assert<Equal<InstanceType<typeof RepairedSelect>['$emit'], InstanceType<typeof OriginalSelect>['$emit']>>
export type SlotsUnchanged = Assert<Equal<InstanceType<typeof RepairedSelect>['$slots'], InstanceType<typeof OriginalSelect>['$slots']>>
export type InstalledUnchanged = Assert<Both<typeof RepairedInstalled, typeof OriginalInstalled>>
export type DefaultUnchanged = Assert<Both<typeof RepairedDefault, typeof OriginalDefault>>
export type OptionUnchanged = Assert<Equal<typeof RepairedOption, typeof OriginalOption>>
export type GroupUnchanged = Assert<Equal<typeof RepairedGroup, typeof OriginalGroup>>
export type OptionExtraUnchanged = Assert<Equal<typeof RepairedInstalled.Option, typeof OriginalInstalled.Option>>
export type GroupExtraUnchanged = Assert<Equal<typeof RepairedInstalled.OptionGroup, typeof OriginalInstalled.OptionGroup>>
