// @ts-nocheck
import type { IOptionProps } from './token'

export function useOption(props: IOptionProps, { emit }) {
  return {
    hoverItem: (event?: MouseEvent) => {
      if (!props.disabled && !event?.sourceCapabilities?.firesTouchEvents) {
        emit('hover', props.index)
      }
    },
    handlePointerDown: (event: PointerEvent) => {
      if (event.pointerType === 'touch') {
        emit('hover', -1)
      }
    },
    selectOptionClick: () => {
      if (!props.disabled) {
        emit('select', props.item, props.index)
      }
    },
  }
}
