import { useScrollReveal, getGsap } from '@ozwasyd/element-plus/motion'
type IsAny<T> = 0 extends (1 & T) ? true : false
const reveal = useScrollReveal({ vars: { opacity: 1 }, scrollTrigger: { markers: false } })
const tweenIsTyped: IsAny<NonNullable<ReturnType<typeof reveal.reveal>>> = false
const tween = getGsap().to(document.createElement('div'), { opacity: 1 })
const duration: number = tween.duration()
// @ts-expect-error GSAP tweens have no unknown method
tween.nonexistentMotionMethod()
// @ts-expect-error disabled is boolean
useScrollReveal({ disabled: 'true' })
// @ts-expect-error ScrollTrigger markers must preserve their original type
useScrollReveal({ scrollTrigger: { markers: 'true' } })
void [tweenIsTyped, duration]
