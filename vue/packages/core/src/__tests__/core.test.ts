import { describe, expect, it, vi } from 'vitest'
import {
  addDays,
  addMonths,
  clamp,
  debounce,
  deepClone,
  deepMerge,
  defineFsusLocale,
  en,
  escapeHtml,
  formatDate,
  formatLocaleText,
  formatTime,
  fsusErr,
  fsusOk,
  getByPath,
  getMonthGrid,
  isEqual,
  isSameDay,
  omit,
  parseTime,
  pick,
  setByPath,
  toDate,
  validateRules,
  zhCN,
} from '../index'

describe('@fsusui/core', () => {
  it('provides zero-dep object/string/timing utilities', () => {
    expect(clamp(15, 0, 10)).toBe(10)
    expect(escapeHtml('<script>"a"&\'b\'</script>')).toBe(
      '&lt;script&gt;&quot;a&quot;&amp;&#39;b&#39;&lt;/script&gt;',
    )
    const obj: Record<string, any> = { a: { b: [10, 20] } }
    expect(getByPath(obj, 'a.b[1]')).toBe(20)
    setByPath(obj, 'a.c.d', 42)
    expect(obj.a.c.d).toBe(42)
    expect(pick({ a: 1, b: 2, c: 3 }, ['a', 'c'])).toEqual({ a: 1, c: 3 })
    expect(omit({ a: 1, b: 2, c: 3 }, ['b'])).toEqual({ a: 1, c: 3 })
    expect(isEqual(deepClone(obj), obj)).toBe(true)
    expect(deepMerge({ a: { x: 1 }, b: 2 }, { a: { y: 3 } })).toEqual({
      a: { x: 1, y: 3 },
      b: 2,
    })

    vi.useFakeTimers()
    const spy = vi.fn()
    const fn = debounce(spy, 50)
    fn('a')
    fn('b')
    vi.advanceTimersByTime(50)
    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy).toHaveBeenCalledWith('b')
    vi.useRealTimers()
  })

  it('provides zero-dep date & calendar engine', () => {
    const d = toDate('2026-11-28')!
    expect(formatDate(d, 'YYYY/MM/DD')).toBe('2026/11/28')
    expect(isSameDay(addDays(d, 2), toDate('2026-11-30'))).toBe(true)
    expect(formatDate(addMonths(toDate('2026-01-31')!, 1), 'YYYY-MM-DD')).toBe('2026-02-28')
    expect(parseTime('09:30:45')).toEqual({ hours: 9, minutes: 30, seconds: 45 })
    expect(formatTime(9, 5)).toBe('09:05')
    const grid = getMonthGrid(2026, 10, 1)
    expect(grid).toHaveLength(42)
  })

  it('supports native + Standard Schema v1 form validation', async () => {
    const res1 = await validateRules([{ required: true, message: '必填' }], '')
    expect(res1).toEqual({ valid: false, message: '必填' })

    const res2 = await validateRules([{ type: 'email' }], 'user@fsus.dev')
    expect(res2.valid).toBe(true)

    const fakeZodSchema = {
      '~standard': {
        version: 1 as const,
        vendor: 'zod',
        validate: (v: unknown) =>
          typeof v === 'string' && v.startsWith('fsus_')
            ? { value: v }
            : { issues: [{ message: 'Must start with fsus_' }] },
      },
    }
    const res3 = await validateRules([{ schema: fakeZodSchema }], 'invalid')
    expect(res3).toEqual({ valid: false, message: 'Must start with fsus_' })
    const res4 = await validateRules([{ schema: fakeZodSchema }], 'fsus_ok')
    expect(res4.valid).toBe(true)
  })

  it('supports typed locale extension and FsusResult', () => {
    const ja = defineFsusLocale({ name: 'ja', common: { confirm: '確定' } }, en)
    expect(ja.common.confirm).toBe('確定')
    expect(ja.common.cancel).toBe(en.common.cancel)
    expect(formatLocaleText(zhCN.pagination.total, { total: 42 })).toBe('共 42 条')
    expect(fsusOk(1).ok).toBe(true)
    expect(fsusErr({ code: 'validation', category: 'validation', message: 'bad' }).ok).toBe(false)
  })
})
