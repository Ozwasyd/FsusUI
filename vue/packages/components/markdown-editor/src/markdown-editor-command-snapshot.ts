import {
  getMarkdownEditorCommand,
  isMarkdownEditorCommandEnabled,
  isMarkdownEditorCommandVisible,
  type MarkdownEditorCommand,
  type MarkdownEditorCommandContext,
  type MarkdownEditorCommandIcon,
  type MarkdownEditorCommandPresentation,
} from './markdown-editor'
import type { MarkdownEditorCommandPendingState } from './markdown-editor-command-async'

const MARKDOWN_EDITOR_COMMAND_ICONS = new Set<MarkdownEditorCommandIcon>([
  'bold',
  'code',
  'heading',
  'image',
  'italic',
  'link',
  'quote',
])
const MARKDOWN_EDITOR_COMMAND_PRESENTATIONS =
  new Set<MarkdownEditorCommandPresentation>([
    'palette',
    'selection',
    'slash',
    'toolbar',
  ])

/**
 * Command contexts carry stable document, selection, syntax, and transaction
 * facts only. A handle to the textarea, the rendered DOM, or a third-party
 * editor instance would let a command bypass the projection and dispatcher, so
 * the snapshot refuses such a context instead of reading through it.
 */
const MARKDOWN_EDITOR_PRIVATE_EDITOR_CONTEXT_KEYS = Object.freeze([
  '$el',
  'cm',
  'codemirror',
  'dom',
  'editor',
  'editorInstance',
  'editorRef',
  'element',
  'instance',
  'monaco',
  'prosemirror',
  'textarea',
  'textareaRef',
  'view',
])

const normalizedShortcut = (shortcut: string) =>
  shortcut.trim().replace(/\s+/gu, '').toLowerCase()

export interface MarkdownEditorCommandRuntimeState {
  readonly state: MarkdownEditorCommandPendingState
  readonly disabledReason?: string
  readonly error?: unknown
}

export interface MarkdownEditorCommandSnapshotItem {
  readonly command: MarkdownEditorCommand
  readonly key: string
  readonly label: string
  readonly description?: string
  readonly group: string
  readonly icon?: MarkdownEditorCommandIcon
  readonly keywords: readonly string[]
  readonly shortcut?: string
  readonly title?: string
  readonly presentation: readonly MarkdownEditorCommandPresentation[]
  readonly priority: number
  readonly visible: boolean
  readonly enabled: boolean
  readonly state: MarkdownEditorCommandPendingState
  readonly pending: boolean
  readonly disabledReason?: string
  readonly error?: unknown
}

const validateMarkdownEditorCommands = (
  commands: readonly MarkdownEditorCommand[],
) => {
  const keys = new Set<string>()
  const shortcuts = new Map<string, string>()

  for (const command of commands) {
    if (!command.key.trim() || command.key !== command.key.trim()) {
      throw new Error('Markdown editor command key must be non-empty and trimmed.')
    }
    if (keys.has(command.key)) {
      throw new Error(`Markdown editor duplicate command key: ${command.key}`)
    }
    keys.add(command.key)

    if (!command.label.trim()) {
      throw new Error(
        `Markdown editor command "${command.key}" label must not be empty.`,
      )
    }
    if (!command.group.trim() || command.group !== command.group.trim()) {
      throw new Error(
        `Markdown editor command "${command.key}" group must be non-empty and trimmed.`,
      )
    }
    if (typeof command.run !== 'function') {
      throw new Error(
        `Markdown editor command "${command.key}" requires one run path.`,
      )
    }
    if ('apply' in command) {
      throw new Error(
        `Markdown editor command "${command.key}" must not expose the legacy apply path.`,
      )
    }
    if (
      command.icon !== undefined &&
      !MARKDOWN_EDITOR_COMMAND_ICONS.has(command.icon)
    ) {
      throw new Error(
        `Markdown editor command "${command.key}" uses an unregistered icon.`,
      )
    }
    if (
      command.priority !== undefined &&
      !Number.isFinite(command.priority)
    ) {
      throw new Error(
        `Markdown editor command "${command.key}" priority must be finite.`,
      )
    }
    const presentations = command.presentation ?? []
    if (
      new Set(presentations).size !== presentations.length ||
      presentations.some(
        (presentation) =>
          !MARKDOWN_EDITOR_COMMAND_PRESENTATIONS.has(presentation),
      )
    ) {
      throw new Error(
        `Markdown editor command "${command.key}" uses an invalid presentation.`,
      )
    }

    if (command.shortcut) {
      const normalized = normalizedShortcut(command.shortcut)
      if (!normalized) {
        throw new Error(
          `Markdown editor command "${command.key}" shortcut must not be empty.`,
        )
      }
      const existing = shortcuts.get(normalized)
      if (existing) {
        throw new Error(
          `Markdown editor shortcut conflict: ${command.shortcut} (${existing}, ${command.key})`,
        )
      }
      shortcuts.set(normalized, command.key)
    }
  }
}

const validateMarkdownEditorCommandContext = (
  context: MarkdownEditorCommandContext,
) => {
  const leaked = MARKDOWN_EDITOR_PRIVATE_EDITOR_CONTEXT_KEYS.filter(
    (key) => key in context,
  )
  if (leaked.length > 0) {
    throw new Error(
      `Markdown editor command context must not expose private editor access: ${leaked.join(', ')}`,
    )
  }
}

export const createMarkdownEditorCommandSnapshot = (
  commands: readonly MarkdownEditorCommand[],
  context: MarkdownEditorCommandContext,
  runtimeStates: ReadonlyMap<string, MarkdownEditorCommandRuntimeState> =
    new Map(),
): readonly MarkdownEditorCommandSnapshotItem[] => {
  validateMarkdownEditorCommands(commands)
  validateMarkdownEditorCommandContext(context)

  return Object.freeze(
    commands.map((command) => {
      const runtime = runtimeStates.get(command.key)
      const visible = isMarkdownEditorCommandVisible(command, context)
      const baseEnabled = isMarkdownEditorCommandEnabled(command, context)
      const pending = runtime?.state === 'pending'
      const disabledReason =
        runtime?.disabledReason ??
        command.disabledReason?.(context) ??
        (pending ? 'pending' : undefined)
      return Object.freeze({
        command,
        key: command.key,
        label: command.label,
        description: command.description,
        group: command.group,
        icon: command.icon,
        keywords: Object.freeze([...(command.keywords ?? [])]),
        shortcut: command.shortcut,
        title: command.title,
        presentation: Object.freeze([
          ...(command.presentation ?? [
            'toolbar',
            'selection',
            'slash',
            'palette',
          ]),
        ]),
        priority: command.priority ?? 0,
        visible,
        enabled: baseEnabled && !pending && !disabledReason,
        state: runtime?.state ?? 'idle',
        pending,
        disabledReason,
        error: runtime?.error,
      })
    }),
  )
}

export const selectMarkdownEditorCommandSnapshot = (
  snapshot: readonly MarkdownEditorCommandSnapshotItem[],
  presentation: MarkdownEditorCommandPresentation,
): readonly MarkdownEditorCommandSnapshotItem[] =>
  snapshot.filter(
    (item) => item.visible && item.presentation.includes(presentation),
  )

export type MarkdownEditorCommandMutationKind =
  | 'local-array'
  | 'regex-context'
  | 'arbitrary-icon'
  | 'duplicate-shortcut'
  | 'apply-path'
  | 'label-dispatch'
  | 'private-editor-access'

const snapshotIdentity = (
  snapshot: readonly MarkdownEditorCommandSnapshotItem[],
) =>
  JSON.stringify(
    snapshot.map((item) => ({
      key: item.key,
      group: item.group,
      presentation: item.presentation,
      visible: item.visible,
      enabled: item.enabled,
      state: item.state,
    })),
  )

const rejectedBySnapshot = (
  commands: readonly MarkdownEditorCommand[],
  context: MarkdownEditorCommandContext,
) => {
  try {
    createMarkdownEditorCommandSnapshot(commands, context)
    return false
  } catch {
    return true
  }
}

export const evaluateMarkdownEditorCommandMutations = (
  commands: readonly MarkdownEditorCommand[],
  context: MarkdownEditorCommandContext,
) => {
  const authority = createMarkdownEditorCommandSnapshot(commands, context)
  const first = commands[0]
  if (!first) {
    throw new Error('Markdown editor command mutation fixture needs a command.')
  }

  const localArray = createMarkdownEditorCommandSnapshot(
    commands.slice(1),
    context,
  )
  const syntaxAuthority: MarkdownEditorCommand = {
    ...first,
    key: 'syntax-authority',
    when: (candidate) => candidate.syntax?.type !== 'code',
  }
  const regexContextMutation: MarkdownEditorCommand = {
    ...syntaxAuthority,
    when: (candidate) => !/`[^`]*$/u.test(candidate.value),
  }
  const syntaxContext: MarkdownEditorCommandContext = {
    ...context,
    syntax: {
      blockIdentity: 'block:0',
      contentRanges: [],
      diagnosticCode: null,
      markerRanges: [],
      nodeId: 'paragraph:0',
      range: { end: 13, start: 0 },
      status: 'valid',
      type: 'paragraph',
    },
    value: '`unterminated',
  }
  const relabeled = createMarkdownEditorCommandSnapshot(
    [{ ...first, label: `${first.label} (renamed)` }],
    context,
  )
  const sharedLabelCommands = [
    { ...first, key: 'label-a', label: 'Shared label', shortcut: undefined },
    { ...first, key: 'label-b', label: 'Shared label', shortcut: undefined },
  ]
  const sharedLabel = createMarkdownEditorCommandSnapshot(
    sharedLabelCommands,
    context,
  )
  const privateEditorContext = {
    ...context,
    textarea: { value: context.value },
  } as unknown as MarkdownEditorCommandContext

  return Object.freeze({
    authority,
    mutations: Object.freeze([
      Object.freeze({
        kind: 'local-array' as const,
        equivalent: snapshotIdentity(localArray) === snapshotIdentity(authority),
        accepted: false,
      }),
      Object.freeze({
        kind: 'regex-context' as const,
        equivalent:
          createMarkdownEditorCommandSnapshot(
            [syntaxAuthority],
            syntaxContext,
          )[0]?.visible ===
          createMarkdownEditorCommandSnapshot(
            [regexContextMutation],
            syntaxContext,
          )[0]?.visible,
        accepted: false,
      }),
      Object.freeze({
        kind: 'arbitrary-icon' as const,
        equivalent: !rejectedBySnapshot(
          [
            {
              ...first,
              icon: 'private-component' as MarkdownEditorCommandIcon,
            },
          ],
          context,
        ),
        accepted: false,
      }),
      Object.freeze({
        kind: 'duplicate-shortcut' as const,
        equivalent: !rejectedBySnapshot(
          [
            { ...first, shortcut: 'Mod+B', key: 'one' },
            { ...first, shortcut: 'mod + b', key: 'two' },
          ],
          context,
        ),
        accepted: false,
      }),
      Object.freeze({
        kind: 'apply-path' as const,
        equivalent: !rejectedBySnapshot(
          [
            {
              ...first,
              apply: () => undefined,
            } as MarkdownEditorCommand,
          ],
          context,
        ),
        accepted: false,
      }),
      Object.freeze({
        kind: 'label-dispatch' as const,
        equivalent:
          relabeled[0]?.key !== first.key ||
          relabeled[0]?.label === first.label ||
          sharedLabel.length !== 2 ||
          sharedLabel.some((item) => item.label !== 'Shared label') ||
          getMarkdownEditorCommand(sharedLabelCommands, 'label-b')?.key !==
            'label-b',
        accepted: false,
      }),
      Object.freeze({
        kind: 'private-editor-access' as const,
        equivalent: !rejectedBySnapshot(commands, privateEditorContext),
        accepted: false,
      }),
    ]),
  })
}
