import {
  computed,
  defineComponent,
  h,
  reactive,
  ref,
  type PropType,
} from 'vue'
import { addUnit, FSUS_KEY, useFsusLocale } from '@fsusui/core'
import { FsusIcon } from '@fsusui/icons'
import FsusPopover from '../popover/FsusPopover.vue'

export interface FsusTreeNode {
  id: string | number
  label: string
  disabled?: boolean
  isLeaf?: boolean
  children?: FsusTreeNode[]
  [key: string]: unknown
}

export type FsusTreeDropType = 'before' | 'inside' | 'after'

export interface FsusTreeDropPayload {
  draggingNode: FsusTreeNode
  dropNode: FsusTreeNode
  dropType: FsusTreeDropType
}

interface FlatTreeRow {
  node: FsusTreeNode
  parentId: string | number | null
  depth: number
  hasChildren: boolean
  isLazyPending: boolean
  expanded: boolean
}

/**
 * Unified FsusTree — merges legacy Element Plus Tree + TreeV2 into ONE flat-indexed
 * tree engine with automatic window virtualization, tri-state checkboxes, lazy loading,
 * accordion mode, drag-and-drop reordering, and WAI-ARIA keyboard navigation.
 */
export const FsusTree = defineComponent({
  name: 'FsusTree',
  props: {
    data: { type: Array as PropType<FsusTreeNode[]>, default: () => [] },
    expandedKeys: { type: Array as PropType<Array<string | number>>, default: undefined },
    checkedKeys: { type: Array as PropType<Array<string | number>>, default: () => [] },
    selectedKey: { type: [String, Number] as PropType<string | number | null>, default: null },
    checkable: { type: Boolean, default: false },
    checkStrictly: { type: Boolean, default: false },
    accordion: { type: Boolean, default: false },
    lazy: { type: Boolean, default: false },
    load: {
      type: Function as PropType<(node: FsusTreeNode) => Promise<FsusTreeNode[]> | FsusTreeNode[]>,
      default: undefined,
    },
    draggable: { type: Boolean, default: false },
    allowDrag: {
      type: Function as PropType<(node: FsusTreeNode) => boolean>,
      default: undefined,
    },
    allowDrop: {
      type: Function as PropType<
        (dragging: FsusTreeNode, target: FsusTreeNode, type: FsusTreeDropType) => boolean
      >,
      default: undefined,
    },
    defaultExpandAll: { type: Boolean, default: false },
    filterText: { type: String, default: '' },
    height: { type: [Number, String], default: undefined },
    itemHeight: { type: Number, default: 36 },
    virtualThreshold: { type: Number, default: 120 },
  },
  emits: [
    'update:expandedKeys',
    'update:checkedKeys',
    'update:selectedKey',
    'update:data',
    'nodeClick',
    'nodeExpand',
    'nodeCollapse',
    'check',
    'nodeDrop',
  ],
  setup(props, { emit, slots }) {
    const { t } = useFsusLocale()

    // Lazy-loaded children cache & loading states
    const loadedChildren = reactive<Record<string, FsusTreeNode[]>>({})
    const loadedIds = ref<Set<string | number>>(new Set())
    const loadingIds = ref<Set<string | number>>(new Set())

    const getNodeChildren = (node: FsusTreeNode): FsusTreeNode[] => {
      const key = String(node.id)
      if (loadedChildren[key] !== undefined) return loadedChildren[key]!
      return node.children ?? []
    }

    const collectAllIds = (nodes: FsusTreeNode[], out = new Set<string | number>()) => {
      for (const n of nodes) {
        const kids = getNodeChildren(n)
        if (kids.length > 0) {
          out.add(n.id)
          collectAllIds(kids, out)
        }
      }
      return out
    }

    const internalExpanded = ref<Set<string | number>>(
      props.defaultExpandAll ? collectAllIds(props.data) : new Set(props.expandedKeys ?? []),
    )
    const scrollTop = ref(0)
    const focusedKey = ref<string | number | null>(props.selectedKey)

    // Drag & Drop state
    const draggingId = ref<string | number | null>(null)
    const dropTargetId = ref<string | number | null>(null)
    const dropType = ref<FsusTreeDropType | null>(null)

    const expandedSet = computed(() =>
      props.expandedKeys ? new Set(props.expandedKeys) : internalExpanded.value,
    )
    const checkedSet = computed(() => new Set(props.checkedKeys))

    // Index parent & node lookup maps
    const treeIndex = computed(() => {
      const nodeMap = new Map<string | number, FsusTreeNode>()
      const parentMap = new Map<string | number, string | number | null>()
      const siblingsMap = new Map<string | number | null, FsusTreeNode[]>()
      const walk = (nodes: FsusTreeNode[], parentId: string | number | null) => {
        siblingsMap.set(parentId, nodes)
        for (const n of nodes) {
          nodeMap.set(n.id, n)
          parentMap.set(n.id, parentId)
          const kids = getNodeChildren(n)
          if (kids.length > 0) walk(kids, n.id)
        }
      }
      walk(props.data, null)
      return { nodeMap, parentMap, siblingsMap }
    })

    // Compute tri-state checked & indeterminate sets when !checkStrictly
    const checkStates = computed(() => {
      const checked = new Set<string | number>(checkedSet.value)
      const indeterminate = new Set<string | number>()
      if (!props.checkable || props.checkStrictly) {
        return { checked, indeterminate }
      }

      const evaluate = (node: FsusTreeNode): 'checked' | 'indeterminate' | 'unchecked' => {
        const kids = getNodeChildren(node)
        const activeKids = kids.filter((k) => !k.disabled)
        if (activeKids.length === 0) {
          return checked.has(node.id) ? 'checked' : 'unchecked'
        }
        let checkedCount = 0
        let hasIndeterminate = false
        for (const k of activeKids) {
          const st = evaluate(k)
          if (st === 'checked') checkedCount++
          else if (st === 'indeterminate') hasIndeterminate = true
        }
        if (checkedCount === activeKids.length) {
          checked.add(node.id)
          indeterminate.delete(node.id)
          return 'checked'
        }
        if (checkedCount > 0 || hasIndeterminate) {
          checked.delete(node.id)
          indeterminate.add(node.id)
          return 'indeterminate'
        }
        checked.delete(node.id)
        indeterminate.delete(node.id)
        return 'unchecked'
      }

      for (const root of props.data) evaluate(root)
      return { checked, indeterminate }
    })

    const filterMatches = (node: FsusTreeNode, q: string): boolean => {
      if (!q) return true
      if (node.label.toLowerCase().includes(q)) return true
      return getNodeChildren(node).some((c) => filterMatches(c, q))
    }

    const flatRows = computed<FlatTreeRow[]>(() => {
      const q = props.filterText.trim().toLowerCase()
      const rows: FlatTreeRow[] = []
      const walk = (nodes: FsusTreeNode[], depth: number, parentId: string | number | null) => {
        for (const node of nodes) {
          if (q && !filterMatches(node, q)) continue
          const kids = getNodeChildren(node)
          const isLazyPending = Boolean(
            props.lazy && props.load && !node.isLeaf && !loadedIds.value.has(node.id) && kids.length === 0,
          )
          const hasChildren = kids.length > 0 || isLazyPending
          const expanded = Boolean(q) || expandedSet.value.has(node.id)
          rows.push({ node, parentId, depth, hasChildren, isLazyPending, expanded })
          if (kids.length > 0 && expanded) {
            walk(kids, depth + 1, node.id)
          }
        }
      }
      walk(props.data, 0, null)
      return rows
    })

    const isVirtualized = computed(
      () => props.height !== undefined && flatRows.value.length > props.virtualThreshold,
    )
    const viewportPx = computed(() => (typeof props.height === 'number' ? props.height : 320))
    const visibleRange = computed(() => {
      if (!isVirtualized.value) return { start: 0, end: flatRows.value.length }
      const start = Math.max(0, Math.floor(scrollTop.value / props.itemHeight) - 4)
      const end = Math.min(
        flatRows.value.length,
        start + Math.ceil(viewportPx.value / props.itemHeight) + 8,
      )
      return { start, end }
    })

    const updateExpanded = (next: Set<string | number>) => {
      internalExpanded.value = next
      emit('update:expandedKeys', Array.from(next))
    }

    const toggleExpand = async (row: FlatTreeRow) => {
      const id = row.node.id
      if (loadingIds.value.has(id)) return

      const next = new Set(expandedSet.value)
      if (next.has(id)) {
        next.delete(id)
        updateExpanded(next)
        emit('nodeCollapse', row.node)
        return
      }

      // Lazy load children if pending
      if (row.isLazyPending && props.load) {
        const loadingNext = new Set(loadingIds.value)
        loadingNext.add(id)
        loadingIds.value = loadingNext
        try {
          const children = await props.load(row.node)
          loadedChildren[String(id)] = Array.isArray(children) ? children : []
          const doneLoaded = new Set(loadedIds.value)
          doneLoaded.add(id)
          loadedIds.value = doneLoaded
        } finally {
          const doneLoading = new Set(loadingIds.value)
          doneLoading.delete(id)
          loadingIds.value = doneLoading
        }
      }

      if (props.accordion) {
        const siblings = treeIndex.value.siblingsMap.get(row.parentId) ?? []
        for (const sib of siblings) {
          if (sib.id !== id) next.delete(sib.id)
        }
      }
      next.add(id)
      updateExpanded(next)
      emit('nodeExpand', row.node)
    }

    const toggleCheck = (node: FsusTreeNode) => {
      if (node.disabled) return
      const next = new Set(checkStates.value.checked)

      if (props.checkStrictly) {
        if (next.has(node.id)) next.delete(node.id)
        else next.add(node.id)
        const arr = Array.from(next)
        emit('update:checkedKeys', arr)
        emit('check', node, { checkedKeys: arr, halfCheckedKeys: [] })
        return
      }

      const shouldCheck = !checkStates.value.checked.has(node.id)
      const applyDown = (n: FsusTreeNode) => {
        if (!n.disabled) {
          if (shouldCheck) next.add(n.id)
          else next.delete(n.id)
        }
        getNodeChildren(n).forEach(applyDown)
      }
      applyDown(node)

      // Recompute upward parent check states
      const halfChecked = new Set<string | number>()
      const syncUp = (n: FsusTreeNode): 'checked' | 'indeterminate' | 'unchecked' => {
        const activeKids = getNodeChildren(n).filter((k) => !k.disabled)
        if (activeKids.length === 0) return next.has(n.id) ? 'checked' : 'unchecked'
        let c = 0
        let hState = false
        for (const k of activeKids) {
          const st = syncUp(k)
          if (st === 'checked') c++
          else if (st === 'indeterminate') hState = true
        }
        if (c === activeKids.length) {
          next.add(n.id)
          return 'checked'
        }
        next.delete(n.id)
        if (c > 0 || hState) {
          halfChecked.add(n.id)
          return 'indeterminate'
        }
        return 'unchecked'
      }
      for (const root of props.data) syncUp(root)

      const arr = Array.from(next)
      emit('update:checkedKeys', arr)
      emit('check', node, { checkedKeys: arr, halfCheckedKeys: Array.from(halfChecked) })
    }

    // Drag & Drop helpers
    const isDescendant = (ancestorId: string | number, candidateId: string | number): boolean => {
      let cur = treeIndex.value.parentMap.get(candidateId) ?? null
      while (cur !== null) {
        if (cur === ancestorId) return true
        cur = treeIndex.value.parentMap.get(cur) ?? null
      }
      return false
    }

    const removeNodeFromList = (list: FsusTreeNode[], id: string | number): FsusTreeNode | null => {
      for (let i = 0; i < list.length; i++) {
        const item = list[i]!
        if (item.id === id) {
          list.splice(i, 1)
          return item
        }
        if (item.children?.length) {
          const found = removeNodeFromList(item.children, id)
          if (found) return found
        }
      }
      return null
    }

    const insertNodeInList = (
      list: FsusTreeNode[],
      targetId: string | number,
      inserted: FsusTreeNode,
      pos: FsusTreeDropType,
    ): boolean => {
      for (let i = 0; i < list.length; i++) {
        const item = list[i]!
        if (item.id === targetId) {
          if (pos === 'before') list.splice(i, 0, inserted)
          else if (pos === 'after') list.splice(i + 1, 0, inserted)
          else {
            if (!item.children) item.children = []
            item.children.push(inserted)
          }
          return true
        }
        if (item.children?.length && insertNodeInList(item.children, targetId, inserted, pos)) {
          return true
        }
      }
      return false
    }

    const onDragStart = (row: FlatTreeRow, e: DragEvent) => {
      if (!props.draggable || row.node.disabled) return
      if (props.allowDrag && !props.allowDrag(row.node)) {
        e.preventDefault()
        return
      }
      draggingId.value = row.node.id
      e.dataTransfer?.setData('text/plain', String(row.node.id))
      if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'
    }

    const onDragOver = (row: FlatTreeRow, e: DragEvent) => {
      if (!props.draggable || draggingId.value === null) return
      if (draggingId.value === row.node.id || isDescendant(draggingId.value, row.node.id)) return
      const draggingNode = treeIndex.value.nodeMap.get(draggingId.value)
      if (!draggingNode) return

      const el = e.currentTarget as HTMLElement
      const rect = el.getBoundingClientRect()
      const ratio = rect.height > 0 ? (e.clientY - rect.top) / rect.height : 0.5
      const pos: FsusTreeDropType = ratio < 0.25 ? 'before' : ratio > 0.75 ? 'after' : 'inside'

      if (props.allowDrop && !props.allowDrop(draggingNode, row.node, pos)) {
        dropTargetId.value = null
        dropType.value = null
        return
      }
      e.preventDefault()
      dropTargetId.value = row.node.id
      dropType.value = pos
    }

    const onDrop = (row: FlatTreeRow, e: DragEvent) => {
      e.preventDefault()
      const dragId = draggingId.value
      const pos = dropType.value
      draggingId.value = null
      dropTargetId.value = null
      dropType.value = null
      if (dragId === null || !pos || dragId === row.node.id || isDescendant(dragId, row.node.id)) {
        return
      }
      const draggingNode = treeIndex.value.nodeMap.get(dragId)
      if (!draggingNode) return
      if (props.allowDrop && !props.allowDrop(draggingNode, row.node, pos)) return

      const removed = removeNodeFromList(props.data, dragId)
      if (removed) {
        insertNodeInList(props.data, row.node.id, removed, pos)
        if (pos === 'inside') {
          const nextExp = new Set(expandedSet.value)
          nextExp.add(row.node.id)
          updateExpanded(nextExp)
        }
        emit('update:data', [...props.data])
        emit('nodeDrop', {
          draggingNode: removed,
          dropNode: row.node,
          dropType: pos,
        } satisfies FsusTreeDropPayload)
      }
    }

    const onDragEnd = () => {
      draggingId.value = null
      dropTargetId.value = null
      dropType.value = null
    }

    // WAI-ARIA TreeView keyboard navigation
    const onTreeKeydown = (e: KeyboardEvent) => {
      const rows = flatRows.value
      if (rows.length === 0) return
      const curIdx = rows.findIndex((r) => r.node.id === focusedKey.value)
      const idx = curIdx >= 0 ? curIdx : 0
      const curRow = rows[idx]!

      if (e.key === FSUS_KEY.ARROW_DOWN) {
        e.preventDefault()
        focusedKey.value = rows[Math.min(rows.length - 1, idx + 1)]!.node.id
      } else if (e.key === FSUS_KEY.ARROW_UP) {
        e.preventDefault()
        focusedKey.value = rows[Math.max(0, idx - 1)]!.node.id
      } else if (e.key === FSUS_KEY.ARROW_RIGHT) {
        e.preventDefault()
        if (curRow.hasChildren && !curRow.expanded) {
          void toggleExpand(curRow)
        } else if (curRow.expanded && idx + 1 < rows.length && rows[idx + 1]!.depth > curRow.depth) {
          focusedKey.value = rows[idx + 1]!.node.id
        }
      } else if (e.key === FSUS_KEY.ARROW_LEFT) {
        e.preventDefault()
        if (curRow.hasChildren && curRow.expanded) {
          void toggleExpand(curRow)
        } else if (curRow.parentId !== null) {
          focusedKey.value = curRow.parentId
        }
      } else if (e.key === FSUS_KEY.HOME) {
        e.preventDefault()
        focusedKey.value = rows[0]!.node.id
      } else if (e.key === FSUS_KEY.END) {
        e.preventDefault()
        focusedKey.value = rows[rows.length - 1]!.node.id
      } else if (e.key === FSUS_KEY.ENTER) {
        e.preventDefault()
        if (!curRow.node.disabled) {
          emit('update:selectedKey', curRow.node.id)
          emit('nodeClick', curRow.node)
        }
      } else if (e.key === FSUS_KEY.SPACE) {
        e.preventDefault()
        if (props.checkable) toggleCheck(curRow.node)
        else if (!curRow.node.disabled) {
          emit('update:selectedKey', curRow.node.id)
          emit('nodeClick', curRow.node)
        }
      }
    }

    const renderRow = (row: FlatTreeRow, index: number) => {
      const isSelected = props.selectedKey === row.node.id
      const isChecked = checkStates.value.checked.has(row.node.id)
      const isIndeterminate = checkStates.value.indeterminate.has(row.node.id)
      const isLoading = loadingIds.value.has(row.node.id)
      const isFocused =
        focusedKey.value === row.node.id || (focusedKey.value === null && index === 0)
      const rowDropPos = dropTargetId.value === row.node.id ? dropType.value : null

      return h(
        'div',
        {
          key: String(row.node.id),
          role: 'treeitem',
          class: 'fsus-tree__node',
          tabindex: isFocused ? 0 : -1,
          draggable: props.draggable && !row.node.disabled ? 'true' : undefined,
          'aria-level': row.depth + 1,
          'aria-expanded': row.hasChildren ? (row.expanded ? 'true' : 'false') : undefined,
          'aria-selected': isSelected ? 'true' : 'false',
          'aria-checked': props.checkable
            ? isIndeterminate
              ? 'mixed'
              : isChecked
                ? 'true'
                : 'false'
            : undefined,
          'data-selected': isSelected ? '' : undefined,
          'data-focused': focusedKey.value === row.node.id ? '' : undefined,
          'data-disabled': row.node.disabled ? '' : undefined,
          'data-dragging': draggingId.value === row.node.id ? '' : undefined,
          'data-drop-position': rowDropPos ?? undefined,
          style: {
            paddingLeft: `${row.depth * 20 + 8}px`,
            ...(isVirtualized.value
              ? {
                  position: 'absolute',
                  top: `${index * props.itemHeight}px`,
                  left: '0',
                  right: '0',
                  height: `${props.itemHeight}px`,
                }
              : {}),
          },
          onFocus: () => {
            focusedKey.value = row.node.id
          },
          onClick: () => {
            focusedKey.value = row.node.id
            if (row.node.disabled) return
            emit('update:selectedKey', row.node.id)
            emit('nodeClick', row.node)
          },
          onDragstart: props.draggable ? (e: DragEvent) => onDragStart(row, e) : undefined,
          onDragover: props.draggable ? (e: DragEvent) => onDragOver(row, e) : undefined,
          onDrop: props.draggable ? (e: DragEvent) => onDrop(row, e) : undefined,
          onDragend: props.draggable ? onDragEnd : undefined,
        },
        [
          row.hasChildren
            ? h(
                'button',
                {
                  type: 'button',
                  class: 'fsus-tree__expand',
                  'aria-label': row.expanded ? 'Collapse' : 'Expand',
                  onClick: (e: MouseEvent) => {
                    e.stopPropagation()
                    void toggleExpand(row)
                  },
                },
                [
                  h(FsusIcon, {
                    name: isLoading ? 'loading' : row.expanded ? 'caret-bottom' : 'caret-right',
                    size: 12,
                    spin: isLoading,
                  }),
                ],
              )
            : h('span', { class: 'fsus-tree__expand-placeholder' }),
          props.checkable
            ? h('input', {
                type: 'checkbox',
                class: 'fsus-tree__checkbox',
                checked: isChecked,
                indeterminate: isIndeterminate,
                'data-indeterminate': isIndeterminate ? '' : undefined,
                disabled: row.node.disabled,
                onClick: (e: MouseEvent) => e.stopPropagation(),
                onChange: () => toggleCheck(row.node),
              })
            : null,
          h(
            'span',
            { class: 'fsus-tree__label' },
            slots.default ? slots.default({ node: row.node, depth: row.depth }) : row.node.label,
          ),
        ],
      )
    }

    return () => {
      if (flatRows.value.length === 0) {
        return h('div', { class: 'fsus-tree fsus-tree__empty', role: 'tree' }, t('common.empty'))
      }
      const range = visibleRange.value
      const sliced = flatRows.value.slice(range.start, range.end)
      return h(
        'div',
        {
          class: 'fsus-tree',
          role: 'tree',
          'aria-multiselectable': props.checkable ? 'true' : undefined,
          style:
            props.height !== undefined ? { height: addUnit(props.height), overflow: 'auto' } : undefined,
          onKeydown: onTreeKeydown,
          onScroll: (e: Event) => {
            scrollTop.value = (e.target as HTMLElement).scrollTop
          },
        },
        isVirtualized.value
          ? h(
              'div',
              { style: { height: `${flatRows.value.length * props.itemHeight}px`, position: 'relative' } },
              sliced.map((row, offset) => renderRow(row, range.start + offset)),
            )
          : sliced.map((row, idx) => renderRow(row, idx)),
      )
    }
  },
})

export const FsusTreeSelect = defineComponent({
  name: 'FsusTreeSelect',
  props: {
    modelValue: { type: [String, Number] as PropType<string | number | null>, default: null },
    data: { type: Array as PropType<FsusTreeNode[]>, default: () => [] },
    placeholder: { type: String, default: undefined },
    disabled: { type: Boolean, default: false },
  },
  emits: ['update:modelValue', 'change'],
  setup(props, { emit }) {
    const { t } = useFsusLocale()
    const open = ref(false)
    const findLabel = (nodes: FsusTreeNode[], id: string | number | null): string => {
      if (id === null) return ''
      for (const n of nodes) {
        if (n.id === id) return n.label
        if (n.children) {
          const nested = findLabel(n.children, id)
          if (nested) return nested
        }
      }
      return ''
    }
    const label = computed(() => findLabel(props.data, props.modelValue))
    return () =>
      h(
        FsusPopover,
        {
          open: open.value,
          'onUpdate:open': (v: boolean) => (open.value = v),
          disabled: props.disabled,
          matchWidth: true,
        },
        {
          reference: () =>
            h('div', { class: 'fsus-select', role: 'combobox', tabindex: props.disabled ? -1 : 0 }, [
              h(
                'span',
                { class: label.value ? 'fsus-select__value' : 'fsus-select__placeholder' },
                label.value || (props.placeholder ?? t('common.selectPlaceholder')),
              ),
              h(FsusIcon, { name: open.value ? 'arrow-up' : 'arrow-down', size: 14 }),
            ]),
          default: () =>
            h(FsusTree, {
              data: props.data,
              selectedKey: props.modelValue,
              defaultExpandAll: true,
              'onUpdate:selectedKey': (id: string | number) => {
                emit('update:modelValue', id)
                emit('change', id)
                open.value = false
              },
            }),
        },
      )
  },
})
