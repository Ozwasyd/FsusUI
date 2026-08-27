import type {
  MarkdownEditorCommand,
  MarkdownEditorCommandContext,
} from './markdown-editor'
import {
  planMarkdownTableAlignColumn,
  planMarkdownTableDelete,
  planMarkdownTableDeleteColumn,
  planMarkdownTableDeleteRow,
  planMarkdownTableInsert,
  planMarkdownTableInsertColumn,
  planMarkdownTableInsertRow,
  resolveMarkdownTableCellAtOffset,
  type MarkdownTableCellIdentity,
} from './markdown-editor-table-structure'
import { planMarkdownTableFormat } from './markdown-editor-table-input'

export const MARKDOWN_TABLE_ACCEPTANCE_VERSION =
  'markdown-table-acceptance@2026-08-27'

export const MARKDOWN_TABLE_ACCEPTANCE_MODES = Object.freeze([
  'source',
  'live',
  'split',
  'preview',
] as const)

export const MARKDOWN_TABLE_ACCEPTANCE_SCALES = Object.freeze([
  1, 2, 20,
] as const)

export const MARKDOWN_TABLE_TOUCH_TARGET_MIN = 44

export interface MarkdownTableContextAction {
  readonly key: string
  readonly label: string
  readonly title: string
  readonly group: 'row' | 'column' | 'align' | 'format' | 'general'
  readonly minTouchTarget: number
}

const findCurrentCell = (context: MarkdownEditorCommandContext) =>
  resolveMarkdownTableCellAtOffset(
    context.value,
    context.documentIdentity,
    context.selection.start,
  )

export const createMarkdownTableCommands = (): readonly MarkdownEditorCommand[] =>
  Object.freeze([
    {
      key: 'table-insert',
      label: 'Table',
      group: 'insert',
      title: 'Insert table',
      presentation: ['palette', 'slash'],
      when: (context) => !context.readonly,
      enabled: (context) => !context.readonly,
      run: (context) => ({
        transaction: planMarkdownTableInsert(
          context.value,
          context.selection.start,
          3,
          3,
        ),
      }),
    },
    {
      key: 'table-insert-row-above',
      label: 'Insert row above',
      group: 'table',
      title: 'Insert row above current cell',
      presentation: ['palette'],
      when: (context) => Boolean(findCurrentCell(context)),
      enabled: (context) => Boolean(findCurrentCell(context)),
      run: (context) => {
        const cell = findCurrentCell(context)
        if (!cell) return {}
        const plan = planMarkdownTableInsertRow(
          context.value,
          context.documentIdentity,
          cell.tableId,
          cell.row,
          'above',
          context.revision,
        )
        return 'changes' in plan ? { transaction: plan } : {}
      },
    },
    {
      key: 'table-insert-row-below',
      label: 'Insert row below',
      group: 'table',
      title: 'Insert row below current cell',
      presentation: ['palette'],
      when: (context) => Boolean(findCurrentCell(context)),
      enabled: (context) => Boolean(findCurrentCell(context)),
      run: (context) => {
        const cell = findCurrentCell(context)
        if (!cell) return {}
        const plan = planMarkdownTableInsertRow(
          context.value,
          context.documentIdentity,
          cell.tableId,
          cell.row,
          'below',
          context.revision,
        )
        return 'changes' in plan ? { transaction: plan } : {}
      },
    },
    {
      key: 'table-delete-row',
      label: 'Delete row',
      group: 'table',
      title: 'Delete current row',
      presentation: ['palette'],
      when: (context) => Boolean(findCurrentCell(context) && findCurrentCell(context)!.row > 0),
      enabled: (context) => Boolean(findCurrentCell(context) && findCurrentCell(context)!.row > 0),
      run: (context) => {
        const cell = findCurrentCell(context)
        if (!cell || cell.row === 0) return {}
        const plan = planMarkdownTableDeleteRow(
          context.value,
          context.documentIdentity,
          cell.tableId,
          cell.row,
          context.revision,
        )
        return 'changes' in plan ? { transaction: plan } : {}
      },
    },
    {
      key: 'table-insert-col-left',
      label: 'Insert column left',
      group: 'table',
      title: 'Insert column left of current cell',
      presentation: ['palette'],
      when: (context) => Boolean(findCurrentCell(context)),
      enabled: (context) => Boolean(findCurrentCell(context)),
      run: (context) => {
        const cell = findCurrentCell(context)
        if (!cell) return {}
        const plan = planMarkdownTableInsertColumn(
          context.value,
          context.documentIdentity,
          cell.tableId,
          cell.column,
          'left',
          context.revision,
        )
        return 'changes' in plan ? { transaction: plan } : {}
      },
    },
    {
      key: 'table-insert-col-right',
      label: 'Insert column right',
      group: 'table',
      title: 'Insert column right of current cell',
      presentation: ['palette'],
      when: (context) => Boolean(findCurrentCell(context)),
      enabled: (context) => Boolean(findCurrentCell(context)),
      run: (context) => {
        const cell = findCurrentCell(context)
        if (!cell) return {}
        const plan = planMarkdownTableInsertColumn(
          context.value,
          context.documentIdentity,
          cell.tableId,
          cell.column,
          'right',
          context.revision,
        )
        return 'changes' in plan ? { transaction: plan } : {}
      },
    },
    {
      key: 'table-delete-col',
      label: 'Delete column',
      group: 'table',
      title: 'Delete current column',
      presentation: ['palette'],
      when: (context) => Boolean(findCurrentCell(context)),
      enabled: (context) => Boolean(findCurrentCell(context)),
      run: (context) => {
        const cell = findCurrentCell(context)
        if (!cell) return {}
        const plan = planMarkdownTableDeleteColumn(
          context.value,
          context.documentIdentity,
          cell.tableId,
          cell.column,
          context.revision,
        )
        return 'changes' in plan ? { transaction: plan } : {}
      },
    },
    {
      key: 'table-align-left',
      label: 'Align left',
      group: 'table',
      title: 'Align column left',
      presentation: ['palette'],
      when: (context) => Boolean(findCurrentCell(context)),
      enabled: (context) => Boolean(findCurrentCell(context)),
      run: (context) => {
        const cell = findCurrentCell(context)
        if (!cell) return {}
        const plan = planMarkdownTableAlignColumn(
          context.value,
          context.documentIdentity,
          cell.tableId,
          cell.column,
          'left',
          context.revision,
        )
        return 'changes' in plan ? { transaction: plan } : {}
      },
    },
    {
      key: 'table-align-center',
      label: 'Align center',
      group: 'table',
      title: 'Align column center',
      presentation: ['palette'],
      when: (context) => Boolean(findCurrentCell(context)),
      enabled: (context) => Boolean(findCurrentCell(context)),
      run: (context) => {
        const cell = findCurrentCell(context)
        if (!cell) return {}
        const plan = planMarkdownTableAlignColumn(
          context.value,
          context.documentIdentity,
          cell.tableId,
          cell.column,
          'center',
          context.revision,
        )
        return 'changes' in plan ? { transaction: plan } : {}
      },
    },
    {
      key: 'table-align-right',
      label: 'Align right',
      group: 'table',
      title: 'Align column right',
      presentation: ['palette'],
      when: (context) => Boolean(findCurrentCell(context)),
      enabled: (context) => Boolean(findCurrentCell(context)),
      run: (context) => {
        const cell = findCurrentCell(context)
        if (!cell) return {}
        const plan = planMarkdownTableAlignColumn(
          context.value,
          context.documentIdentity,
          cell.tableId,
          cell.column,
          'right',
          context.revision,
        )
        return 'changes' in plan ? { transaction: plan } : {}
      },
    },
    {
      key: 'table-format',
      label: 'Format table',
      group: 'table',
      title: 'Format and align table cells',
      presentation: ['palette'],
      when: (context) => Boolean(findCurrentCell(context)),
      enabled: (context) => Boolean(findCurrentCell(context)),
      run: (context) => {
        const cell = findCurrentCell(context)
        if (!cell) return {}
        const plan = planMarkdownTableFormat(
          context.value,
          context.documentIdentity,
          cell.tableId,
          context.revision,
        )
        return 'changes' in plan ? { transaction: plan } : {}
      },
    },
    {
      key: 'table-delete',
      label: 'Delete table',
      group: 'table',
      title: 'Delete current table',
      presentation: ['palette'],
      when: (context) => Boolean(findCurrentCell(context)),
      enabled: (context) => Boolean(findCurrentCell(context)),
      run: (context) => {
        const cell = findCurrentCell(context)
        if (!cell) return {}
        const plan = planMarkdownTableDelete(
          context.value,
          context.documentIdentity,
          cell.tableId,
          context.revision,
        )
        return 'changes' in plan ? { transaction: plan } : {}
      },
    },
  ])

export const resolveMarkdownTableContextActions = (
  _context?: MarkdownEditorCommandContext,
  _cell?: MarkdownTableCellIdentity,
): readonly MarkdownTableContextAction[] =>
  Object.freeze([
    {
      key: 'insert-row-above',
      label: '在上方插入行',
      title: '在上方插入行',
      group: 'row',
      minTouchTarget: MARKDOWN_TABLE_TOUCH_TARGET_MIN,
    },
    {
      key: 'insert-row-below',
      label: '在下方插入行',
      title: '在下方插入行',
      group: 'row',
      minTouchTarget: MARKDOWN_TABLE_TOUCH_TARGET_MIN,
    },
    {
      key: 'delete-row',
      label: '删除当前行',
      title: '删除当前行',
      group: 'row',
      minTouchTarget: MARKDOWN_TABLE_TOUCH_TARGET_MIN,
    },
    {
      key: 'insert-col-left',
      label: '在左侧插入列',
      title: '在左侧插入列',
      group: 'column',
      minTouchTarget: MARKDOWN_TABLE_TOUCH_TARGET_MIN,
    },
    {
      key: 'insert-col-right',
      label: '在右侧插入列',
      title: '在右侧插入列',
      group: 'column',
      minTouchTarget: MARKDOWN_TABLE_TOUCH_TARGET_MIN,
    },
    {
      key: 'delete-col',
      label: '删除当前列',
      title: '删除当前列',
      group: 'column',
      minTouchTarget: MARKDOWN_TABLE_TOUCH_TARGET_MIN,
    },
    {
      key: 'align-left',
      label: '左对齐',
      title: '列左对齐',
      group: 'align',
      minTouchTarget: MARKDOWN_TABLE_TOUCH_TARGET_MIN,
    },
    {
      key: 'align-center',
      label: '居中',
      title: '列居中',
      group: 'align',
      minTouchTarget: MARKDOWN_TABLE_TOUCH_TARGET_MIN,
    },
    {
      key: 'align-right',
      label: '右对齐',
      title: '列右对齐',
      group: 'align',
      minTouchTarget: MARKDOWN_TABLE_TOUCH_TARGET_MIN,
    },
    {
      key: 'format-table',
      label: '格式化表格',
      title: '格式化表格',
      group: 'format',
      minTouchTarget: MARKDOWN_TABLE_TOUCH_TARGET_MIN,
    },
  ])
