import { CHANGE_EVENT } from '@element-plus/constants'
import { buildProps, definePropType } from '@element-plus/utils'
import { collectionDensities } from './collection-toolbar'

import type { ExtractPropTypes } from 'vue'
import type DataList from './data-list.vue'

export type DataListRowKey = string | number
export const dataListVariants = ['default', 'summary', 'navigation'] as const

export type DataListColumn = {
  key: string
  label: string
  grid?: string
  align?: 'start' | 'center' | 'end'
}

export type DataListRow = Record<string, unknown>

export type DataListRowKeyGetter = (
  row: DataListRow,
  index: number,
) => DataListRowKey
export type DataListRowHrefGetter = (
  row: DataListRow,
  index: number,
) => string | undefined

export const dataListProps = buildProps({
  /**
   * @description data rows rendered by the list
   */
  rows: {
    type: definePropType<DataListRow[]>(Array),
    default: () => [],
  },
  /**
   * @description column contract for header and row cells
   */
  columns: {
    type: definePropType<DataListColumn[]>(Array),
    default: () => [],
  },
  /**
   * @description row key field or key getter
   */
  rowKey: {
    type: definePropType<string | DataListRowKeyGetter>([String, Function]),
    default: 'id',
  },
  /**
   * @description selected row key
   */
  activeKey: {
    type: definePropType<DataListRowKey | null>([String, Number]),
    default: null,
  },
  /**
   * @description row key that is currently loading
   */
  loadingKey: {
    type: definePropType<DataListRowKey | null>([String, Number]),
    default: null,
  },
  /**
   * @description disable every row while the collection is loading
   */
  loading: Boolean,
  /**
   * @description disable every interactive row
   */
  disabled: Boolean,
  /**
   * @description stable keys of rows that must not activate
   */
  disabledKeys: {
    type: definePropType<DataListRowKey[]>(Array),
    default: () => [],
  },
  /**
   * @description optional href getter; when present rows render as anchors
   */
  href: {
    type: definePropType<DataListRowHrefGetter>(Function),
  },
  /**
   * @description accessible list label
   */
  ariaLabel: String,
  /**
   * @description id of an external list label
   */
  ariaLabelledby: String,
  /**
   * @description list density
   */
  density: {
    type: String,
    values: collectionDensities,
    default: 'default',
  },
  /**
   * @description visual presentation variant
   */
  variant: {
    type: String,
    values: dataListVariants,
    default: 'default',
  },
  /**
   * @description render a header row from columns
   */
  showHeader: {
    type: Boolean,
    default: true,
  },
  /**
   * @description make rows interactive when no href getter is provided
   */
  interactive: {
    type: Boolean,
    default: true,
  },
} as const)

export const dataListEmits = {
  [CHANGE_EVENT]: (
    _row: DataListRow,
    _key: DataListRowKey,
    _event: MouseEvent,
  ) => true,
  'row-click': (_row: DataListRow, _key: DataListRowKey, _event: MouseEvent) =>
    true,
}

export type DataListProps = ExtractPropTypes<typeof dataListProps>
export type DataListEmits = typeof dataListEmits
export type DataListInstance = InstanceType<typeof DataList>
