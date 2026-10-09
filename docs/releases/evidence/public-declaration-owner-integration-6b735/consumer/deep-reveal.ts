import { useScrollReveal } from '@ozwasyd/element-plus/es/motion/composables/use-scroll-reveal'
type IsAny<T> = 0 extends (1 & T) ? true : false
const controls = useScrollReveal({ vars: { opacity: 1 }, scrollTrigger: { markers: false } })
const typed: IsAny<NonNullable<ReturnType<typeof controls.reveal>>> = false
// @ts-expect-error marker contract remains typed
useScrollReveal({ scrollTrigger: { markers: 'yes' } })
void typed
