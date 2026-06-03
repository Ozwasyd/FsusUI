import { CHANGE_EVENT, UPDATE_MODEL_EVENT } from '@element-plus/constants'
import { buildProps, definePropType } from '@element-plus/utils'

import type { ExtractPropTypes, PropType } from 'vue'
import type { MarkdownFeatureActivationFeatureOptions } from '@element-plus/wasm'
import type MarkdownEditor from './markdown-editor.vue'

export type MarkdownEditorMode = 'write' | 'split' | 'preview'

export interface MarkdownEditorSelection {
  end: number
  start: number
}

export interface MarkdownEditorCommandResult {
  nextSelection?: MarkdownEditorSelection
  value: string
}

export interface MarkdownEditorCommand {
  key: string
  label: string
  shortcut?: string
  title?: string
  apply: (
    value: string,
    selection: MarkdownEditorSelection,
  ) => MarkdownEditorCommandResult
}

const clampSelection = (
  value: string,
  selection: MarkdownEditorSelection,
): MarkdownEditorSelection => ({
  end: Math.max(0, Math.min(value.length, selection.end)),
  start: Math.max(0, Math.min(value.length, selection.start)),
})

const replaceRange = (
  value: string,
  selection: MarkdownEditorSelection,
  replacement: string,
  selectStartOffset = 0,
  selectEndOffset = replacement.length,
): MarkdownEditorCommandResult => {
  const range = clampSelection(value, selection)
  const nextValue =
    value.slice(0, range.start) + replacement + value.slice(range.end)
  return {
    nextSelection: {
      start: range.start + selectStartOffset,
      end: range.start + selectEndOffset,
    },
    value: nextValue,
  }
}

const wrapSelection = (
  value: string,
  selection: MarkdownEditorSelection,
  prefix: string,
  suffix = prefix,
  placeholder = '',
) => {
  const range = clampSelection(value, selection)
  const selected = value.slice(range.start, range.end) || placeholder
  return replaceRange(
    value,
    range,
    `${prefix}${selected}${suffix}`,
    prefix.length,
    prefix.length + selected.length,
  )
}

const prefixSelectedLines = (
  value: string,
  selection: MarkdownEditorSelection,
  prefix: string,
) => {
  const range = clampSelection(value, selection)
  const lineStart = value.lastIndexOf('\n', range.start - 1) + 1
  const lineEndIndex = value.indexOf('\n', range.end)
  const lineEnd = lineEndIndex === -1 ? value.length : lineEndIndex
  const block = value.slice(lineStart, lineEnd)
  const replacement = block
    .split('\n')
    .map((line) => (line.startsWith(prefix) ? line : `${prefix}${line}`))
    .join('\n')
  return replaceRange(
    value,
    { start: lineStart, end: lineEnd },
    replacement,
    range.start - lineStart + prefix.length,
    range.end - lineStart + prefix.length,
  )
}

export const defaultMarkdownEditorCommands: readonly MarkdownEditorCommand[] = [
  {
    key: 'bold',
    label: 'B',
    shortcut: 'Mod+B',
    title: 'Bold',
    apply: (value, selection) =>
      wrapSelection(value, selection, '**', '**', 'text'),
  },
  {
    key: 'italic',
    label: 'I',
    shortcut: 'Mod+I',
    title: 'Italic',
    apply: (value, selection) =>
      wrapSelection(value, selection, '*', '*', 'text'),
  },
  {
    key: 'heading',
    label: 'H',
    shortcut: 'Mod+Alt+H',
    title: 'Heading',
    apply: (value, selection) => prefixSelectedLines(value, selection, '## '),
  },
  {
    key: 'quote',
    label: 'Q',
    title: 'Quote',
    apply: (value, selection) => prefixSelectedLines(value, selection, '> '),
  },
  {
    key: 'code',
    label: '{}',
    shortcut: 'Mod+E',
    title: 'Code',
    apply: (value, selection) =>
      wrapSelection(value, selection, '`', '`', 'code'),
  },
  {
    key: 'link',
    label: 'Link',
    shortcut: 'Mod+K',
    title: 'Link',
    apply: (value, selection) =>
      wrapSelection(value, selection, '[', '](https://example.com)', 'label'),
  },
  {
    key: 'image',
    label: 'Image',
    title: 'Image',
    apply: (value, selection) =>
      wrapSelection(
        value,
        selection,
        '![',
        '](https://example.com/image.png)',
        'alt',
      ),
  },
]

export const applyMarkdownEditorCommand = (
  value: string,
  selection: MarkdownEditorSelection,
  command: MarkdownEditorCommand,
): MarkdownEditorCommandResult => command.apply(value, selection)

export const markdownEditorProps = buildProps({
  modelValue: {
    type: String,
    default: '',
  },
  defaultMode: {
    type: String as PropType<MarkdownEditorMode>,
    values: ['write', 'split', 'preview'],
    default: 'write',
  },
  placeholder: {
    type: String,
    default: '',
  },
  commands: {
    type: definePropType<readonly MarkdownEditorCommand[]>(Array),
    default: () => defaultMarkdownEditorCommands,
  },
  previewBaseUrl: {
    type: String as PropType<string | null>,
    default: null,
  },
  previewCspNonce: {
    type: String as PropType<string | null>,
    default: null,
  },
  previewFeatures: {
    type: Object as PropType<MarkdownFeatureActivationFeatureOptions>,
    default: undefined,
  },
  allowHtml: {
    type: Boolean,
    default: false,
  },
  sanitizeHtml: {
    type: Boolean,
    default: true,
  },
  minRows: {
    type: Number,
    default: 12,
  },
} as const)

export const markdownEditorEmits = {
  [UPDATE_MODEL_EVENT]: (value: string) => typeof value === 'string',
  [CHANGE_EVENT]: (value: string) => typeof value === 'string',
  command: (command: MarkdownEditorCommand) => Boolean(command?.key),
  'mode-change': (mode: MarkdownEditorMode) =>
    mode === 'write' || mode === 'split' || mode === 'preview',
  save: (value: string) => typeof value === 'string',
  submit: (value: string) => typeof value === 'string',
  'upload-image': () => true,
  'render-complete': (..._args: unknown[]) => true,
  'render-error': (..._args: unknown[]) => true,
  'features-activated': (..._args: unknown[]) => true,
}

export type MarkdownEditorProps = ExtractPropTypes<typeof markdownEditorProps>
export type MarkdownEditorEmits = typeof markdownEditorEmits
export type MarkdownEditorInstance = InstanceType<typeof MarkdownEditor>
