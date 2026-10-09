import { ElSelect } from '@ozwasyd/element-plus/es/components/select'

type Props = InstanceType<typeof ElSelect>['$props']
type Assert<T extends true> = T
type OptionalPopperOptions = Assert<undefined extends Props['popperOptions'] ? true : false>

const invalidPlacement: Props = { popperOptions: { placement: 123 } }
const invalidStrategy: Props = { popperOptions: { strategy: 'invalid' } }
const validCompletePartialOptions: Props = {
  popperOptions: {
    placement: 'bottom-start',
    strategy: 'fixed',
    modifiers: [{ name: 'offset', enabled: true, phase: 'main', options: { offset: [0, 8] }, fn: ({ state }) => state }],
    onFirstUpdate: ({ placement }) => { void placement },
  },
}
const omittedOptions: Props = {}
const undefinedOptions: Props = { popperOptions: undefined }

void [invalidPlacement, invalidStrategy, validCompletePartialOptions, omittedOptions, undefinedOptions]
