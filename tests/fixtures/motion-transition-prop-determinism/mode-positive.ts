import type { FsuTransition } from '@ozwasyd/element-plus'
import type { TransitionProps } from 'vue'

type Props = InstanceType<typeof FsuTransition>['$props']
type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? true
    : false
type Assert<T extends true> = T
export type SameMode = Assert<Equal<Props['mode'], TransitionProps['mode']>>

const modes: Props['mode'][] = [undefined, 'in-out', 'out-in', 'default']
const valid: Props = {
  name: 'surface-settle',
  duration: '200ms',
  delay: 4,
  easing: 'linear',
  disabled: true,
  appear: true,
  suppressAppearDuringHydration: true,
  mode: 'out-in',
}
void [modes, valid]
