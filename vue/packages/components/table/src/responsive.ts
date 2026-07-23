import type { TableColumnCtx } from './table-column/defaults'

export type TableColumnPriority = 'primary' | 'secondary' | 'detail'

export const resolveTableColumnPriority = <T>(
  columns: TableColumnCtx<T>[],
  column: TableColumnCtx<T>,
): TableColumnPriority => {
  if (column.type !== 'default') return 'primary'
  if (column.priority) return column.priority

  const firstDefaultColumn = columns.find(
    (candidate) => candidate.type === 'default',
  )
  return firstDefaultColumn?.id === column.id ? 'primary' : 'secondary'
}

export const getResponsiveDetailColumns = <T>(columns: TableColumnCtx<T>[]) =>
  columns.filter(
    (column) =>
      column.type === 'default' &&
      resolveTableColumnPriority(columns, column) !== 'primary',
  )
