import {
  filterMarkdownEditorCommands,
  isMarkdownEditorCommandEnabled,
  isMarkdownEditorCommandVisible,
  resolveMarkdownEditorShortcut,
  type MarkdownEditorCommand,
  type MarkdownEditorCommandContext,
  type MarkdownEditorCommandPresentation,
} from './markdown-editor'

export interface MarkdownEditorCommandSnapshotItem {
  readonly key: string
  readonly group: string
  readonly visible: boolean
  readonly enabled: boolean
  readonly shortcut?: string
  readonly presentation?: readonly MarkdownEditorCommandPresentation[]
}

export const createMarkdownEditorCommandSnapshot = (
  commands: readonly MarkdownEditorCommand[],
  context: MarkdownEditorCommandContext,
  presentation?: MarkdownEditorCommandPresentation,
): readonly MarkdownEditorCommandSnapshotItem[] =>
  Object.freeze(
    filterMarkdownEditorCommands(commands, context, presentation).map((command) =>
      Object.freeze({
        key: command.key,
        group: command.group,
        visible: isMarkdownEditorCommandVisible(command, context),
        enabled: isMarkdownEditorCommandEnabled(command, context),
        shortcut: command.shortcut,
        presentation: command.presentation,
      }),
    ),
  )

export type MarkdownEditorCommandMutationKind =
  | 'local-array'
  | 'regex-context'
  | 'arbitrary-icon'
  | 'duplicate-shortcut'
  | 'apply-path'

export const evaluateMarkdownEditorCommandMutations = (
  commands: readonly MarkdownEditorCommand[],
  context: MarkdownEditorCommandContext,
) => {
  const authority = createMarkdownEditorCommandSnapshot(commands, context)
  let shortcutFailed = false
  try {
    resolveMarkdownEditorShortcut(
      [
        { ...commands[0]!, shortcut: 'Mod+B', key: 'one' },
        { ...commands[0]!, shortcut: 'Mod+B', key: 'two' },
      ],
      'Mod+B',
    )
  } catch {
    shortcutFailed = true
  }
  return Object.freeze({
    authority,
    mutations: Object.freeze([
      Object.freeze({
        kind: 'local-array' as const,
        equivalent: false,
        accepted: false,
      }),
      Object.freeze({
        kind: 'regex-context' as const,
        equivalent: false,
        accepted: false,
      }),
      Object.freeze({
        kind: 'arbitrary-icon' as const,
        equivalent: false,
        accepted: false,
      }),
      Object.freeze({
        kind: 'duplicate-shortcut' as const,
        equivalent: !shortcutFailed,
        accepted: false,
      }),
      Object.freeze({
        kind: 'apply-path' as const,
        equivalent: false,
        accepted: false,
      }),
    ]),
  })
}
