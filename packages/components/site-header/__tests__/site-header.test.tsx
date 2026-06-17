import { mount } from '@vue/test-utils'
import { describe, expect, test } from 'vitest'
import SiteHeader from '../src/site-header.vue'

describe('SiteHeader.vue', () => {
  test('renders brand, desktop nav, desktop actions, and mobile actions through slots', () => {
    const wrapper = mount(SiteHeader, {
      props: {
        maxWidth: '72rem',
        navAriaLabel: 'Site navigation',
      },
      slots: {
        brand: '<a href="/" data-test="brand">Fsus</a>',
        'desktop-nav': '<a href="/archive" data-test="desktop-nav">Archive</a>',
        'desktop-actions': '<button data-test="desktop-action">Theme</button>',
        'mobile-primary-actions':
          '<button data-test="mobile-primary">Menu</button>',
        'mobile-secondary-actions':
          '<a href="/account" data-test="mobile-secondary">Account</a>',
      },
    })

    expect(wrapper.classes()).toContain('el-site-header')
    expect(wrapper.classes()).toContain('is-sticky')
    expect(wrapper.attributes('aria-label')).toBe('Site header')
    expect(wrapper.attributes('style')).toContain(
      '--el-site-header-max-width: 72rem',
    )
    expect(wrapper.find('[data-test="brand"]').exists()).toBe(true)
    expect(
      wrapper.find('.el-site-header__desktop-nav').attributes('aria-label'),
    ).toBe('Site navigation')
    expect(wrapper.find('[data-test="desktop-nav"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="desktop-action"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="mobile-primary"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="mobile-secondary"]').exists()).toBe(true)
  })

  test('supports non-sticky auth-style header without empty optional regions', () => {
    const wrapper = mount(SiteHeader, {
      props: {
        sticky: false,
        ariaLabel: 'Authentication header',
      },
      slots: {
        brand: '<a href="/" data-test="brand">Fsus</a>',
        'desktop-actions':
          '<a href="/register" data-test="action">Register</a>',
      },
    })

    expect(wrapper.classes()).not.toContain('is-sticky')
    expect(wrapper.attributes('aria-label')).toBe('Authentication header')
    expect(wrapper.find('.el-site-header__desktop-nav').exists()).toBe(false)
    expect(
      wrapper.find('.el-site-header__mobile-secondary-actions').exists(),
    ).toBe(false)
    expect(wrapper.find('[data-test="brand"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="action"]').exists()).toBe(true)
  })
})
