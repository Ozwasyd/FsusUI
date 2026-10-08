import {
  computed,
  defineComponent,
  inject,
  ref,
  toRaw,
  unref,
  watch,
} from 'vue'
import { get } from 'lodash-unified'
import { definePropType, isObject, isUndefined } from '@element-plus/utils'
import {
  DynamicSizeList,
  FixedSizeList,
} from '@element-plus/components/virtual-list'
import { useNamespace } from '@element-plus/hooks'
import { EVENT_CODE } from '@element-plus/constants'
import GroupItem from './group-item.vue'
import OptionItem from './option-item.vue'
import { useProps } from './useProps'

import { selectV2InjectionKey } from './token'

import type {
  ItemProps,
  ListExposes,
} from '@element-plus/components/virtual-list'
import type { Option, OptionItemProps } from './select.types'

type SelectListInstance = ListExposes & {
  resetAfterIndex?: (index: number, forceUpdate?: boolean) => void
  resetScrollTop?: () => void
}

export default defineComponent({
  name: 'ElSelectDropdown',

  props: {
    id: String,
    data: {
      type: definePropType<Option[]>(Array),
      required: true,
    },
    hoveringIndex: Number,
    width: Number,
  },
  setup(props, { slots, expose }) {
    const select = inject(selectV2InjectionKey)!
    const ns = useNamespace('select')
    const { getLabel, getValue, getDisabled } = useProps(select.props)

    const cachedHeights = ref<Array<number>>([])

    const listRef = ref<SelectListInstance | null>(null)
    const renderedOptions = ref(new Set<number>())
    const optionPositions = computed(() => {
      let total = 0
      const positions = props.data.map((item: Option) =>
        item.type === 'Group' ? 0 : ++total,
      )
      return { positions, total }
    })
    const activeOptionId = computed(() => {
      const index = props.hoveringIndex ?? -1
      const item = props.data[index] as Option | undefined
      return item && item.type !== 'Group' && renderedOptions.value.has(index)
        ? `${props.id}-${index}`
        : undefined
    })
    const onOptionRendered = (index: number, rendered: boolean) => {
      if (rendered) renderedOptions.value.add(index)
      else renderedOptions.value.delete(index)
    }

    const size = computed(() => props.data.length)
    const estimatedOptionHeight = computed(
      () => select.props.estimatedOptionHeight ?? select.props.itemHeight,
    )
    watch(
      () => size.value,
      () => {
        select.popper.value?.updatePopper?.()
      },
    )

    const isSized = computed(() =>
      isUndefined(select.props.estimatedOptionHeight),
    )
    const getDefaultItemHeight = () => estimatedOptionHeight.value

    const resetAfterIndex = (index = 0) => {
      listRef.value?.resetAfterIndex?.(index)
    }

    const syncCachedHeights = () => {
      if (isSized.value) {
        cachedHeights.value = []
        return
      }

      cachedHeights.value = props.data.map((_, index) => {
        return cachedHeights.value[index] ?? getDefaultItemHeight()
      })
      resetAfterIndex(0)
      select.popper.value?.updatePopper?.()
    }

    const updateItemHeight = (index: number, height: number) => {
      if (isSized.value || !Number.isFinite(height) || height <= 0) {
        return
      }

      const nextHeight = Math.max(1, Math.ceil(height))
      if (cachedHeights.value[index] === nextHeight) {
        return
      }

      cachedHeights.value[index] = nextHeight
      resetAfterIndex(index)
      select.popper.value?.updatePopper?.()
    }

    watch(
      [() => props.data, () => props.width, estimatedOptionHeight],
      () => {
        syncCachedHeights()
      },
      { immediate: true },
    )

    const listProps = computed(() => {
      if (isSized.value) {
        return {
          itemSize: select.props.itemHeight,
        }
      }

      return {
        estimatedItemSize: estimatedOptionHeight.value,
        itemSize: (idx: number) =>
          cachedHeights.value[idx] ?? getDefaultItemHeight(),
      }
    })

    const contains = (arr: Array<any> = [], target: any) => {
      const {
        props: { valueKey },
      } = select

      if (!isObject(target)) {
        return arr.includes(target)
      }

      return (
        arr &&
        arr.some((item) => {
          return toRaw(get(item, valueKey)) === get(target, valueKey)
        })
      )
    }
    const isEqual = (selected: unknown, target: unknown) => {
      if (!isObject(target)) {
        return selected === target
      } else {
        const { valueKey } = select.props
        return get(selected, valueKey) === get(target, valueKey)
      }
    }

    const isItemSelected = (modelValue: any[] | any, target: Option) => {
      if (select.props.multiple) {
        return contains(modelValue, getValue(target))
      }
      return isEqual(modelValue, getValue(target))
    }

    const isItemDisabled = (modelValue: any[] | any, selected: boolean) => {
      const { disabled, multiple, multipleLimit } = select.props
      return (
        disabled ||
        (!selected &&
          (multiple
            ? multipleLimit > 0 && modelValue.length >= multipleLimit
            : false))
      )
    }

    const isItemHovering = (target: number) => props.hoveringIndex === target

    const scrollToItem = (index: number) => {
      const list = listRef.value
      if (list) {
        list.scrollToItem(index)
      }
    }

    const resetScrollTop = () => {
      const list = listRef.value
      if (list) {
        list.resetScrollTop()
      }
    }

    expose({
      activeOptionId,
      listRef,
      isSized,

      isItemDisabled,
      isItemHovering,
      isItemSelected,
      scrollToItem,
      resetScrollTop,
      resetAfterIndex,
    })

    const Item = (itemProps: ItemProps<any>) => {
      const { index, data, style } = itemProps
      const sized = unref(isSized)
      const { itemSize, estimatedItemSize } = unref(listProps)
      const { modelValue } = select.props
      const { onSelect, onHover } = select
      const item = data[index]
      if (item.type === 'Group') {
        return (
          <GroupItem
            item={item}
            style={style}
            height={(sized ? itemSize : estimatedItemSize) as number}
            onResize={(height: number) => updateItemHeight(index, height)}
          />
        )
      }

      const isSelected = isItemSelected(modelValue, item)
      const isDisabled = isItemDisabled(modelValue, isSelected)
      const isHovering = isItemHovering(index)
      return (
        <OptionItem
          {...itemProps}
          id={`${props.id}-${index}`}
          position={optionPositions.value.positions[index]}
          total={optionPositions.value.total}
          selected={isSelected}
          disabled={getDisabled(item) || isDisabled}
          created={!!item.created}
          hovering={isHovering}
          item={item}
          onSelect={onSelect}
          onHover={onHover}
          onResize={(height: number) => updateItemHeight(index, height)}
          onRendered={onOptionRendered}
        >
          {{
            default: (props: OptionItemProps) =>
              slots.default?.(props) || <span>{getLabel(item)}</span>,
          }}
        </OptionItem>
      )
    }

    // computed
    const { onKeyboardNavigate, onKeyboardSelect } = select

    const onForward = () => {
      onKeyboardNavigate('forward')
    }

    const onBackward = () => {
      onKeyboardNavigate('backward')
    }

    const onEscOrTab = () => {
      select.expanded.value = false
    }

    const onKeydown = (e: KeyboardEvent) => {
      const { code } = e
      const { tab, esc, down, up, enter } = EVENT_CODE
      if (code !== tab) {
        e.preventDefault()
        e.stopPropagation()
      }

      switch (code) {
        case tab:
        case esc: {
          onEscOrTab()
          break
        }
        case down: {
          onForward()
          break
        }
        case up: {
          onBackward()
          break
        }
        case enter: {
          onKeyboardSelect()
          break
        }
      }
    }

    return () => {
      const { data, width } = props
      const { height, multiple, scrollbarAlwaysOn } = select.props

      if (data.length === 0) {
        return (
          <div
            id={props.id}
            role="listbox"
            aria-labelledby={select.props.label}
            aria-multiselectable={multiple}
            class={ns.b('dropdown')}
            style={{
              width: `${width}px`,
            }}
          >
            {slots.empty?.()}
          </div>
        )
      }

      const List = unref(isSized) ? FixedSizeList : DynamicSizeList

      return (
        <div
          id={props.id}
          role="listbox"
          aria-labelledby={select.props.label}
          aria-multiselectable={multiple}
          class={[ns.b('dropdown'), ns.is('multiple', multiple)]}
        >
          <List
            ref={listRef}
            {...unref(listProps)}
            className={ns.be('dropdown', 'list')}
            scrollbarAlwaysOn={scrollbarAlwaysOn}
            data={data}
            height={height}
            width={width}
            total={data.length}
            // @ts-ignore - dts problem
            onKeydown={onKeydown}
          >
            {{
              default: (props: ItemProps<any>) => <Item {...props} />,
            }}
          </List>
        </div>
      )
    }
  },
})
