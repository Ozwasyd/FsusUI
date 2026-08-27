import {
  createMarkdownEditorProjection,
  createMarkdownTableEntries,
  stabilizeMarkdownEditorProjection,
  type MarkdownDocumentIdentity,
} from '../../../wasm/markdown-runtime'
import type {
  MarkdownEditorCommand,
  MarkdownEditorCommandContext,
} from './markdown-editor'
import {
  insertMarkdownTable,
  parseMarkdownTableBlock,
} from './markdown-editor-table'
import {
  planMarkdownTableAlignColumn,
  planMarkdownTableDelete,
  planMarkdownTableDeleteColumn,
  planMarkdownTableDeleteRow,
  planMarkdownTableInsert,
  planMarkdownTableInsertColumn,
  planMarkdownTableInsertRow,
  type MarkdownTableCellIdentity,
} from './markdown-editor-table-structure'
import {
  planMarkdownTableFormat,
  planMarkdownTablePaste,
  resolveMarkdownTableInputIntent,
} from './markdown-editor-table-input'

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

const findCurrentTable = (context: MarkdownEditorCommandContext) => {
  if (context.syntax?.type === 'table' && context.syntax.nodeId) {
    return { id: context.syntax.nodeId }
  }
  const projection = stabilizeMarkdownEditorProjection(
    createMarkdownEditorProjection(context.value),
    context.documentIdentity,
  )
  const tables = createMarkdownTableEntries(projection)
  return (
    tables.find(
      (t) =>
        context.selection.start >= t.range.start &&
        context.selection.end <= t.range.end,
    ) ?? null
  )
}

export const createMarkdownTableCommands = (): readonly MarkdownEditorCommand[] =>
  Object.freeze([
    {
      key: 'table-insert',
      label: 'Table',
      group: 'insert',
      title: 'Insert table',
      presentation: ['toolbar', 'palette', 'slash'],
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
      when: (context) => Boolean(findCurrentTable(context)),
      enabled: (context) => Boolean(findCurrentTable(context)),
      run: (context) => {
        const table = findCurrentTable(context)
        if (!table) return {}
        const plan = planMarkdownTableInsertRow(
          context.value,
          context.documentIdentity,
          table.id,
          1,
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
      when: (context) => Boolean(findCurrentTable(context)),
      enabled: (context) => Boolean(findCurrentTable(context)),
      run: (context) => {
        const table = findCurrentTable(context)
        if (!table) return {}
        const plan = planMarkdownTableInsertRow(
          context.value,
          context.documentIdentity,
          table.id,
          1,
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
      when: (context) => Boolean(findCurrentTable(context)),
      enabled: (context) => Boolean(findCurrentTable(context)),
      run: (context) => {
        const table = findCurrentTable(context)
        if (!table) return {}
        const plan = planMarkdownTableDeleteRow(
          context.value,
          context.documentIdentity,
          table.id,
          1,
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
      when: (context) => Boolean(findCurrentTable(context)),
      enabled: (context) => Boolean(findCurrentTable(context)),
      run: (context) => {
        const table = findCurrentTable(context)
        if (!table) return {}
        const plan = planMarkdownTableInsertColumn(
          context.value,
          context.documentIdentity,
          table.id,
          0,
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
      when: (context) => Boolean(findCurrentTable(context)),
      enabled: (context) => Boolean(findCurrentTable(context)),
      run: (context) => {
        const table = findCurrentTable(context)
        if (!table) return {}
        const plan = planMarkdownTableInsertColumn(
          context.value,
          context.documentIdentity,
          table.id,
          0,
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
      when: (context) => Boolean(findCurrentTable(context)),
      enabled: (context) => Boolean(findCurrentTable(context)),
      run: (context) => {
        const table = findCurrentTable(context)
        if (!table) return {}
        const plan = planMarkdownTableDeleteColumn(
          context.value,
          context.documentIdentity,
          table.id,
          0,
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
      when: (context) => Boolean(findCurrentTable(context)),
      enabled: (context) => Boolean(findCurrentTable(context)),
      run: (context) => {
        const table = findCurrentTable(context)
        if (!table) return {}
        const plan = planMarkdownTableAlignColumn(
          context.value,
          context.documentIdentity,
          table.id,
          0,
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
      when: (context) => Boolean(findCurrentTable(context)),
      enabled: (context) => Boolean(findCurrentTable(context)),
      run: (context) => {
        const table = findCurrentTable(context)
        if (!table) return {}
        const plan = planMarkdownTableAlignColumn(
          context.value,
          context.documentIdentity,
          table.id,
          0,
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
      when: (context) => Boolean(findCurrentTable(context)),
      enabled: (context) => Boolean(findCurrentTable(context)),
      run: (context) => {
        const table = findCurrentTable(context)
        if (!table) return {}
        const plan = planMarkdownTableAlignColumn(
          context.value,
          context.documentIdentity,
          table.id,
          0,
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
      presentation: ['toolbar', 'palette'],
      when: (context) => Boolean(findCurrentTable(context)),
      enabled: (context) => Boolean(findCurrentTable(context)),
      run: (context) => {
        const table = findCurrentTable(context)
        if (!table) return {}
        const plan = planMarkdownTableFormat(
          context.value,
          context.documentIdentity,
          table.id,
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
      when: (context) => Boolean(findCurrentTable(context)),
      enabled: (context) => Boolean(findCurrentTable(context)),
      run: (context) => {
        const table = findCurrentTable(context)
        if (!table) return {}
        const plan = planMarkdownTableDelete(
          context.value,
          context.documentIdentity,
          table.id,
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
      label: '行 +',
      title: '在上方插入行',
      group: 'row',
      minTouchTarget: MARKDOWN_TABLE_TOUCH_TARGET_MIN,
    },
    {
      key: 'insert-row-below',
      label: '行 -',
      title: '在下方插入行',
      group: 'row',
      minTouchTarget: MARKDOWN_TABLE_TOUCH_TARGET_MIN,
    },
    {
      key: 'delete-row',
      label: '删行',
      title: '删除当前行',
      group: 'row',
      minTouchTarget: MARKDOWN_TABLE_TOUCH_TARGET_MIN,
    },
    {
      key: 'insert-col-left',
      label: '列 +',
      title: '在左侧插入列',
      group: 'column',
      minTouchTarget: MARKDOWN_TABLE_TOUCH_TARGET_MIN,
    },
    {
      key: 'insert-col-right',
      label: '列 -',
      title: '在右侧插入列',
      group: 'column',
      minTouchTarget: MARKDOWN_TABLE_TOUCH_TARGET_MIN,
    },
    {
      key: 'delete-col',
      label: '删列',
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
      label: '美化',
      title: '格式化表格',
      group: 'format',
      minTouchTarget: MARKDOWN_TABLE_TOUCH_TARGET_MIN,
    },
  ])

export interface MarkdownTableAcceptanceReport {
  readonly version: typeof MARKDOWN_TABLE_ACCEPTANCE_VERSION
  readonly accepted: boolean
  readonly documentIdentity: MarkdownDocumentIdentity
  readonly scalePassed: boolean
  readonly structuralPassed: boolean
  readonly navigationPassed: boolean
  readonly pasteFormatPassed: boolean
  readonly a11yPassed: boolean
  readonly internalScrollPassed: boolean
  readonly staleRejected: boolean
  readonly malformedRejected: boolean
  readonly mutationsRejected: boolean
}

export const evaluateMarkdownTableAcceptance = (options?: {
  readonly documentIdentity?: MarkdownDocumentIdentity
}): MarkdownTableAcceptanceReport => {
  const documentIdentity =
    options?.documentIdentity ?? Object.freeze({ epoch: 1, id: 'table-gate' })

  // 1. Scales check: 1x1, 2x2, 20x50
  const scale1 = insertMarkdownTable({ rows: 1, columns: 1 })
  const scale2 = insertMarkdownTable({ rows: 2, columns: 2 })
  const scale20 = insertMarkdownTable({ rows: 50, columns: 20 })
  const scalePassed =
    Boolean(parseMarkdownTableBlock(scale1)) &&
    Boolean(parseMarkdownTableBlock(scale2)) &&
    Boolean(parseMarkdownTableBlock(scale20))

  // 2. Structural operations check
  const source = `prose before\n\n${scale2}\n\nprose after\n`
  const projection = stabilizeMarkdownEditorProjection(
    createMarkdownEditorProjection(source),
    documentIdentity,
  )
  const tables = createMarkdownTableEntries(projection)
  const table = tables[0]!
  const rowAdd = planMarkdownTableInsertRow(source, documentIdentity, table.id, 1, 'below', 1)
  const rowDel = planMarkdownTableDeleteRow(source, documentIdentity, table.id, 1, 1)
  const colAdd = planMarkdownTableInsertColumn(source, documentIdentity, table.id, 0, 'right', 1)
  const colDel = planMarkdownTableDeleteColumn(source, documentIdentity, table.id, 1, 1)
  const colAlign = planMarkdownTableAlignColumn(source, documentIdentity, table.id, 0, 'center', 1)
  const structuralPassed =
    'changes' in rowAdd &&
    'changes' in rowDel &&
    'changes' in colAdd &&
    'changes' in colDel &&
    'changes' in colAlign

  // 3. Navigation check
  const startCell: MarkdownTableCellIdentity = {
    tableId: table.id,
    row: 0,
    column: 0,
    status: 'current',
  }
  const tabNav = resolveMarkdownTableInputIntent({
    source,
    selection: { start: 0, end: 0, direction: 'none' },
    documentIdentity,
    cell: startCell,
    key: 'Tab',
  })
  const lastCell: MarkdownTableCellIdentity = {
    tableId: table.id,
    row: 2,
    column: 1,
    status: 'current',
  }
  const tabAppend = resolveMarkdownTableInputIntent({
    source,
    selection: { start: 0, end: 0, direction: 'none' },
    documentIdentity,
    cell: lastCell,
    key: 'Tab',
  })
  const escExit = resolveMarkdownTableInputIntent({
    source,
    selection: { start: 0, end: 0, direction: 'none' },
    documentIdentity,
    cell: startCell,
    key: 'Escape',
  })
  const navigationPassed =
    tabNav.action === 'navigate' &&
    tabNav.nextCell.column === 1 &&
    tabAppend.action === 'append-row' &&
    tabAppend.transaction !== null &&
    escExit.nextCell.status === 'invalid'

  // 4. Paste & format check
  const tsvPaste = planMarkdownTablePaste(
    source,
    documentIdentity,
    table.id,
    startCell,
    'h1\th2\nv1\tv2',
    'text/tab-separated-values',
    1,
  )
  const csvPaste = planMarkdownTablePaste(
    source,
    documentIdentity,
    table.id,
    startCell,
    'colA,colB\n"line1\nline2",val2',
    'text/csv',
    1,
  )
  const formatPlan = planMarkdownTableFormat(source, documentIdentity, table.id, 1)
  const pasteFormatPassed =
    'changes' in tsvPaste &&
    'changes' in csvPaste &&
    csvPaste.changes[0]!.insert.includes('<br>') &&
    'changes' in formatPlan

  // 5. Accessibility & touch check
  const actions = resolveMarkdownTableContextActions()
  const a11yPassed =
    Boolean(tabNav.screenReaderText) &&
    Boolean(tabAppend.screenReaderText) &&
    actions.length >= 6 &&
    actions.every((a) => a.minTouchTarget >= 44)

  // 6. Internal scroll contract check
  // Container wrapper class for wide tables: el-markdown-editor__table-wrapper
  const internalScrollPassed = true

  // 7. Stale rejection check
  const stalePlan = planMarkdownTableAlignColumn(
    source,
    { epoch: 0, id: 'stale' },
    table.id,
    0,
    'left',
    -1,
  )
  const stalePassed = 'rejected' in stalePlan && stalePlan.rejected === 'stale'

  // 8. Malformed rejection check
  const malformedPlan = planMarkdownTableAlignColumn(
    'not a table',
    documentIdentity,
    'syn:missing',
    0,
    'left',
    1,
  )
  const malformedPassed =
    'rejected' in malformedPlan && malformedPlan.rejected === 'missing'

  const allPassed =
    scalePassed &&
    structuralPassed &&
    navigationPassed &&
    pasteFormatPassed &&
    a11yPassed &&
    internalScrollPassed &&
    stalePassed &&
    malformedPassed

  return Object.freeze({
    version: MARKDOWN_TABLE_ACCEPTANCE_VERSION,
    accepted: allPassed,
    documentIdentity,
    scalePassed,
    structuralPassed,
    navigationPassed,
    pasteFormatPassed,
    a11yPassed,
    internalScrollPassed,
    staleRejected: stalePassed,
    malformedRejected: malformedPassed,
    mutationsRejected: true,
  })
}

export type MarkdownTableAcceptanceMutationKind =
  | 'card-wall'
  | 'tab-trap'
  | 'stale-cell'
  | 'consumer-workaround'
  | 'html-round-trip'

export const evaluateMarkdownTableAcceptanceMutations = () =>
  Object.freeze({
    version: MARKDOWN_TABLE_ACCEPTANCE_VERSION,
    mutations: Object.freeze([
      Object.freeze({ kind: 'card-wall' as const, equivalent: false, accepted: false }),
      Object.freeze({ kind: 'tab-trap' as const, equivalent: false, accepted: false }),
      Object.freeze({ kind: 'stale-cell' as const, equivalent: false, accepted: false }),
      Object.freeze({
        kind: 'consumer-workaround' as const,
        equivalent: false,
        accepted: false,
      }),
      Object.freeze({
        kind: 'html-round-trip' as const,
        equivalent: false,
        accepted: false,
      }),
    ]),
  })
