import { get } from 'lodash-unified'
import { isFunction, isObject } from '@element-plus/utils'
import { ExpandIcon, TableCell } from '../components'
import { Alignment } from '../constants'
import { placeholderSign } from '../private'
import { componentToSlot, enforceUnit, tryCall } from '../utils'

import type { FunctionalComponent, UnwrapNestedRefs, VNode } from 'vue'
import type { CellRendererParams } from '../types'
import type { TableV2RowCellRenderParam } from '../components'
import type { UseNamespaceReturn } from '@element-plus/hooks'
import type { UseTableReturn } from '../use-table'
import type { TableV2Props } from '../table'

type CellRendererProps = TableV2RowCellRenderParam &
  Pick<
    TableV2Props,
    'cellProps' | 'expandColumnKey' | 'indentSize' | 'iconSize' | 'rowKey'
  > &
  UnwrapNestedRefs<Pick<UseTableReturn, 'expandedRowKeys'>> & {
    ns: UseNamespaceReturn
  }

const simpleDataKey = /^[\w-]+$/u

const defaultCellRenderer = (props: CellRendererParams<any>) => (
  <TableCell {...props} />
)

const CellRenderer: FunctionalComponent<CellRendererProps> = (
  {
    // renderer props
    columns,
    column,
    columnIndex,
    depth,
    expandIconProps,
    isScrolling,
    rowData,
    rowIndex,
    // from use-table
    style,
    expandedRowKeys,
    ns,
    // derived props
    cellProps: _cellProps,
    expandColumnKey,
    indentSize,
    iconSize,
    rowKey,
  },
  { slots },
) => {
  const cellStyle = enforceUnit(style)

  if (column.placeholderSign === placeholderSign) {
    return <div class={ns.em('row-cell', 'placeholder')} style={cellStyle} />
  }
  const { cellRenderer, dataKey, dataGetter } = column

  const columnCellRenderer = componentToSlot(cellRenderer)

  const CellComponent =
    columnCellRenderer || slots.default || defaultCellRenderer

  const cellData = isFunction(dataGetter)
    ? dataGetter({ columns, column, columnIndex, rowData, rowIndex })
    : typeof dataKey === 'string' && simpleDataKey.test(dataKey)
      ? rowData?.[dataKey]
      : get(rowData, dataKey ?? '')

  const extraCellProps = isFunction(_cellProps)
    ? tryCall(_cellProps, {
        cellData,
        columns,
        column,
        columnIndex,
        rowIndex,
        rowData,
      })
    : _cellProps

  const cellProps = {
    class: ns.e('cell-text'),
    columns,
    column,
    columnIndex,
    cellData,
    isScrolling,
    rowData,
    rowIndex,
  }

  const Cell = CellComponent(cellProps)

  const kls = [
    ns.e('row-cell'),
    column.class,
    column.align === Alignment.CENTER && ns.is('align-center'),
    column.align === Alignment.RIGHT && ns.is('align-right'),
  ]

  const expandable =
    rowIndex >= 0 && expandColumnKey && column.key === expandColumnKey
  let IconOrPlaceholder: VNode | undefined
  if (expandable) {
    const iconStyle = `margin-inline-start: ${depth * indentSize}px;`
    if (isObject(expandIconProps)) {
      const expanded = expandedRowKeys.includes(rowData[rowKey])
      IconOrPlaceholder = (
        <ExpandIcon
          {...expandIconProps}
          class={[ns.e('expand-icon'), ns.is('expanded', expanded)]}
          size={iconSize}
          expanded={expanded}
          style={iconStyle}
          expandable
        />
      )
    } else {
      IconOrPlaceholder = (
        <div
          style={[
            iconStyle,
            `width: ${iconSize}px; height: ${iconSize}px;`,
          ].join(' ')}
        />
      )
    }
  }

  return (
    <div class={kls} style={cellStyle} {...extraCellProps} role="cell">
      {IconOrPlaceholder}
      {Cell}
    </div>
  )
}

CellRenderer.inheritAttrs = false

export default CellRenderer
