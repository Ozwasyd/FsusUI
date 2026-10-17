import type { FsuTransition } from '@ozwasyd/element-plus'

type Props = InstanceType<typeof FsuTransition>['$props']
const invalidString: Props['mode'] = 'invalid-mode'
const invalidNumber: Props['mode'] = 42
void [invalidString, invalidNumber]
