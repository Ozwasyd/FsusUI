import { describe, expect, it } from 'vitest'
import { expectTypeOf } from 'expect-type'

import {
  createFsusError,
  fsusErr,
  fsusOk,
  getFsusErrorMessage,
  isFsusErr,
  isFsusOk,
  isFsusResult,
  isTruthyFsusOk,
} from '../../packages/element-plus/result'

import type {
  FsusErrorCode,
  FsusErrorDetail,
  FsusResult,
} from '../../packages/element-plus/result'

describe('result mode public API', () => {
  it('exports stable Result helpers from element-plus/result', () => {
    const ok = fsusOk('ready')
    const err = fsusErr(createFsusError('infra', 'runtime unavailable'))

    expect(isFsusOk(ok)).toBe(true)
    expect(isFsusErr(err)).toBe(true)
    expect(isFsusResult(ok)).toBe(true)
    expect(isTruthyFsusOk(ok)).toBe(true)
    expect(getFsusErrorMessage(err, 'fallback')).toBe('runtime unavailable')
    expect(err.error.code).toBe('infra')
  })

  it('exposes result mode types', () => {
    expectTypeOf<FsusErrorCode>().toEqualTypeOf<
      | 'validation'
      | 'not-found'
      | 'conflict'
      | 'unauthorized'
      | 'forbidden'
      | 'infra'
      | 'protocol'
      | 'timeout'
      | 'aborted'
      | 'invariant'
      | 'unknown'
    >()
    expectTypeOf<FsusErrorDetail>().toHaveProperty('message').toBeString()
    expectTypeOf<FsusResult<number>>().toMatchTypeOf<
      { ok: true; value: number } | { ok: false; error: FsusErrorDetail }
    >()
  })
})
