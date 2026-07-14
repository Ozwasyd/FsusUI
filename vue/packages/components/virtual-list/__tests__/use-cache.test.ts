import { describe, expect, it } from 'vitest'
import {
  createStyleCache,
  resolveVirtualLayerBudget,
} from '../src/hooks/use-cache'

describe('virtual-list style cache', () => {
  it('clears style maps and releases old entries', () => {
    const cache = createStyleCache()
    const styles = cache(32, 'vertical', 'ltr')
    styles[0] = { height: '32px' }
    expect(cache.size()).toBe(1)
    cache.clear()
    expect(cache.size()).toBe(0)
    expect(cache(32, 'vertical', 'ltr')).not.toBe(styles)
  })

  it('invalidates size, layout and direction signatures independently', () => {
    const cache = createStyleCache()
    const vertical = cache(32, 'vertical', 'ltr')
    const horizontal = cache(32, 'horizontal', 'ltr')
    const rtl = cache(32, 'horizontal', 'rtl')
    cache.invalidate(32, 'horizontal', 'ltr')
    expect(cache(32, 'vertical', 'ltr')).toBe(vertical)
    expect(cache(32, 'horizontal', 'rtl')).toBe(rtl)
    expect(cache(32, 'horizontal', 'ltr')).not.toBe(horizontal)
  })

  it('bounds retained style maps', () => {
    const cache = createStyleCache(2)
    const oldest = cache(20, 'vertical', 'ltr')
    cache(24, 'vertical', 'ltr')
    cache(28, 'vertical', 'ltr')
    expect(cache.size()).toBe(2)
    expect(cache(20, 'vertical', 'ltr')).not.toBe(oldest)
  })

  it('accounts for unit area and DPR in the layer budget', () => {
    expect(
      resolveVirtualLayerBudget({
        configuredBudget: 80,
        devicePixelRatio: 1,
        unitArea: 40_000,
      }),
    ).toBe(80)
    expect(
      resolveVirtualLayerBudget({
        configuredBudget: 80,
        devicePixelRatio: 2,
        unitArea: 100_000,
      }),
    ).toBe(40)
  })
})
