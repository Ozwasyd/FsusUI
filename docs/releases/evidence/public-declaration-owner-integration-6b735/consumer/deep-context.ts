import { useGsapContext } from '@ozwasyd/element-plus/es/motion/composables/use-gsap-context'
type IsAny<T> = 0 extends (1 & T) ? true : false
const controls = useGsapContext(document.createElement('div'))
const ctx = controls.create(() => undefined)
const typed: IsAny<typeof ctx> = false
const reverted: boolean = ctx.isReverted
ctx.revert()
// @ts-expect-error retain the original boolean kill argument
ctx.kill('true')
void [typed, reverted]
