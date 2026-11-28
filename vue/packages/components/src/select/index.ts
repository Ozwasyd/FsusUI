import {
  computed,
  defineComponent,
  h,
  inject,
  onBeforeUnmount,
  provide,
  ref,
  Teleport,
  type InjectionKey,
  type PropType,
} from 'vue'
import {
  formatLocaleText,
  FSUS_KEY,
  useClickOutside,
  useEscapeKeydown,
  useFloating,
  useFsusLocale,
  useFsusSize,
  useFsusZIndex,
  type FsusSize,
} from '@fsusui/core'
import { FsusIcon } from '@fsusui/icons'
import { FSUS_FORM_ITEM_KEY } from '../form/context'

export type FsusSelectPrimitive = string | number | boolean

export interface FsusSelectOption {
  value: FsusSelectPrimitive
  label: string
  disabled?: boolean
  group?: string
  created?: boolean
}

interface SelectSlotContext {
  registerOption: (opt: FsusSelectOption) => void
  isSelected: (val: FsusSelectPrimitive) => boolean
  selectOption: (opt: FsusSelectOption) => void
}

const SELECT_KEY: InjectionKey<SelectSlotContext> = Symbol('fsus-select')

export const FsusOption = defineComponent({
  name: 'FsusOption',
  props: {
    value: { type: [String, Number, Boolean] as PropType<FsusSelectPrimitive>, required: true },
    label: { type: String, default: undefined },
    disabled: { type: Boolean, default: false },
  },
  setup(props, { slots }) {
    const ctx = inject(SELECT_KEY, undefined)
    const opt = computed<FsusSelectOption>(() => ({
      value: props.value,
      label: props.label ?? String(props.value),
      disabled: props.disabled,
    }))
    ctx?.registerOption(opt.value)
    return () =>
      h(
        'button',
        {
          type: 'button',
          role: 'option',
          class: 'fsus-select__option',
          'aria-selected': ctx?.isSelected(props.value) ? 'true' : 'false',
          'data-selected': ctx?.isSelected(props.value) ? '' : undefined,
          disabled: props.disabled,
          onClick: () => !props.disabled && ctx?.selectOption(opt.value),
        },
        [
          h(
            'span',
            { class: 'fsus-select__option-label' },
            slots.default ? slots.default() : opt.value.label,
          ),
          ctx?.isSelected(props.value) ? h(FsusIcon, { name: 'check', size: 14 }) : null,
        ],
      )
  },
})

export const FsusOptionGroup = defineComponent({
  name: 'FsusOptionGroup',
  props: { label: { type: String, required: true } },
  setup(props, { slots }) {
    return () =>
      h('div', { class: 'fsus-select__group', role: 'group', 'aria-label': props.label }, [
        h('div', { class: 'fsus-select__group-label' }, props.label),
        slots.default?.(),
      ])
  },
})

/**
 * Unified FsusSelect — merges legacy Element Plus Select + SelectV2 into ONE
 * high-performance component with automatic list virtualization, allowCreate,
 * remote search with debounce + stale-request cancellation, and tag collapsing.
 */
export const FsusSelect = defineComponent({
  name: 'FsusSelect',
  inheritAttrs: false,
  props: {
    modelValue: {
      type: [String, Number, Boolean, Array] as PropType<
        FsusSelectPrimitive | FsusSelectPrimitive[] | null
      >,
      default: null,
    },
    options: { type: Array as PropType<FsusSelectOption[]>, default: () => [] },
    multiple: { type: Boolean, default: false },
    collapseTags: { type: Boolean, default: false },
    maxCollapseTags: { type: Number, default: 1 },
    filterable: { type: Boolean, default: false },
    allowCreate: { type: Boolean, default: false },
    remote: { type: Boolean, default: false },
    remoteMethod: {
      type: Function as PropType<(query: string) => void | Promise<void>>,
      default: undefined,
    },
    remoteDebounce: { type: Number, default: 200 },
    clearable: { type: Boolean, default: false },
    disabled: { type: Boolean, default: false },
    loading: { type: Boolean, default: false },
    placeholder: { type: String, default: undefined },
    size: { type: String as PropType<FsusSize>, default: undefined },
    virtualThreshold: { type: Number, default: 80 },
    itemHeight: { type: Number, default: 36 },
    maxDropdownHeight: { type: Number, default: 256 },
    teleported: { type: Boolean, default: true },
  },
  emits: ['update:modelValue', 'change', 'clear', 'visibleChange', 'create', 'removeTag'],
  setup(props, { attrs, emit, slots }) {
    const formItem = inject(FSUS_FORM_ITEM_KEY, undefined)
    const { t } = useFsusLocale()
    const resolvedSize = useFsusSize(
      computed(() => props.size),
      computed(() => formItem?.value.size),
    )
    const isDisabled = computed(() => props.disabled || Boolean(formItem?.value.disabled))

    const open = ref(false)
    const query = ref('')
    const activeIndex = ref(0)
    const scrollTop = ref(0)
    const slotOptions = ref<FsusSelectOption[]>([])
    const createdOptions = ref<FsusSelectOption[]>([])
    const internalLoading = ref(false)
    const triggerRef = ref<HTMLElement | null>(null)
    const dropdownRef = ref<HTMLElement | null>(null)
    const { currentZIndex, nextZIndex } = useFsusZIndex()

    let debounceTimer: ReturnType<typeof setTimeout> | null = null
    let remoteRequestSeq = 0

    onBeforeUnmount(() => {
      if (debounceTimer) clearTimeout(debounceTimer)
    })

    const isLoading = computed(() => props.loading || internalLoading.value)
    const showSearch = computed(() => props.filterable || props.allowCreate || props.remote)

    const allOptions = computed(() => {
      const base = props.options.length > 0 ? props.options : slotOptions.value
      if (createdOptions.value.length === 0) return base
      const seen = new Set(base.map((o) => o.value))
      return [...base, ...createdOptions.value.filter((o) => !seen.has(o.value))]
    })

    const filteredOptions = computed<FsusSelectOption[]>(() => {
      const rawQuery = query.value.trim()
      const q = rawQuery.toLowerCase()
      const matched =
        props.remote || !q
          ? allOptions.value
          : allOptions.value.filter((o) => o.label.toLowerCase().includes(q))

      if (props.allowCreate && rawQuery) {
        const hasExact = allOptions.value.some(
          (o) => o.label.toLowerCase() === q || String(o.value).toLowerCase() === q,
        )
        if (!hasExact) {
          return [{ value: rawQuery, label: rawQuery, created: true }, ...matched]
        }
      }
      return matched
    })

    const isVirtualized = computed(
      () =>
        (props.options.length > 0 || props.allowCreate) &&
        filteredOptions.value.length > props.virtualThreshold,
    )
    const visibleRange = computed(() => {
      if (!isVirtualized.value) return { start: 0, end: filteredOptions.value.length }
      const visibleCount = Math.ceil(props.maxDropdownHeight / props.itemHeight) + 4
      const start = Math.max(0, Math.floor(scrollTop.value / props.itemHeight) - 2)
      const end = Math.min(filteredOptions.value.length, start + visibleCount)
      return { start, end }
    })

    const selectedValues = computed<FsusSelectPrimitive[]>(() => {
      if (props.multiple) return Array.isArray(props.modelValue) ? props.modelValue : []
      return props.modelValue !== null && props.modelValue !== undefined
        ? [props.modelValue as FsusSelectPrimitive]
        : []
    })

    const isSelected = (val: FsusSelectPrimitive) => selectedValues.value.includes(val)

    const labelFor = (val: FsusSelectPrimitive) =>
      allOptions.value.find((o) => o.value === val)?.label ?? String(val)

    const triggerRemoteQuery = (val: string) => {
      if (!props.remote || !props.remoteMethod) return
      if (debounceTimer) clearTimeout(debounceTimer)

      const run = async () => {
        const seq = ++remoteRequestSeq
        internalLoading.value = true
        try {
          await props.remoteMethod!(val)
        } finally {
          if (seq === remoteRequestSeq) {
            internalLoading.value = false
          }
        }
      }

      if (props.remoteDebounce <= 0) {
        void run()
      } else {
        debounceTimer = setTimeout(() => {
          void run()
        }, props.remoteDebounce)
      }
    }

    const setOpen = (next: boolean) => {
      if (isDisabled.value && next) return
      if (open.value === next) return
      if (next) nextZIndex()
      open.value = next
      if (!next) {
        query.value = ''
        if (debounceTimer) clearTimeout(debounceTimer)
      }
      emit('visibleChange', next)
    }

    const selectOption = (opt: FsusSelectOption) => {
      if (opt.disabled) return
      if (opt.created) {
        const materialized: FsusSelectOption = { value: opt.value, label: opt.label }
        if (!createdOptions.value.some((o) => o.value === opt.value)) {
          createdOptions.value.push(materialized)
        }
        emit('create', opt.value)
        query.value = ''
      }
      if (props.multiple) {
        const removing = isSelected(opt.value)
        const next = removing
          ? selectedValues.value.filter((v) => v !== opt.value)
          : [...selectedValues.value, opt.value]
        emit('update:modelValue', next)
        emit('change', next)
        if (removing) emit('removeTag', opt.value)
      } else {
        emit('update:modelValue', opt.value)
        emit('change', opt.value)
        setOpen(false)
      }
      formItem?.value.notifyTrigger('change')
    }

    const clear = (event: MouseEvent) => {
      event.stopPropagation()
      const empty = props.multiple ? [] : null
      emit('update:modelValue', empty)
      emit('change', empty)
      emit('clear')
      formItem?.value.notifyTrigger('change')
    }

    const onKeydown = (event: KeyboardEvent) => {
      if (isDisabled.value) return
      if (event.key === FSUS_KEY.ARROW_DOWN) {
        event.preventDefault()
        if (!open.value) setOpen(true)
        else activeIndex.value = (activeIndex.value + 1) % Math.max(filteredOptions.value.length, 1)
      } else if (event.key === FSUS_KEY.ARROW_UP) {
        event.preventDefault()
        activeIndex.value =
          (activeIndex.value - 1 + Math.max(filteredOptions.value.length, 1)) %
          Math.max(filteredOptions.value.length, 1)
      } else if (event.key === FSUS_KEY.SPACE || event.key === ' ') {
        if (!open.value) {
          event.preventDefault()
          setOpen(true)
        }
      } else if (event.key === FSUS_KEY.ENTER) {
        event.preventDefault()
        if (!open.value) setOpen(true)
        else {
          const item = filteredOptions.value[activeIndex.value]
          if (item) selectOption(item)
        }
      } else if (event.key === FSUS_KEY.ESCAPE) {
        setOpen(false)
      }
    }

    const { floatingStyle } = useFloating(triggerRef, dropdownRef, {
      placement: 'bottom-start',
      offsetPx: 6,
      matchWidth: true,
      open,
    })

    useClickOutside(
      computed(() => [triggerRef.value, dropdownRef.value]),
      () => setOpen(false),
      open,
    )
    useEscapeKeydown(() => setOpen(false), open)

    provide(SELECT_KEY, {
      registerOption(opt) {
        if (!slotOptions.value.some((o) => o.value === opt.value)) {
          slotOptions.value.push(opt)
        }
      },
      isSelected,
      selectOption,
    })

    const renderOptionButton = (opt: FsusSelectOption, idx: number, style?: Record<string, string>) =>
      h(
        'button',
        {
          key: opt.created ? `__create__${String(opt.value)}` : String(opt.value),
          type: 'button',
          role: 'option',
          class: 'fsus-select__option',
          'aria-selected': isSelected(opt.value) ? 'true' : 'false',
          'data-selected': isSelected(opt.value) ? '' : undefined,
          'data-active': idx === activeIndex.value ? '' : undefined,
          'data-created': opt.created ? '' : undefined,
          disabled: opt.disabled,
          style,
          onClick: () => selectOption(opt),
        },
        [
          h(
            'span',
            { class: 'fsus-select__option-label' },
            opt.created ? formatLocaleText(t('select.create'), { value: opt.label }) : opt.label,
          ),
          isSelected(opt.value) ? h(FsusIcon, { name: 'check', size: 14 }) : null,
        ],
      )

    return () => {
      const hasValue = selectedValues.value.length > 0
      const useDataDrivenList = props.options.length > 0 || props.allowCreate || props.remote

      const renderedOptions = useDataDrivenList
        ? filteredOptions.value.length === 0
          ? [h('div', { class: 'fsus-select__empty' }, t('common.noMatch'))]
          : isVirtualized.value
            ? [
                h(
                  'div',
                  {
                    class: 'fsus-select__virtual-spacer',
                    style: {
                      height: `${filteredOptions.value.length * props.itemHeight}px`,
                      position: 'relative',
                    },
                  },
                  filteredOptions.value
                    .slice(visibleRange.value.start, visibleRange.value.end)
                    .map((opt, idx) => {
                      const realIdx = visibleRange.value.start + idx
                      return renderOptionButton(opt, realIdx, {
                        position: 'absolute',
                        top: `${realIdx * props.itemHeight}px`,
                        left: '0',
                        right: '0',
                        height: `${props.itemHeight}px`,
                      })
                    }),
                ),
              ]
            : filteredOptions.value.map((opt, idx) => renderOptionButton(opt, idx))
        : slots.default?.()

      const visibleChips =
        props.multiple && props.collapseTags
          ? selectedValues.value.slice(0, Math.max(1, props.maxCollapseTags))
          : selectedValues.value
      const hiddenChipCount =
        props.multiple && props.collapseTags
          ? Math.max(0, selectedValues.value.length - visibleChips.length)
          : 0

      const comboboxId = (attrs.id as string | undefined) ?? formItem?.value.id
      const hasExplicitAriaName = Boolean(attrs['aria-label'] || attrs['aria-labelledby'])
      const ariaLabelledBy =
        (attrs['aria-labelledby'] as string | undefined) ??
        (!hasExplicitAriaName && formItem?.value.hasLabel ? formItem.value.labelId : undefined)
      const ariaInvalid =
        attrs['aria-invalid'] !== undefined
          ? (attrs['aria-invalid'] as string | boolean)
          : formItem?.value.invalid
            ? 'true'
            : undefined
      const describedByParts: string[] = []
      const explicitDescribedBy = attrs['aria-describedby']
      if (typeof explicitDescribedBy === 'string' && explicitDescribedBy.trim()) {
        describedByParts.push(...explicitDescribedBy.trim().split(/\s+/u))
      }
      if (
        formItem?.value.invalid &&
        formItem.value.errorId &&
        !describedByParts.includes(formItem.value.errorId)
      ) {
        describedByParts.push(formItem.value.errorId)
      }
      const ariaDescribedBy = describedByParts.length > 0 ? describedByParts.join(' ') : undefined

      return [
        h(
          'div',
          {
            ...attrs,
            id: comboboxId,
            ref: triggerRef,
            class: ['fsus-select', attrs.class],
            role: 'combobox',
            tabindex: isDisabled.value ? -1 : 0,
            'aria-expanded': open.value ? 'true' : 'false',
            'aria-disabled': isDisabled.value ? 'true' : undefined,
            'aria-labelledby': ariaLabelledBy,
            'aria-invalid': ariaInvalid,
            'aria-describedby': ariaDescribedBy,
            'data-size': resolvedSize.value,
            'data-open': open.value ? '' : undefined,
            'data-disabled': isDisabled.value ? '' : undefined,
            'data-invalid': formItem?.value.invalid ? '' : undefined,
            onClick: () => setOpen(!open.value),
            onKeydown,
          },
          [
            h('div', { class: 'fsus-select__selection' }, [
              props.multiple && hasValue
                ? [
                    ...visibleChips.map((val) =>
                      h('span', { key: String(val), class: 'fsus-select__chip' }, [
                        h('span', labelFor(val)),
                        h(
                          'button',
                          {
                            type: 'button',
                            class: 'fsus-select__chip-close',
                            'aria-label': `Remove ${labelFor(val)}`,
                            onClick: (e: MouseEvent) => {
                              e.stopPropagation()
                              selectOption({ value: val, label: labelFor(val) })
                            },
                          },
                          [h(FsusIcon, { name: 'close', size: 10 })],
                        ),
                      ]),
                    ),
                    hiddenChipCount > 0
                      ? h('span', { class: 'fsus-select__chip fsus-select__chip--collapse' }, `+${hiddenChipCount}`)
                      : null,
                  ]
                : hasValue
                  ? h('span', { class: 'fsus-select__value' }, labelFor(selectedValues.value[0]!))
                  : h(
                      'span',
                      { class: 'fsus-select__placeholder' },
                      props.placeholder ?? t('common.selectPlaceholder'),
                    ),
            ]),
            h('span', { class: 'fsus-select__suffix' }, [
              props.clearable && hasValue && !isDisabled.value
                ? h(
                    'button',
                    {
                      type: 'button',
                      class: 'fsus-select__clear',
                      'aria-label': t('common.clear'),
                      onClick: clear,
                    },
                    [h(FsusIcon, { name: 'circle-close', size: 14 })],
                  )
                : null,
              h(FsusIcon, { name: open.value ? 'arrow-up' : 'arrow-down', size: 14 }),
            ]),
          ],
        ),
        open.value && !isDisabled.value
          ? h(Teleport as any, { to: 'body', disabled: !props.teleported }, [
              h(
                'div',
                {
                  ref: dropdownRef,
                  class: 'fsus-select__dropdown',
                  role: 'listbox',
                  'aria-multiselectable': props.multiple ? 'true' : undefined,
                  style: { ...floatingStyle.value, zIndex: currentZIndex.value },
                },
                [
                  showSearch.value
                    ? h('div', { class: 'fsus-select__search' }, [
                        h('input', {
                          type: 'search',
                          class: 'fsus-select__search-input',
                          value: query.value,
                          placeholder: t('common.search'),
                          onInput: (e: Event) => {
                            const val = (e.target as HTMLInputElement).value
                            query.value = val
                            activeIndex.value = 0
                            triggerRemoteQuery(val)
                          },
                          onKeydown,
                        }),
                      ])
                    : null,
                  isLoading.value
                    ? h('div', { class: 'fsus-select__empty' }, t('common.loading'))
                    : h(
                        'div',
                        {
                          class: 'fsus-select__list',
                          style: { maxHeight: `${props.maxDropdownHeight}px` },
                          onScroll: (e: Event) => {
                            scrollTop.value = (e.target as HTMLElement).scrollTop
                          },
                        },
                        renderedOptions,
                      ),
                ],
              ),
            ])
          : null,
      ]
    }
  },
})
