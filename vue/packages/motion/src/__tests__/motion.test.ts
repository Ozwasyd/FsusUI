import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import {
  FsusBottomTabBar,
  FsusTransition,
  createFsusSpring,
  fsusDecayOverflow,
  getMotionPreset,
  normalizeFsusWheelDelta,
  resolveFsusInteractiveMotion,
  runMotion,
} from '../index'

describe('@fsusui/motion (unified zero-dep engine)', () => {
  it('provides spring physics, wheel normalization, and interactive motion metrics', () => {
    const spring = createFsusSpring(0)
    spring.jump(10)
    expect(spring.get()).toBe(10)
    expect(normalizeFsusWheelDelta(120, { deltaMode: 0 })).toBe(48)
    expect(fsusDecayOverflow(100, 24)).toBeLessThan(24)
    const metrics = resolveFsusInteractiveMotion({ deltaY: 20, kind: 'scroll' })
    expect(metrics.strength).toBeGreaterThan(0)
  })

  it('runs WAAPI/fallback motion presets and renders Fsus* components', () => {
    expect(getMotionPreset('surface-settle').name).toBe('surface-settle')
    const el = document.createElement('div')
    let finished = false
    runMotion(el, { name: 'surface-settle', disabled: true, onFinish: () => (finished = true) })
    expect(finished).toBe(true)

    const wrapper = mount(FsusBottomTabBar, {
      props: {
        modelValue: 'home',
        items: [
          { key: 'home', label: 'Home' },
          { key: 'settings', label: 'Settings' },
        ],
      },
    })
    expect(wrapper.findAll('button[role="tab"]')).toHaveLength(2)
    expect(FsusTransition.name).toBe('FsusTransition')
  })
})
