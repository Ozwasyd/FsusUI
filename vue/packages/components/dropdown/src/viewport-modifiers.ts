import { arrow, computeStyles, offset, preventOverflow } from '@popperjs/core'

import type { Modifier, State } from '@popperjs/core'

const zoomKey = 'dropdownViewport'
const getZoom = (state: State) => state.modifiersData[zoomKey]?.zoom ?? 1

// Popper v2 uses client reference rectangles but CSS layout popper dimensions.
// For a root-zoomed, body-teleported overlay, run its geometry in client pixels
// and convert only arrow/style output back to CSS pixels. Popper still owns
// placement, flip, tethering, overflow and event listener cleanup.
export const dropdownViewportModifiers = (): Modifier<any, any>[] => [
  {
    ...preventOverflow,
    options: { altAxis: true, tether: false },
  },
  {
    name: zoomKey,
    enabled: true,
    phase: 'beforeRead',
    fn: ({ state, name }) => {
      const element = state.elements.popper
      const root = element.ownerDocument.documentElement
      const window = element.ownerDocument.defaultView!
      const parent = element.offsetParent
      const rootPositioned =
        parent &&
        ((parent !== root && parent !== root.ownerDocument.body) ||
          window.getComputedStyle(parent).position !== 'static')
      const rootZoom =
        Number.parseFloat(window.getComputedStyle(root).zoom) || 1
      const zoom = rootPositioned ? 1 : rootZoom
      const viewport = window.visualViewport
      const width = viewport?.width ?? root.clientWidth
      const height = viewport?.height ?? root.clientHeight
      element.style.setProperty(
        '--el-dropdown-viewport-width',
        `${width / rootZoom}px`,
      )
      element.style.setProperty(
        '--el-dropdown-viewport-height',
        `${height / rootZoom}px`,
      )
      if (!state.modifiersData[name]?.normalized) {
        if (!rootPositioned) {
          state.rects.popper.width = element.offsetWidth * zoom
          state.rects.popper.height = element.offsetHeight * zoom
        }
        state.modifiersData[name] = { zoom, normalized: true }
      }
    },
    effect:
      ({ state }) =>
      () => {
        state.elements.popper.style.removeProperty(
          '--el-dropdown-viewport-width',
        )
        state.elements.popper.style.removeProperty(
          '--el-dropdown-viewport-height',
        )
      },
  },
  {
    ...offset,
    fn: (args) => {
      offset.fn(args)
      const zoom = getZoom(args.state)
      const data = args.state.modifiersData.offset
      const offsets = args.state.modifiersData.popperOffsets
      if (!data || !offsets) return
      const current = data[args.state.placement]
      if (!current) return
      offsets.x += current.x * (zoom - 1)
      offsets.y += current.y * (zoom - 1)
      for (const value of Object.values(data)) {
        if (!value) continue
        value.x *= zoom
        value.y *= zoom
      }
    },
  },
  {
    ...arrow,
    fn: (args) => inCssCoordinates(args.state, () => arrow.fn(args)),
  },
  {
    ...computeStyles,
    fn: (args) =>
      inCssCoordinates(args.state, () =>
        computeStyles.fn({
          ...args,
          options: {
            ...args.options,
            adaptive: getZoom(args.state) === 1 ? args.options.adaptive : false,
          },
        }),
      ),
  },
]

function inCssCoordinates(state: State, fn: () => void) {
  const zoom = getZoom(state)
  if (zoom === 1) return fn()
  const rects = state.rects
  const offsets = state.modifiersData.popperOffsets
  if (!offsets) return fn()
  const scaleRect = (rect: State['rects']['popper']) => ({
    x: rect.x / zoom,
    y: rect.y / zoom,
    width: rect.width / zoom,
    height: rect.height / zoom,
  })
  state.rects = {
    reference: scaleRect(rects.reference),
    popper: scaleRect(rects.popper),
  }
  state.modifiersData.popperOffsets = {
    x: offsets.x / zoom,
    y: offsets.y / zoom,
  }
  try {
    fn()
  } finally {
    state.rects = rects
    state.modifiersData.popperOffsets = offsets
  }
}
