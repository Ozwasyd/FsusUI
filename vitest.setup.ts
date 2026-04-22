import { config, enableAutoUnmount } from '@vue/test-utils'
import { afterEach, vi } from 'vitest'
import ResizeObserver from 'resize-observer-polyfill'

vi.stubGlobal('ResizeObserver', ResizeObserver)
const mockCanvasContext = {
  save: vi.fn(),
  restore: vi.fn(),
  translate: vi.fn(),
  rotate: vi.fn(),
  drawImage: vi.fn(),
  fillText: vi.fn(),
  clearRect: vi.fn(),
  beginPath: vi.fn(),
  closePath: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  stroke: vi.fn(),
  fillRect: vi.fn(),
  measureText: vi.fn(() => ({ width: 100 })),
  set font(_value: string) {},
  set fillStyle(_value: string) {},
  set textAlign(_value: CanvasTextAlign) {},
  set textBaseline(_value: CanvasTextBaseline) {},
}

vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
  () => mockCanvasContext as unknown as CanvasRenderingContext2D
)
vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockImplementation(
  () => 'data:image/png;base64,'
)

enableAutoUnmount(afterEach)

afterEach(() => {
  document.body.innerHTML = ''
})

config.global.stubs = {}
