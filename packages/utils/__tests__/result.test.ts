import { describe, expect, it } from 'vitest'
import {
  bindFsusResult,
  createFsusError,
  fsusErr,
  fsusOk,
  fsusTry,
  fsusTryAsync,
  getFsusErrorMessage,
  isFsusErr,
  isFsusOk,
  isFsusResult,
  isTruthyFsusOk,
  mapFsusResult,
  toFsusError,
} from '../result'

describe('FsusResult', () => {
  it('models ok and err branches explicitly', () => {
    const ok = fsusOk(42)
    const err = fsusErr(createFsusError('validation', 'bad input'))

    expect(isFsusOk(ok)).toBe(true)
    expect(isFsusErr(ok)).toBe(false)
    if (!isFsusOk(ok)) throw new Error('expected ok result')
    expect(ok.value).toBe(42)
    expect(isFsusErr(err)).toBe(true)
    if (!isFsusErr(err)) throw new Error('expected err result')
    expect(err.error.code).toBe('validation')
    expect(err.error.category).toBe('validation')
  })

  it('maps and binds only successful values', () => {
    expect(mapFsusResult(fsusOk(2), (value) => value * 3)).toEqual(fsusOk(6))
    expect(bindFsusResult(fsusOk(2), (value) => fsusOk(String(value)))).toEqual(
      fsusOk('2'),
    )

    const err = fsusErr<number>(createFsusError('timeout', 'too slow'))
    expect(mapFsusResult(err, (value) => value * 3)).toBe(err)
    expect(bindFsusResult(err, (value) => fsusOk(String(value)))).toBe(err)
  })

  it('exposes public result shape and truthy/error helpers', () => {
    const ok = fsusOk('ready')
    const empty = fsusOk('')
    const err = fsusErr(createFsusError('infra', 'runtime unavailable'))

    expect(isFsusResult(ok)).toBe(true)
    expect(isFsusResult({ ok: false, error: { code: 'nope' } })).toBe(false)
    expect(isTruthyFsusOk(ok)).toBe(true)
    expect(isTruthyFsusOk(empty)).toBe(false)
    expect(getFsusErrorMessage(err, 'fallback')).toBe('runtime unavailable')
    expect(getFsusErrorMessage(new Error('boom'), 'fallback')).toBe('boom')
    expect(getFsusErrorMessage(null, 'fallback')).toBe('fallback')
  })

  it('normalizes common platform errors', () => {
    const abort = new DOMException('cancelled', 'AbortError')
    expect(toFsusError(abort).code).toBe('aborted')
    expect(toFsusError(new Error('request timeout')).code).toBe('timeout')
    expect(toFsusError('plain failure').message).toBe('plain failure')
  })

  it('wraps sync and async exceptions into err results', async () => {
    expect(fsusTry(() => 'ok')).toEqual(fsusOk('ok'))
    expect(
      fsusTry(() => {
        throw new Error('boom')
      }).ok,
    ).toBe(false)

    await expect(fsusTryAsync(async () => 7)).resolves.toEqual(fsusOk(7))
    const result = await fsusTryAsync(async () => {
      throw new DOMException('cancelled', 'AbortError')
    })
    expect(result.ok).toBe(false)
    if (isFsusErr(result)) {
      expect(result.error.code).toBe('aborted')
    }
  })
})
