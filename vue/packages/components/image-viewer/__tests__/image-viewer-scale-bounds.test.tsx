import { nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, test, vi } from 'vitest'
import ImageViewer from '../src/image-viewer.vue'

async function mountViewer(props = {}) {
  const viewer = mount(ImageViewer, {
    props: { urlList: ['/scale-bounds.png'], ...props },
  })
  await nextTick()
  await nextTick()
  const img = viewer.find('img')
  Object.defineProperty(img.element, 'complete', {
    configurable: true,
    value: true,
  })
  await img.trigger('load')
  return viewer
}

type Viewer = Awaited<ReturnType<typeof mountViewer>>

function expectScale(viewer: Viewer, scale: number) {
  expect(viewer.find('img').element.style.transform).toContain(
    `scale(${scale})`,
  )
}

async function zoom(viewer: Viewer, input: string, zoomIn: boolean) {
  if (input === 'wheel') {
    const event = new WheelEvent('wheel', {
      deltaY: zoomIn ? -120 : 120,
      cancelable: true,
    })
    viewer.find('.el-image-viewer__wrapper').element.dispatchEvent(event)
    await nextTick()
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(event.defaultPrevented).toBe(true)
  } else {
    await viewer
      .findAll('.el-image-viewer__action')
      [zoomIn ? 1 : 0].trigger('click')
  }
}

afterEach(() => vi.restoreAllMocks())

describe.each(['button', 'wheel'])(
  'ImageViewer scale bounds via %s',
  (input) => {
    test.each([
      {
        minScale: 0.9,
        maxScale: 1.1,
        zoomIn: true,
        expected: 1.1,
        reversed: 0.917,
      },
      {
        minScale: 0.9,
        maxScale: 1.1,
        zoomIn: false,
        expected: 0.9,
        reversed: 1.08,
      },
      {
        minScale: 0.9001,
        maxScale: 1.1001,
        zoomIn: true,
        expected: 1.1001,
        reversed: 0.917,
      },
      {
        minScale: 0.9001,
        maxScale: 1.1001,
        zoomIn: false,
        expected: 0.9001,
        reversed: 1.08,
      },
    ])(
      'clamps at $expected and stays there',
      async ({ zoomIn, expected, reversed, ...props }) => {
        const viewer = await mountViewer({ ...props, zoomRate: 1.2 })
        expectScale(viewer, 1)
        await zoom(viewer, input, zoomIn)
        expectScale(viewer, expected)
        await zoom(viewer, input, zoomIn)
        expectScale(viewer, expected)
        await zoom(viewer, input, !zoomIn)
        expectScale(viewer, reversed)
      },
    )

    test('preserves three-decimal rounding within the bounds', async () => {
      const viewer = await mountViewer()
      await zoom(viewer, input, false)
      expectScale(viewer, 0.833)
      await zoom(viewer, input, true)
      expectScale(viewer, 1)
      await zoom(viewer, input, true)
      expectScale(viewer, 1.2)
      expect(viewer.find('img').element.style.transition).toBe(
        input === 'wheel' ? '' : 'transform .3s',
      )
    })
  },
)

test('keeps zoom gated by active image loading', async () => {
  vi.spyOn(HTMLImageElement.prototype, 'complete', 'get').mockReturnValue(false)
  const viewer = mount(ImageViewer, {
    props: { urlList: ['/pending.png'], minScale: 0.9, maxScale: 1.1 },
  })
  await nextTick()
  await nextTick()
  await zoom(viewer, 'button', true)
  await zoom(viewer, 'wheel', false)
  expectScale(viewer, 1)
})

test.each([
  { zoomIn: true, expected: 7 },
  { zoomIn: false, expected: 0.2 },
])(
  'stops repeated button clicks at the default bound $expected',
  async ({ zoomIn, expected }) => {
    const viewer = await mountViewer()
    for (let i = 0; i < 20; i++) {
      await zoom(viewer, 'button', zoomIn)
    }
    expectScale(viewer, expected)
  },
)

test('does not consume wheel events outside the viewer', async () => {
  const viewer = await mountViewer({ minScale: 0.9, maxScale: 1.1 })
  const event = new WheelEvent('wheel', { deltaY: -120, cancelable: true })
  document.dispatchEvent(event)
  await nextTick()
  expectScale(viewer, 1)
  expect(event.defaultPrevented).toBe(false)
})

test('preserves rotation events and mode/image reset after clamped zoom', async () => {
  const viewer = await mountViewer({
    urlList: ['/scale-a.png', '/scale-b.png'],
    minScale: 0.9,
    maxScale: 1.1,
  })
  const actions = viewer.findAll('.el-image-viewer__action')
  await zoom(viewer, 'button', true)
  expectScale(viewer, 1.1)
  await actions[4].trigger('click')
  expect(viewer.emitted('rotate')).toEqual([[90]])
  expect(viewer.find('img').element.style.transform).toContain('rotate(90deg)')
  await actions[3].trigger('click')
  expect(viewer.emitted('rotate')).toEqual([[90], [0]])
  await actions[2].trigger('click')
  expectScale(viewer, 1)
  await zoom(viewer, 'button', false)
  expectScale(viewer, 0.9)
  await viewer.find('.el-image-viewer__next').trigger('click')
  expect(viewer.emitted('switch')).toEqual([[1]])
  expectScale(viewer, 1)
})
