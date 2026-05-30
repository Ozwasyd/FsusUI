import { config, enableAutoUnmount } from '@vue/test-utils'
import { afterAll, afterEach, vi } from 'vitest'

const rafHandles = new Map<number, ReturnType<typeof setTimeout>>()
let rafHandleSeed = 0

const requestAnimationFrameShim = (callback: FrameRequestCallback) => {
  const id = ++rafHandleSeed
  const timeout = setTimeout(() => {
    rafHandles.delete(id)
    callback(performance.now())
  }, 16)
  rafHandles.set(id, timeout)
  return id
}

const cancelAnimationFrameShim = (id: number) => {
  const timeout = rafHandles.get(id)
  if (timeout) {
    clearTimeout(timeout)
    rafHandles.delete(id)
  }
}

const clearAnimationFrameTimers = () => {
  for (const timeout of rafHandles.values()) {
    clearTimeout(timeout)
  }
  rafHandles.clear()
}

window.requestAnimationFrame = requestAnimationFrameShim
window.cancelAnimationFrame = cancelAnimationFrameShim
globalThis.requestAnimationFrame = requestAnimationFrameShim
globalThis.cancelAnimationFrame = cancelAnimationFrameShim

const testWindow = window as typeof window & {
  SVGGraphicsElement?: typeof SVGGraphicsElement
}
const svgGraphicsElement =
  typeof testWindow.SVGGraphicsElement === 'function'
    ? testWindow.SVGGraphicsElement
    : (testWindow.SVGElement as unknown as typeof SVGGraphicsElement)

const defineTestGlobal = <T>(target: object, key: string, value: T) => {
  Object.defineProperty(target, key, {
    configurable: true,
    writable: true,
    value,
  })
}

if (typeof testWindow.SVGGraphicsElement !== 'function') {
  defineTestGlobal(testWindow, 'SVGGraphicsElement', svgGraphicsElement)
}
if (typeof globalThis.SVGGraphicsElement !== 'function') {
  defineTestGlobal(globalThis, 'SVGGraphicsElement', svgGraphicsElement)
}

const ensureResizeObserverWindow = (target?: Element) => {
  const ownerWindow = target?.ownerDocument?.defaultView ?? window
  const ownerSvgElement =
    typeof ownerWindow.SVGElement === 'function'
      ? ownerWindow.SVGElement
      : testWindow.SVGElement
  const ownerSvgGraphicsElement =
    typeof ownerWindow.SVGGraphicsElement === 'function'
      ? ownerWindow.SVGGraphicsElement
      : ownerSvgElement

  if (typeof ownerWindow.SVGGraphicsElement !== 'function') {
    defineTestGlobal(
      ownerWindow,
      'SVGGraphicsElement',
      ownerSvgGraphicsElement,
    )
  }

  return ownerWindow
}

const createResizeObserverRect = (target: Element): DOMRectReadOnly => {
  const rect = target.getBoundingClientRect()
  const contentRect = {
    bottom: rect.height,
    height: rect.height,
    left: 0,
    right: rect.width,
    top: 0,
    width: rect.width,
    x: 0,
    y: 0,
    toJSON: () => contentRect,
  }

  return contentRect
}

const createResizeObserverEntry = (target: Element): ResizeObserverEntry => {
  const contentRect = createResizeObserverRect(target)
  const boxSize = [
    {
      blockSize: contentRect.height,
      inlineSize: contentRect.width,
    },
  ]

  return {
    borderBoxSize: boxSize,
    contentBoxSize: boxSize,
    contentRect,
    devicePixelContentBoxSize: boxSize,
    target,
  } as ResizeObserverEntry
}

class TestResizeObserver implements ResizeObserver {
  private frame = 0
  private readonly targets = new Set<Element>()

  constructor(private readonly callback: ResizeObserverCallback) {}

  observe(target: Element) {
    const ownerWindow = ensureResizeObserverWindow(target)
    if (typeof ownerWindow.ResizeObserver !== 'function') {
      defineTestGlobal(ownerWindow, 'ResizeObserver', TestResizeObserver)
    }
    this.targets.add(target)
    this.schedule()
  }

  unobserve(target: Element) {
    this.targets.delete(target)
  }

  disconnect() {
    this.targets.clear()
    if (this.frame) {
      cancelAnimationFrame(this.frame)
      this.frame = 0
    }
  }

  private schedule() {
    if (this.frame) return
    this.frame = requestAnimationFrame(() => {
      this.frame = 0
      if (!this.targets.size) return
      this.callback(
        Array.from(this.targets, (target) => createResizeObserverEntry(target)),
        this,
      )
    })
  }
}

defineTestGlobal(window, 'ResizeObserver', TestResizeObserver)
defineTestGlobal(globalThis, 'ResizeObserver', TestResizeObserver)
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

afterEach(() => {
  clearAnimationFrameTimers()
})

enableAutoUnmount(afterEach)

afterEach(() => {
  document.body.innerHTML = ''
  clearAnimationFrameTimers()
})

afterAll(() => {
  clearAnimationFrameTimers()
})

config.global.stubs = {}
