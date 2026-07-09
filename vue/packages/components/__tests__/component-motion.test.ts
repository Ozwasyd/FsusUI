import { describe, expect, test } from 'vitest'
import {
  resolveComponentMotionAttrs,
  resolveComponentTransitionName,
} from '../motion'

describe('component motion contract', () => {
  test('resolves semantic motion attrs with a fallback preset', () => {
    // undefined motion + legacy fallback name → fallback is itself resolved
    // through motionPresetAliases ('card-hover' → 'paper-settle').
    expect(resolveComponentMotionAttrs(undefined, 'card-hover')).toEqual({
      'data-fsus-motion-preset': 'paper-settle',
      'data-fsus-motion-disabled': undefined,
    })
    // Legacy input ('fade-up') is routed through motionPresetAliases to its
    // intent-based equivalent ('paper-settle').
    expect(resolveComponentMotionAttrs('fade-up', 'card-hover')).toEqual({
      'data-fsus-motion-preset': 'paper-settle',
      'data-fsus-motion-disabled': undefined,
    })
    // Intent-based names pass through unchanged.
    expect(resolveComponentMotionAttrs('dialog-settle', 'card-hover')).toEqual(
      {
        'data-fsus-motion-preset': 'dialog-settle',
        'data-fsus-motion-disabled': undefined,
      },
    )
  })

  test('resolves motion false as a per-component disable switch', () => {
    expect(resolveComponentMotionAttrs(false, 'card-hover')).toEqual({
      'data-fsus-motion-preset': undefined,
      'data-fsus-motion-disabled': 'true',
    })
  })

  test('maps preset transition names without forcing raw animation APIs', () => {
    // Caller map keyed by the legacy name; alias resolution normalizes the
    // lookup key to the intent-based equivalent.
    expect(
      resolveComponentTransitionName('scale-fade', 'dialog-fade', {
        'scale-fade': 'dialog-scale-fade',
      }),
    ).toBe('dialog-scale-fade')
    // Caller map keyed by the intent name directly; input may be either
    // legacy or intent — both reach the same transition.
    expect(
      resolveComponentTransitionName('scale-fade', 'dialog-fade', {
        'dialog-settle': 'dialog-scale-fade',
      }),
    ).toBe('dialog-scale-fade')
    expect(
      resolveComponentTransitionName('dialog-settle', 'dialog-fade', {
        'dialog-settle': 'dialog-scale-fade',
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
