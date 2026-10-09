import { useScrollReveal } from '@ozwasyd/element-plus/motion'
import type { ScrollRevealOptions, ScrollRevealRunOptions } from '@ozwasyd/element-plus/motion'
type IsAny<T> = 0 extends (1 & T) ? true : false
const controlsAreTyped: IsAny<ReturnType<typeof useScrollReveal>> = false
const optionsAreTyped: IsAny<ScrollRevealOptions> = false
const options: ScrollRevealOptions = { name: 'paper-settle', disabled: false }
const runOptions: ScrollRevealRunOptions = { once: true, scrub: 0.5 }
const controls = useScrollReveal(options)
const tween = controls.reveal(document.createElement('div'), runOptions)
const returnedTween: ReturnType<typeof controls.reveal> = tween
const retainedTweens: typeof controls.tweens = controls.tweens
controls.refresh()
controls.kill()
// @ts-expect-error disabled is boolean, not a string
useScrollReveal({ disabled: 'true' })
void [controlsAreTyped, optionsAreTyped, returnedTween, retainedTweens]

const controlKeys: 'reveal' | 'kill' | 'refresh' | 'tweens' extends keyof ReturnType<typeof useScrollReveal> ? true : false = true
void controlKeys
