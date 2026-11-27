import English from '@element-plus/locale/lang/en'
import type {
  MarkdownEditorCommand,
  MarkdownEditorCommandContext,
  MarkdownEditorCommandResult,
  MarkdownEditorTableLocaleText,
} from './markdown-editor'
import {
  planMarkdownTableAlignColumn,
  planMarkdownTableDelete,
  planMarkdownTableDeleteColumn,
  planMarkdownTableDeleteRow,
  planMarkdownTableInsert,
  planMarkdownTableInsertColumn,
  planMarkdownTableInsertRow,
  planMarkdownTableMoveColumn,
  planMarkdownTableMoveRow,
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

type TableCommandPlanner = (
  table: [
    source: string,
    identity: MarkdownEditorCommandContext['documentIdentity'],
    tableId: string,
  ],
  cell: MarkdownTableCellIdentity,
  revision: number,
) => ReturnType<typeof planMarkdownTableAlignColumn>

const createTableCommand = (
  key: string,
  label: string,
  title: string,
  plan: TableCommandPlanner,
  availability: 'cell' | 'body-row' | 'valid-plan' = 'cell',
): MarkdownEditorCommand => {
  const resolveCell = (context: MarkdownEditorCommandContext) => {
    const cell = findCurrentCell(context)
    return cell && (availability !== 'body-row' || cell.row > 0) ? cell : null
  }
  const run = (
    context: MarkdownEditorCommandContext,
  ): MarkdownEditorCommandResult => {
    const cell = resolveCell(context)
    if (!cell) return {}
    const result = plan(
      [context.value, context.documentIdentity, cell.tableId],
      cell,
      context.revision,
    )
    return 'changes' in result ? { transaction: result } : {}
  }
  return {
    key,
    label,
    group: 'table',
    title,
    presentation: ['palette'],
    when: (context) => Boolean(resolveCell(context)),
    enabled: (context) =>
      availability === 'valid-plan'
        ? Boolean(run(context).transaction)
        : Boolean(resolveCell(context)),
    run,
  }
}

export const createMarkdownTableCommands =
  (): readonly MarkdownEditorCommand[] =>
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
      createTableCommand(
        'table-insert-row-above',
        'Insert row above',
        'Insert row above current cell',
        (table, { row }, revision) =>
          planMarkdownTableInsertRow(...table, row, 'above', revision),
      ),
      createTableCommand(
        'table-insert-row-below',
        'Insert row below',
        'Insert row below current cell',
        (table, { row }, revision) =>
          planMarkdownTableInsertRow(...table, row, 'below', revision),
      ),
      createTableCommand(
        'table-delete-row',
        'Delete row',
        'Delete current row',
        (table, { row }, revision) =>
          planMarkdownTableDeleteRow(...table, row, revision),
        'body-row',
      ),
      createTableCommand(
        'table-move-row-up',
        'Move row up',
        'Move current row up',
        (table, { row, column }, revision) =>
          planMarkdownTableMoveRow(...table, row, 'up', revision, column),
        'valid-plan',
      ),
      createTableCommand(
        'table-move-row-down',
        'Move row down',
        'Move current row down',
        (table, { row, column }, revision) =>
          planMarkdownTableMoveRow(...table, row, 'down', revision, column),
        'valid-plan',
      ),
      createTableCommand(
        'table-insert-col-left',
        'Insert column left',
        'Insert column left of current cell',
        (table, { column }, revision) =>
          planMarkdownTableInsertColumn(...table, column, 'left', revision),
      ),
      createTableCommand(
        'table-insert-col-right',
        'Insert column right',
        'Insert column right of current cell',
        (table, { column }, revision) =>
          planMarkdownTableInsertColumn(...table, column, 'right', revision),
      ),
      createTableCommand(
        'table-delete-col',
        'Delete column',
        'Delete current column',
        (table, { column }, revision) =>
          planMarkdownTableDeleteColumn(...table, column, revision),
      ),
      createTableCommand(
        'table-move-col-left',
        'Move column left',
        'Move current column left',
        (table, { row, column }, revision) =>
          planMarkdownTableMoveColumn(...table, column, 'left', revision, row),
        'valid-plan',
      ),
      createTableCommand(
        'table-move-col-right',
        'Move column right',
        'Move current column right',
        (table, { row, column }, revision) =>
          planMarkdownTableMoveColumn(...table, column, 'right', revision, row),
        'valid-plan',
      ),
      createTableCommand(
        'table-align-left',
        'Align left',
        'Align column left',
        (table, { column }, revision) =>
          planMarkdownTableAlignColumn(...table, column, 'left', revision),
      ),
      createTableCommand(
        'table-align-center',
        'Align center',
        'Align column center',
        (table, { column }, revision) =>
          planMarkdownTableAlignColumn(...table, column, 'center', revision),
      ),
      createTableCommand(
        'table-align-right',
        'Align right',
        'Align column right',
        (table, { column }, revision) =>
          planMarkdownTableAlignColumn(...table, column, 'right', revision),
      ),
      createTableCommand(
        'table-format',
        'Format table',
        'Format and align table cells',
        (table, _cell, revision) => planMarkdownTableFormat(...table, revision),
      ),
      createTableCommand(
        'table-delete',
        'Delete table',
        'Delete current table',
        (table, _cell, revision) => planMarkdownTableDelete(...table, revision),
      ),
    ])

export const resolveMarkdownTableContextActions = (
  _context?: MarkdownEditorCommandContext,
  _cell?: MarkdownTableCellIdentity,
  tableLocale: MarkdownEditorTableLocaleText = English.el.markdownEditor.table,
): readonly MarkdownTableContextAction[] => {
  const actions = tableLocale.actions
  const action = (
    key: keyof typeof actions,
    group: MarkdownTableContextAction['group'],
    titleKey = key,
  ): MarkdownTableContextAction => ({
    key,
    label: actions[key],
    title: actions[titleKey],
    group,
    minTouchTarget: MARKDOWN_TABLE_TOUCH_TARGET_MIN,
  })
  return Object.freeze([
    action('insert-row-above', 'row'),
    action('insert-row-below', 'row'),
    action('move-row-up', 'row'),
    action('move-row-down', 'row'),
    action('delete-row', 'row'),
    action('insert-col-left', 'column'),
    action('insert-col-right', 'column'),
    action('move-col-left', 'column'),
    action('move-col-right', 'column'),
    action('delete-col', 'column'),
    action('align-left', 'align', 'align-left-title'),
    action('align-center', 'align', 'align-center-title'),
    action('align-right', 'align', 'align-right-title'),
    action('format-table', 'format'),
  ])
}
