import {
  computed,
  defineComponent,
  h,
  inject,
  provide,
  ref,
  Teleport,
  type InjectionKey,
  type PropType,
} from 'vue'
import {
  useClickOutside,
  useDelayedToggle,
  useEscapeKeydown,
  useFloating,
  useFsusZIndex,
  useRovingFocus,
  type FsusPlacement,
} from '@fsusui/core'

interface DropdownContext {
  onSelect: (command: string | number | undefined) => void
}

const DROPDOWN_KEY: InjectionKey<DropdownContext> = Symbol('fsus-dropdown')

export const FsusDropdownMenu = defineComponent({
  name: 'FsusDropdownMenu',
  setup(_, { slots }) {
    const listRef = ref<HTMLElement | null>(null)
    const { onKeydown } = useRovingFocus(listRef, '[role="menuitem"]', 'vertical')
    return () =>
      h(
        'div',
        { ref: listRef, class: 'fsus-dropdown-menu', role: 'menu', onKeydown },
        slots.default?.(),
      )
  },
})

export const FsusDropdownItem = defineComponent({
  name: 'FsusDropdownItem',
  props: {
    command: { type: [String, Number] as PropType<string | number>, default: undefined },
    disabled: { type: Boolean, default: false },
    divided: { type: Boolean, default: false },
    danger: { type: Boolean, default: false },
  },
  emits: ['click'],
  setup(props, { emit, slots }) {
    const ctx = inject(DROPDOWN_KEY, undefined)
    const onClick = (event: MouseEvent) => {
      if (props.disabled) return
      emit('click', event)
      ctx?.onSelect(props.command)
    }
    return () =>
      h(
        'button',
        {
          type: 'button',
          role: 'menuitem',
          class: 'fsus-dropdown-item',
          disabled: props.disabled,
          'data-divided': props.divided ? '' : undefined,
          'data-danger': props.danger ? '' : undefined,
          onClick,
        },
        slots.default?.(),
      )
  },
})

export const FsusDropdown = defineComponent({
  name: 'FsusDropdown',
  props: {
    trigger: { type: String as PropType<'click' | 'hover'>, default: 'click' },
    placement: { type: String as PropType<FsusPlacement>, default: 'bottom-start' },
    disabled: { type: Boolean, default: false },
    hideOnClick: { type: Boolean, default: true },
    teleported: { type: Boolean, default: true },
  },
  emits: ['command', 'visibleChange'],
  setup(props, { emit, slots, expose }) {
    const open = ref(false)
    const refEl = ref<HTMLElement | null>(null)
    const floatEl = ref<HTMLElement | null>(null)
    const { currentZIndex, nextZIndex } = useFsusZIndex()

    const setOpen = (next: boolean) => {
      if (props.disabled && next) return
      if (open.value === next) return
      if (next) nextZIndex()
      open.value = next
      emit('visibleChange', next)
    }

    const { onOpen, onClose } = useDelayedToggle({
      open: () => setOpen(true),
      close: () => setOpen(false),
      showAfter: 80,
      hideAfter: 120,
    })

    const { floatingStyle } = useFloating(refEl, floatEl, {
      placement: computed(() => props.placement),
      offsetPx: 6,
      open,
    })

    useClickOutside(
      computed(() => [refEl.value, floatEl.value]),
      () => setOpen(false),
      open,
    )
    useEscapeKeydown(() => setOpen(false), open)

    provide(DROPDOWN_KEY, {
      onSelect(command) {
        emit('command', command)
        if (props.hideOnClick) setOpen(false)
      },
    })

    expose({ open, setOpen })

    return () => [
      h(
        'span',
        {
          ref: refEl,
          class: 'fsus-dropdown__trigger',
          'aria-haspopup': 'menu',
          'aria-expanded': open.value ? 'true' : 'false',
          onClick: () => props.trigger === 'click' && setOpen(!open.value),
          onMouseenter: () => props.trigger === 'hover' && onOpen(),
          onMouseleave: () => props.trigger === 'hover' && onClose(),
        },
        slots.default?.(),
      ),
      h(
        Teleport as any,
        { to: 'body', disabled: !props.teleported },
        open.value && !props.disabled
          ? h(
              'div',
              {
                ref: floatEl,
                class: 'fsus-dropdown__popper',
                style: { ...floatingStyle.value, zIndex: currentZIndex.value },
                onMouseenter: () => props.trigger === 'hover' && onOpen(),
                onMouseleave: () => props.trigger === 'hover' && onClose(),
              },
              slots.dropdown?.(),
            )
          : undefined,
      ),
    ]
  },
})
