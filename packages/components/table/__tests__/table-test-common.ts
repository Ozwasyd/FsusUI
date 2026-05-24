import { nextTick } from 'vue'
import { mount as _mount } from '@vue/test-utils'
import type { VueWrapper } from '@vue/test-utils'
import { afterEach, vi } from 'vitest'

vi.mock('lodash-unified', async () => {
  return {
    ...((await vi.importActual('lodash-unified')) as Record<string, any>),
    debounce: vi.fn((fn) => {
      fn.cancel = vi.fn()
      fn.flush = vi.fn()
      return fn
    }),
  }
})

export async function doubleWait() {
  await nextTick()
  await nextTick()
}

const mountedWrappers = new Set<VueWrapper<any>>()

afterEach(() => {
  mountedWrappers.forEach((wrapper) => wrapper.unmount())
  mountedWrappers.clear()
})

export const mount = (opt: any) => {
  const wrapper = _mount<any>(opt, {
    attachTo: 'body',
  })
  const unmount = wrapper.unmount.bind(wrapper)
  let mounted = true

  wrapper.unmount = () => {
    if (!mounted) return

    mounted = false
    mountedWrappers.delete(wrapper)
    unmount()
  }

  mountedWrappers.add(wrapper)
  return wrapper
}

export function getTestData() {
  return [
    {
      id: 1,
      name: 'Toy Story',
      release: '1995-11-22',
      director: 'John Lasseter',
      runtime: 80,
    },
    {
      id: 2,
      name: "A Bug's Life",
      release: '1998-11-25',
      director: 'John Lasseter',
      runtime: 95,
    },
    {
      id: 3,
      name: 'Toy Story 2',
      release: '1999-11-24',
      director: 'John Lasseter',
      runtime: 92,
    },
    {
      id: 4,
      name: 'Monsters, Inc.',
      release: '2001-11-2',
      director: 'Peter Docter',
      runtime: 92,
    },
    {
      id: 5,
      name: 'Finding Nemo',
      release: '2003-5-30',
      director: 'Andrew Stanton',
      runtime: 100,
    },
  ]
}
