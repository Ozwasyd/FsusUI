import type { InjectionKey } from 'vue'

export interface ScrollbarContext {
  scrollbarElement: HTMLDivElement | undefined
  wrapElement: HTMLDivElement | undefined
  startThumbDrag: () => void
  moveThumbDrag: (axis: 'X' | 'Y', scrollOffset: number) => void
  endThumbDrag: () => void
}

export const scrollbarContextKey: InjectionKey<ScrollbarContext> = Symbol(
  'scrollbarContextKey',
)
