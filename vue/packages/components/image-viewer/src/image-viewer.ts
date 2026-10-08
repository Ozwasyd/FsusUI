import {
  buildProps,
  definePropType,
  isNumber,
  mutable,
} from '@element-plus/utils'

import type { Component, ExtractPropTypes } from 'vue'
import type ImageViewer from './image-viewer.vue'

export type ImageViewerAction =
  | 'zoomIn'
  | 'zoomOut'
  | 'clockwise'
  | 'anticlockwise'

export interface ImageViewerLabels {
  close: string
  previous: string
  next: string
  zoomOut: string
  zoomIn: string
  toggleMode: string
  rotateLeft: string
  rotateRight: string
}

export const imageViewerProps = buildProps({
  /** @description Whether the modal is visible; defaults to mounted visibility. */
  visible: { type: Boolean, default: true },
  /** @description Accessible modal name. */
  ariaLabel: { type: String, default: '' },
  /** @description Alternative text aligned with url-list. */
  altList: { type: definePropType<string[]>(Array), default: () => [] },
  /** @description Localized accessible names for the viewer controls. */
  labels: {
    type: definePropType<Partial<ImageViewerLabels>>(Object),
    default: () => ({}),
  },
  /** @description Reactive image index; initial-index remains initialization only. */
  activeIndex: Number,
  /** @description Enable zoom, rotation and image dragging controls. */
  showToolbar: { type: Boolean, default: true },
  /** @description Teleport target. Use a dedicated host for SSR hydration. */
  appendTo: { type: String, default: 'body' },
  /** @description Omit style attributes from SSR; apply dynamic styles via CSSOM after mount. */
  cspSafe: Boolean,
  /**
   * @description preview link list.
   */
  urlList: {
    type: definePropType<string[]>(Array),
    default: () => mutable([] as const),
  },
  /**
   * @description preview backdrop z-index.
   */
  zIndex: {
    type: Number,
  },
  /**
   * @description the initial preview image index, less than or equal to the length of `url-list`.
   */
  initialIndex: {
    type: Number,
    default: 0,
  },
  /**
   * @description whether preview is infinite.
   */
  infinite: {
    type: Boolean,
    default: true,
  },
  /**
   * @description whether user can emit close event when clicking backdrop.
   */
  hideOnClickModal: Boolean,
  /**
   * @description whether to append image itself to body. A nested parent element attribute transform should have this attribute set to `true`.
   */
  teleported: Boolean,
  /**
   * @description whether the image-viewer can be closed by pressing ESC.
   */
  closeOnPressEscape: {
    type: Boolean,
    default: true,
  },
  /**
   * @description the zoom rate of the image viewer zoom event.
   */
  zoomRate: {
    type: Number,
    default: 1.2,
  },
  /**
   * @description the min scale of the image viewer zoom event.
   */
  minScale: {
    type: Number,
    default: 0.2,
  },
  /**
   * @description the max scale of the image viewer zoom event.
   */
  maxScale: {
    type: Number,
    default: 7,
  },
} as const)
export type ImageViewerProps = ExtractPropTypes<typeof imageViewerProps>

export const imageViewerEmits = {
  'update:visible': (visible: boolean) => typeof visible === 'boolean',
  'update:activeIndex': (index: number) => isNumber(index),
  previous: (index: number) => isNumber(index),
  next: (index: number) => isNumber(index),
  close: () => true,
  switch: (index: number) => isNumber(index),
  rotate: (deg: number) => isNumber(deg),
}
export type ImageViewerEmits = typeof imageViewerEmits

export interface ImageViewerMode {
  name: string
  icon: Component
}

export type ImageViewerInstance = InstanceType<typeof ImageViewer>
