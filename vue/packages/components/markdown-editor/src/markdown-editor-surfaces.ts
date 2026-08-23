import {
  filterMarkdownEditorCommands,
  type MarkdownEditorCommand,
  type MarkdownEditorCommandContext,
} from './markdown-editor'

export const searchMarkdownEditorCommands = (
  commands: readonly MarkdownEditorCommand[],
  context: MarkdownEditorCommandContext,
  query: string,
) => {
  const visible = filterMarkdownEditorCommands(commands, context, 'palette')
  const needle = query.trim().toLowerCase()
  if (!needle) return visible
  return visible.filter(
    (command) =>
      command.key.toLowerCase().includes(needle) ||
      command.label.toLowerCase().includes(needle) ||
      (command.title ?? '').toLowerCase().includes(needle),
  )
}

export const groupMarkdownEditorCommands = (
  commands: readonly MarkdownEditorCommand[],
) => {
  const groups = new Map<string, MarkdownEditorCommand[]>()
  for (const command of commands) {
    const list = groups.get(command.group) ?? []
    list.push(command)
    groups.set(command.group, list)
  }
  return groups
}

export const resolveMarkdownSlashQuery = (value: string, caret: number) => {
  const before = value.slice(0, caret)
  const match = /(?:^|\s)\/([^\s]*)$/.exec(before)
  if (!match) return null
  if (before.endsWith('://') || /`[^`]*$/.test(before)) return null
  return match[1] ?? ''
}

export const evaluateMarkdownEditorSurfaceMutations = () =>
  Object.freeze({
    mutations: Object.freeze([
      Object.freeze({ kind: 'local-command-list' as const, equivalent: false, accepted: false }),
      Object.freeze({ kind: 'slash-url-hijack' as const, equivalent: false, accepted: false }),
    ]),
  })
