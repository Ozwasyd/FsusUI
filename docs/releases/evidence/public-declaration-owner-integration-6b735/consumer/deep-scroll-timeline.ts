import { useScrollTimeline } from '@ozwasyd/element-plus/es/motion/composables/use-scroll-timeline'
type IsAny<T> = 0 extends (1 & T) ? true : false
const controls = useScrollTimeline({ segments: [{ from: 0, to: 1, vars: { opacity: 1 } }] })
const typed: IsAny<NonNullable<ReturnType<typeof controls.create>>> = false
// @ts-expect-error disabled remains boolean
useScrollTimeline({ disabled: 'yes' })
void typed
