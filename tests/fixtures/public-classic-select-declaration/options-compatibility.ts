import type { Options } from '@popperjs/core'
import OriginalSelect from './packages/components/select/src/select.raworiginal'
import RepairedSelect from './packages/components/select/src/select.vue'

type OriginalProps = InstanceType<typeof OriginalSelect>['$props']
type RepairedProps = InstanceType<typeof RepairedSelect>['$props']
type Assert<T extends true> = T
type Equal<T, U> = (<V>() => V extends T ? 1 : 2) extends (<V>() => V extends U ? 1 : 2) ? true : false

const originalInvalidPlacement: OriginalProps = { popperOptions: { placement: 123 } }
const originalInvalidStrategy: OriginalProps = { popperOptions: { strategy: 'invalid' } }
const repairedInvalidPlacement: RepairedProps = { popperOptions: { placement: 123 } }
const repairedInvalidStrategy: RepairedProps = { popperOptions: { strategy: 'invalid' } }
type RawPropsEquality = Assert<Equal<OriginalProps, RepairedProps>>

const validOptions: Partial<Options> = {
  placement: 'bottom-start',
  strategy: 'fixed',
  modifiers: [{ name: 'offset', enabled: true, phase: 'main', options: { offset: [0, 8] }, fn: ({ state }) => state }],
  onFirstUpdate: ({ placement }) => { void placement },
}
const originalValidOptions: OriginalProps = { popperOptions: validOptions }
const repairedValidOptions: RepairedProps = { popperOptions: validOptions }
const originalOmittedOptions: OriginalProps = {}
const repairedOmittedOptions: RepairedProps = {}

void [originalInvalidPlacement, originalInvalidStrategy, repairedInvalidPlacement, repairedInvalidStrategy, originalValidOptions, repairedValidOptions, originalOmittedOptions, repairedOmittedOptions]
