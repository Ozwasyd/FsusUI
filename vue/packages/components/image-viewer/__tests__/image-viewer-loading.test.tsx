import { nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import ImageViewer from '../src/image-viewer.vue'

const complete = new Set<string>()
const urls = ['/image-a.png', '/image-b.png']

async function settle() {
  await nextTick()
  await nextTick()
}

function mountViewer(initialIndex = 0) {
  return mount(ImageViewer, { props: { urlList: [...urls], initialIndex } })
}

type Viewer = ReturnType<typeof mountViewer>

async function expectZoom(viewer: Viewer, allowed: boolean) {
  await viewer.findAll('.el-image-viewer__action')[1].trigger('click')
  expect(viewer.find('img').attributes('style')).toContain(
    `scale(${allowed ? 1.2 : 1})`,
  )
}

describe('ImageViewer active image loading', () => {
  beforeEach(() => {
    complete.clear()
    vi.spyOn(HTMLImageElement.prototype, 'complete', 'get').mockImplementation(
      function (this: HTMLImageElement) {
        return complete.has(this.getAttribute('src') ?? '')
      },
    )
  })

  afterEach(() => vi.restoreAllMocks())

  test('allows actions for an initially cached nonzero active image without a load event', async () => {
    complete.add(urls[1])
    const viewer = mountViewer(1)
    await settle()
    await expectZoom(viewer, true)
  })

  test('clears previous loading when switching to an already complete image', async () => {
    complete.add(urls[1])
    const viewer = mountViewer()
    await settle()
    await expectZoom(viewer, false)
    await viewer.find('.el-image-viewer__next').trigger('click')
    await settle()
    await expectZoom(viewer, true)
  })

  test('keeps a pending active image gated until its own completed load', async () => {
    complete.add(urls[0])
    const viewer = mountViewer()
    await settle()
    await viewer.find('.el-image-viewer__next').trigger('click')
    await settle()
    await expectZoom(viewer, false)

    complete.add(urls[1])
    await viewer.findAll('img')[0].trigger('load')
    await expectZoom(viewer, false)
    await viewer.findAll('img')[1].trigger('load')
    await expectZoom(viewer, true)
  })

  test('ignores an active load event while native completion is still false', async () => {
    const viewer = mountViewer()
    await settle()
    await viewer.find('img').trigger('load')
    await expectZoom(viewer, false)
    complete.add(urls[0])
    await viewer.find('img').trigger('load')
    await expectZoom(viewer, true)
  })

  test('preserves hidden error alt text without clearing active loading', async () => {
    complete.add(urls[1])
    const viewer = mountViewer()
    await settle()
    await viewer.findAll('img')[1].trigger('error')
    expect(viewer.findAll('img')[1].attributes('alt')).toBe('FAILED')
    await expectZoom(viewer, false)
    await viewer.find('.el-image-viewer__next').trigger('click')
    await settle()
    await expectZoom(viewer, true)
  })

  test('releases loading for an active completed error and keeps localized alt', async () => {
    const viewer = mountViewer()
    await settle()
    complete.add(urls[0])
    await viewer.find('img').trigger('error')
    expect(viewer.find('img').attributes('alt')).toBe('FAILED')
    await expectZoom(viewer, true)
  })

  test('ignores completion from a removed image after source replacement', async () => {
    const viewer = mountViewer()
    await settle()
    const removed = viewer.find('img')
    await viewer.setProps({ urlList: ['/replacement.png', urls[1]] })
    await settle()
    complete.add(urls[0])
    await removed.trigger('load')
    await expectZoom(viewer, false)
    complete.add('/replacement.png')
    await viewer.find('img').trigger('load')
    await expectZoom(viewer, true)
  })

  test.each([
    [urls[1], urls[0]],
    ['/replacement.png', urls[0]],
  ])(
    'keeps the cached active ref after keyed update to %j',
    async (...urlList) => {
      complete.add(urls[0])
      const viewer = mountViewer(1)
      await settle()
      await expectZoom(viewer, false)
      await viewer.setProps({ urlList })
      await settle()
      await expectZoom(viewer, true)
    },
  )
})
