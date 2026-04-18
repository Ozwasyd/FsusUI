import { config, enableAutoUnmount } from '@vue/test-utils'
import { afterEach, vi } from 'vitest'
import ResizeObserver from 'resize-observer-polyfill'

vi.stubGlobal('ResizeObserver', ResizeObserver)

enableAutoUnmount(afterEach)

afterEach(() => {
  document.body.innerHTML = ''
})

config.global.stubs = {}
