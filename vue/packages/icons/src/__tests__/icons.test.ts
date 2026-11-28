import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import {
  FSUS_ICON_PATHS,
  FsusIcon,
  FsusIconSearch,
  registerFsusIcon,
  resolveFsusIconPath,
} from '../index'

describe('@fsusui/icons', () => {
  it('exposes compact canonical icon set and supports custom registration', () => {
    expect(Object.keys(FSUS_ICON_PATHS).length).toBeGreaterThanOrEqual(60)
    expect(resolveFsusIconPath('search')).toBeTruthy()
    registerFsusIcon('custom-dot', 'M0 0h10v10H0z')
    expect(resolveFsusIconPath('custom-dot')).toBe('M0 0h10v10H0z')
  })

  it('renders decorative and accessible icons cleanly', () => {
    const w1 = mount(FsusIconSearch, { props: { size: 20 } })
    expect(w1.classes()).toContain('fsus-icon')
    expect(w1.attributes('aria-hidden')).toBe('true')
    expect(w1.find('svg path').attributes('d')).toBe(FSUS_ICON_PATHS.search)

    const w2 = mount(FsusIcon, { props: { name: 'close', label: 'Close panel' } })
    expect(w2.attributes('role')).toBe('img')
    expect(w2.attributes('aria-label')).toBe('Close panel')
    expect(w2.attributes('aria-hidden')).toBeUndefined()
  })
})
