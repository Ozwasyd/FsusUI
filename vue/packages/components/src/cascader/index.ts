import {
  computed,
  defineComponent,
  h,
  reactive,
  ref,
  Teleport,
  type PropType,
} from 'vue'
import {
  useClickOutside,
  useEscapeKeydown,
  useFloating,
  useFsusLocale,
  useFsusZIndex,
  type FsusSize,
} from '@fsusui/core'
import { FsusIcon } from '@fsusui/icons'

export interface FsusCascaderOption {
  value: string | number
  label: string
  disabled?: boolean
  leaf?: boolean
  children?: FsusCascaderOption[]
}

export type FsusCascaderPath = Array<string | number>
export type FsusCascaderValue = FsusCascaderPath | FsusCascaderPath[]

const pathKey = (path: FsusCascaderPath) => path.map(String).join('\u0000')

const isMultiPaths = (val: FsusCascaderValue): val is FsusCascaderPath[] =>
  Array.isArray(val) && val.length > 0 && Array.isArray(val[0])

export const FsusCascaderPanel = defineComponent({
  name: 'FsusCascaderPanel',
  props: {
    modelValue: { type: Array as PropType<FsusCascaderValue>, default: () => [] },
    options: { type: Array as PropType<FsusCascaderOption[]>, default: () => [] },
    multiple: { type: Boolean, default: false },
    checkStrictly: { type: Boolean, default: false },
    lazy: { type: Boolean, default: false },
    lazyLoad: {
      type: Function as PropType<
        (node: FsusCascaderOption, level: number) => Promise<FsusCascaderOption[]> | FsusCascaderOption[]
      >,
      default: undefined,
    },
  },
  emits: ['update:modelValue', 'change'],
  setup(props, { emit }) {
    const initialPath: FsusCascaderPath = props.multiple
      ? []
      : isMultiPaths(props.modelValue)
        ? (props.modelValue[0] ?? [])
        : ([...props.modelValue] as FsusCascaderPath)

    const activePath = ref<FsusCascaderPath>(initialPath)
    const lazyChildren = reactive<Record<string, FsusCascaderOption[]>>({})
    const loadingKeys = ref<Set<string>>(new Set())

    const getChildren = (opt: FsusCascaderOption, fullPath: FsusCascaderPath): FsusCascaderOption[] => {
      const k = pathKey(fullPath)
      if (lazyChildren[k] !== undefined) return lazyChildren[k]!
      return opt.children ?? []
    }

    const isLeafOption = (opt: FsusCascaderOption, fullPath: FsusCascaderPath): boolean => {
      if (opt.leaf === true) return true
      const kids = getChildren(opt, fullPath)
      if (kids.length > 0) return false
      if (props.lazy && props.lazyLoad && lazyChildren[pathKey(fullPath)] === undefined) {
        return false
      }
      return true
    }

    const selectedMultiPaths = computed<FsusCascaderPath[]>(() => {
      if (!props.multiple) return []
      return (props.modelValue as FsusCascaderPath[]).filter(Array.isArray)
    })

    const selectedMultiSet = computed(() => new Set(selectedMultiPaths.value.map(pathKey)))

    const columns = computed<Array<{ options: FsusCascaderOption[]; parentPath: FsusCascaderPath }>>(() => {
      const cols: Array<{ options: FsusCascaderOption[]; parentPath: FsusCascaderPath }> = [
        { options: props.options, parentPath: [] },
      ]
      let current = props.options
      const walked: FsusCascaderPath = []
      for (const val of activePath.value) {
        const found = current.find((o) => o.value === val)
        if (!found) break
        walked.push(found.value)
        const kids = getChildren(found, walked)
        if (kids.length === 0) break
        cols.push({ options: kids, parentPath: [...walked] })
        current = kids
      }
      return cols
    })

    const toggleMultiPath = (fullPath: FsusCascaderPath) => {
      const k = pathKey(fullPath)
      const exists = selectedMultiSet.value.has(k)
      const next = exists
        ? selectedMultiPaths.value.filter((p) => pathKey(p) !== k)
        : [...selectedMultiPaths.value, fullPath]
      emit('update:modelValue', next)
      emit('change', next)
    }

    const expandOrSelect = async (level: number, option: FsusCascaderOption) => {
      if (option.disabled) return
      const nextPath = [...activePath.value.slice(0, level), option.value]
      activePath.value = nextPath
      const k = pathKey(nextPath)

      if (
        props.lazy &&
        props.lazyLoad &&
        !option.leaf &&
        lazyChildren[k] === undefined &&
        !option.children?.length
      ) {
        const loading = new Set(loadingKeys.value)
        loading.add(k)
        loadingKeys.value = loading
        try {
          const loaded = await props.lazyLoad(option, level)
          lazyChildren[k] = Array.isArray(loaded) ? loaded : []
        } finally {
          const done = new Set(loadingKeys.value)
          done.delete(k)
          loadingKeys.value = done
        }
      }

      const leaf = isLeafOption(option, nextPath)
      if (props.multiple) {
        if (leaf) toggleMultiPath(nextPath)
      } else if (leaf) {
        emit('update:modelValue', nextPath)
        emit('change', nextPath)
      }
    }

    return () =>
      h(
        'div',
        { class: 'fsus-cascader-panel' },
        columns.value.map((col, level) =>
          h(
            'div',
            { key: level, class: 'fsus-cascader-panel__col', role: 'listbox' },
            col.options.map((opt) => {
              const fullPath = [...col.parentPath, opt.value]
              const k = pathKey(fullPath)
              const leaf = isLeafOption(opt, fullPath)
              const isExpanded = activePath.value[level] === opt.value
              const isMultiChecked = props.multiple && selectedMultiSet.value.has(k)
              const isSingleChecked =
                !props.multiple &&
                !isMultiPaths(props.modelValue) &&
                pathKey(props.modelValue as FsusCascaderPath) === k
              const isLoading = loadingKeys.value.has(k)
              const canDirectlyCheck = !opt.disabled && (props.checkStrictly || leaf)

              return h(
                'div',
                {
                  key: String(opt.value),
                  role: 'option',
                  class: 'fsus-cascader-panel__item',
                  'aria-selected': isExpanded || isMultiChecked || isSingleChecked ? 'true' : 'false',
                  'data-selected': isExpanded || isMultiChecked || isSingleChecked ? '' : undefined,
                  'data-disabled': opt.disabled ? '' : undefined,
                  onClick: () => void expandOrSelect(level, opt),
                },
                [
                  props.multiple && canDirectlyCheck
                    ? h('input', {
                        type: 'checkbox',
                        class: 'fsus-cascader-panel__check',
                        checked: isMultiChecked,
                        disabled: opt.disabled,
                        'aria-label': opt.label,
                        onClick: (e: MouseEvent) => e.stopPropagation(),
                        onChange: () => toggleMultiPath(fullPath),
                      })
                    : !props.multiple && props.checkStrictly && !opt.disabled
                      ? h('input', {
                          type: 'radio',
                          class: 'fsus-cascader-panel__radio',
                          checked: isSingleChecked,
                          disabled: opt.disabled,
                          'aria-label': opt.label,
                          onClick: (e: MouseEvent) => e.stopPropagation(),
                          onChange: () => {
                            activePath.value = fullPath
                            emit('update:modelValue', fullPath)
                            emit('change', fullPath)
                          },
                        })
                      : null,
                  h('span', { class: 'fsus-cascader-panel__label' }, opt.label),
                  isLoading
                    ? h(FsusIcon, { name: 'loading', size: 12, spin: true })
                    : !leaf
                      ? h(FsusIcon, { name: 'arrow-right', size: 12 })
                      : null,
                ],
              )
            }),
          ),
        ),
      )
  },
})

export const FsusCascader = defineComponent({
  name: 'FsusCascader',
  props: {
    modelValue: { type: Array as PropType<FsusCascaderValue>, default: () => [] },
    options: { type: Array as PropType<FsusCascaderOption[]>, default: () => [] },
    placeholder: { type: String, default: undefined },
    separator: { type: String, default: ' / ' },
    clearable: { type: Boolean, default: false },
    disabled: { type: Boolean, default: false },
    multiple: { type: Boolean, default: false },
    collapseTags: { type: Boolean, default: false },
    maxCollapseTags: { type: Number, default: 1 },
    filterable: { type: Boolean, default: false },
    checkStrictly: { type: Boolean, default: false },
    lazy: { type: Boolean, default: false },
    lazyLoad: {
      type: Function as PropType<
        (node: FsusCascaderOption, level: number) => Promise<FsusCascaderOption[]> | FsusCascaderOption[]
      >,
      default: undefined,
    },
    size: { type: String as PropType<FsusSize>, default: 'md' },
    teleported: { type: Boolean, default: true },
  },
  emits: ['update:modelValue', 'change'],
  setup(props, { emit }) {
    const { t } = useFsusLocale()
    const open = ref(false)
    const query = ref('')
    const triggerRef = ref<HTMLElement | null>(null)
    const floatRef = ref<HTMLElement | null>(null)
    const { currentZIndex, nextZIndex } = useFsusZIndex()

    const formatPathLabel = (path: FsusCascaderPath): string => {
      const labels: string[] = []
      let current = props.options
      for (const val of path) {
        const found = current.find((o) => o.value === val)
        if (!found) {
          labels.push(String(val))
          current = []
        } else {
          labels.push(found.label)
          current = found.children ?? []
        }
      }
      return labels.join(props.separator)
    }

    const multiPaths = computed<FsusCascaderPath[]>(() =>
      props.multiple ? (props.modelValue as FsusCascaderPath[]).filter(Array.isArray) : [],
    )

    const displayLabel = computed(() =>
      props.multiple ? '' : formatPathLabel(props.modelValue as FsusCascaderPath),
    )

    // Flatten all selectable paths for filterable search
    const flatSuggestions = computed(() => {
      const q = query.value.trim().toLowerCase()
      if (!props.filterable || !q) return []
      const out: Array<{ path: FsusCascaderPath; label: string; disabled: boolean }> = []
      const walk = (
        opts: FsusCascaderOption[],
        pPath: FsusCascaderPath,
        pLabels: string[],
        parentDisabled: boolean,
      ) => {
        for (const opt of opts) {
          const nextPath = [...pPath, opt.value]
          const nextLabels = [...pLabels, opt.label]
          const isDis = parentDisabled || Boolean(opt.disabled)
          const hasKids = Boolean(opt.children?.length)
          if (props.checkStrictly || !hasKids) {
            const fullLabel = nextLabels.join(props.separator)
            if (fullLabel.toLowerCase().includes(q)) {
              out.push({ path: nextPath, label: fullLabel, disabled: isDis })
            }
          }
          if (hasKids) walk(opt.children!, nextPath, nextLabels, isDis)
        }
      }
      walk(props.options, [], [], false)
      return out
    })

    const selectSuggestion = (path: FsusCascaderPath) => {
      if (props.multiple) {
        const k = pathKey(path)
        const exists = multiPaths.value.some((p) => pathKey(p) === k)
        const next = exists
          ? multiPaths.value.filter((p) => pathKey(p) !== k)
          : [...multiPaths.value, path]
        emit('update:modelValue', next)
        emit('change', next)
      } else {
        emit('update:modelValue', path)
        emit('change', path)
        open.value = false
      }
      query.value = ''
    }

    const removeMultiPath = (path: FsusCascaderPath, e: MouseEvent) => {
      e.stopPropagation()
      const k = pathKey(path)
      const next = multiPaths.value.filter((p) => pathKey(p) !== k)
      emit('update:modelValue', next)
      emit('change', next)
    }

    const { floatingStyle } = useFloating(triggerRef, floatRef, {
      placement: 'bottom-start',
      offsetPx: 6,
      open,
    })

    useClickOutside(
      computed(() => [triggerRef.value, floatRef.value]),
      () => {
        open.value = false
        query.value = ''
      },
      open,
    )
    useEscapeKeydown(() => {
      open.value = false
      query.value = ''
    }, open)

    return () => {
      const hasValue = props.multiple
        ? multiPaths.value.length > 0
        : (props.modelValue as FsusCascaderPath).length > 0
      const visibleTags =
        props.multiple && props.collapseTags
          ? multiPaths.value.slice(0, Math.max(1, props.maxCollapseTags))
          : multiPaths.value
      const hiddenTagCount =
        props.multiple && props.collapseTags
          ? Math.max(0, multiPaths.value.length - visibleTags.length)
          : 0

      return [
        h(
          'div',
          {
            ref: triggerRef,
            class: 'fsus-select fsus-cascader',
            role: 'combobox',
            tabindex: props.disabled ? -1 : 0,
            'aria-expanded': open.value ? 'true' : 'false',
            'data-size': props.size,
            'data-disabled': props.disabled ? '' : undefined,
            onClick: () => {
              if (props.disabled) return
              if (!open.value) nextZIndex()
              open.value = !open.value
            },
          },
          [
            h('div', { class: 'fsus-select__selection' }, [
              props.multiple && hasValue
                ? [
                    ...visibleTags.map((p) =>
                      h('span', { key: pathKey(p), class: 'fsus-select__chip' }, [
                        h('span', formatPathLabel(p)),
                        h(
                          'button',
                          {
                            type: 'button',
                            class: 'fsus-select__chip-close',
                            'aria-label': `Remove ${formatPathLabel(p)}`,
                            onClick: (e: MouseEvent) => removeMultiPath(p, e),
                          },
                          [h(FsusIcon, { name: 'close', size: 10 })],
                        ),
                      ]),
                    ),
                    hiddenTagCount > 0
                      ? h('span', { class: 'fsus-select__chip fsus-select__chip--collapse' }, `+${hiddenTagCount}`)
                      : null,
                  ]
                : displayLabel.value
                  ? h('span', { class: 'fsus-select__value' }, displayLabel.value)
                  : h(
                      'span',
                      { class: 'fsus-select__placeholder' },
                      props.placeholder ?? t('common.selectPlaceholder'),
                    ),
            ]),
            h('span', { class: 'fsus-select__suffix' }, [
              props.clearable && hasValue && !props.disabled
                ? h(
                    'button',
                    {
                      type: 'button',
                      class: 'fsus-select__clear',
                      'aria-label': t('common.clear'),
                      onClick: (e: MouseEvent) => {
                        e.stopPropagation()
                        emit('update:modelValue', [])
                        emit('change', [])
                      },
                    },
                    [h(FsusIcon, { name: 'circle-close', size: 14 })],
                  )
                : null,
              h(FsusIcon, { name: open.value ? 'arrow-up' : 'arrow-down', size: 14 }),
            ]),
          ],
        ),
        open.value && !props.disabled
          ? h(Teleport as any, { to: 'body', disabled: !props.teleported }, [
              h(
                'div',
                {
                  ref: floatRef,
                  class: 'fsus-select__dropdown fsus-cascader__dropdown',
                  style: { ...floatingStyle.value, zIndex: currentZIndex.value },
                },
                [
                  props.filterable
                    ? h('div', { class: 'fsus-select__search' }, [
                        h('input', {
                          type: 'search',
                          class: 'fsus-select__search-input',
                          value: query.value,
                          placeholder: t('common.search'),
                          onInput: (e: Event) => {
                            query.value = (e.target as HTMLInputElement).value
                          },
                        }),
                      ])
                    : null,
                  props.filterable && query.value.trim()
                    ? h(
                        'div',
                        { class: 'fsus-cascader__suggestions', role: 'listbox' },
                        flatSuggestions.value.length === 0
                          ? [h('div', { class: 'fsus-select__empty' }, t('common.noMatch'))]
                          : flatSuggestions.value.map((s) => {
                              const k = pathKey(s.path)
                              const selected = props.multiple
                                ? multiPaths.value.some((p) => pathKey(p) === k)
                                : pathKey(props.modelValue as FsusCascaderPath) === k
                              return h(
                                'button',
                                {
                                  key: k,
                                  type: 'button',
                                  role: 'option',
                                  class: 'fsus-select__option',
                                  disabled: s.disabled,
                                  'aria-selected': selected ? 'true' : 'false',
                                  'data-selected': selected ? '' : undefined,
                                  onClick: () => !s.disabled && selectSuggestion(s.path),
                                },
                                [
                                  h('span', { class: 'fsus-select__option-label' }, s.label),
                                  selected ? h(FsusIcon, { name: 'check', size: 14 }) : null,
                                ],
                              )
                            }),
                      )
                    : h(FsusCascaderPanel, {
                        modelValue: props.modelValue,
                        options: props.options,
                        multiple: props.multiple,
                        checkStrictly: props.checkStrictly,
                        lazy: props.lazy,
                        lazyLoad: props.lazyLoad,
                        'onUpdate:modelValue': (val: FsusCascaderValue) => {
                          emit('update:modelValue', val)
                          emit('change', val)
                          if (!props.multiple && !props.checkStrictly) open.value = false
                        },
                      }),
                ],
              ),
            ])
          : null,
      ]
    }
  },
})
