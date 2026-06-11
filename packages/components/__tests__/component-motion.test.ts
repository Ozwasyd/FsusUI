import { describe, expect, test } from 'vitest'
import {
  resolveComponentMotionAttrs,
  resolveComponentTransitionName,
} from '../motion'

describe('component motion contract', () => {
  test('resolves semantic motion attrs with a fallback preset', () => {
    expect(resolveComponentMotionAttrs(undefined, 'card-hover')).toEqual({
      'data-fsus-motion-preset': 'card-hover',
      'data-fsus-motion-disabled': undefined,
    })
    expect(resolveComponentMotionAttrs('fade-up', 'card-hover')).toEqual({
      'data-fsus-motion-preset': 'fade-up',
      'data-fsus-motion-disabled': undefined,
    })
  })

  test('resolves motion false as a per-component disable switch', () => {
    expect(resolveComponentMotionAttrs(false, 'card-hover')).toEqual({
      'data-fsus-motion-preset': undefined,
      'data-fsus-motion-disabled': 'true',
    })
  })

  test('maps preset transition names without forcing raw animation APIs', () => {
    expect(
      resolveComponentTransitionName('scale-fade', 'dialog-fade', {
        'scale-fade': 'dialog-scale-fade',
      }),
    ).toBe('dialog-scale-fade')
    expect(
      resolveComponentTransitionName(undefined, 'dialog-fade', {
        'scale-fade': 'dialog-scale-fade',
      }),
    ).toBe('dialog-fade')
    expect(
      resolveComponentTransitionName(false, 'dialog-fade', {
        'scale-fade': 'dialog-scale-fade',
      }),
    ).toBe('')
  })
})
