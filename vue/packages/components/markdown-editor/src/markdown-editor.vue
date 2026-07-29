<template>
  <section
    :class="[
      ns.b(),
      ns.m(currentMode),
      ns.m(`mobile-${mobileLayout}`),
      ns.m(`profile-${editorProfile}`),
      ns.m(`interaction-${interactionProfile}`),
      ns.is('commands-expanded', commandsExpanded),
    ]"
    :style="editorStyle"
  >
    <header :class="ns.e('toolbar')">
      <div :class="ns.e('commands')">
        <button
          v-for="command in primaryCommands"
          :key="command.key"
          type="button"
          :class="ns.e('command')"
          :disabled="disabled"
          :title="command.title || command.label"
          @click="runCommand(command)"
        >
          {{ command.label }}
        </button>
        <button
          v-if="overflowItemCount"
          type="button"
          :class="[ns.e('command-more'), ns.is('expanded', commandsExpanded)]"
          :aria-expanded="commandsExpanded"
          :aria-controls="commandTrayId"
          :aria-label="commandOverflowAriaLabel"
          aria-haspopup="true"
          :disabled="disabled"
          @click="toggleCommands"
        >
          <span>{{ commandOverflowLabel }}</span>
          <span :class="ns.e('command-more-count')">{{ overflowItemCount }}</span>
        </button>
      </div>

      <div
        v-if="showModeSwitcher"
        :class="ns.e('modes')"
        role="tablist"
        aria-label="Markdown mode"
      >
        <button
          v-for="mode in visibleModes"
          :key="mode"
          type="button"
          role="tab"
          :aria-selected="currentMode === mode"
          :class="[ns.e('mode'), `${ns.e('mode')}--${mode}`, ns.is('active', currentMode === mode)]"
          :disabled="disabled"
          @click="setMode(mode)"
        >
          {{ modeLabel(mode) }}
        </button>
      </div>

      <div
        v-if="primaryActions.length"
        :class="ns.e('actions')"
      >
        <button
          v-for="action in primaryActions"
          :key="action.key"
          type="button"
          :class="ns.e('action')"
          :disabled="disabled"
          @click="runAction(action)"
        >
          {{ action.label }}
        </button>
      </div>

      <div
        v-if="overflowItemCount && commandsExpanded"
        :id="commandTrayId"
        :class="ns.e('command-tray')"
        @keydown.esc.prevent.stop="commandsExpanded = false"
      >
        <button
          v-for="command in overflowCommands"
          :key="command.key"
          type="button"
          :class="ns.e('command')"
          :disabled="disabled"
          :title="command.title || command.label"
          @click="runOverflowCommand(command)"
        >
          {{ command.label }}
        </button>
        <button
          v-for="action in overflowActions"
          :key="action.key"
          type="button"
          :class="[ns.e('command'), ns.e('command-tray-action')]"
          :disabled="disabled"
          @click="runOverflowAction(action)"
        >
          {{ action.label }}
        </button>
      </div>
    </header>

    <div :class="ns.e('body')">
      <textarea
        v-show="currentMode !== 'preview'"
        :id="textareaId"
        ref="textareaRef"
        :class="ns.e('textarea')"
        :aria-disabled="disabled"
        :disabled="disabled"
        :name="textareaName"
        :placeholder="effectivePlaceholder"
        :rows="minRows"
        :value="modelValue"
        @input="handleInput"
        @keydown="handleKeydown"
      />

      <el-markdown-renderer
        v-if="currentMode !== 'write'"
        :class="ns.e('preview')"
        :base-url="previewBaseUrl"
        :content="modelValue"
        :csp-nonce="previewCspNonce"
        :features="previewFeatures"
        mode="editor"
        @features-activated="emitRenderEvent('features-activated', $event)"
        @render-complete="emitRenderEvent('render-complete', $event)"
        @render-error="emitRenderEvent('render-error', $event)"
      />
    </div>

    <footer :class="ns.e('status')">
      <slot
        name="status"
        :characters="characterCount"
        :mode="currentMode"
        :words="wordCount"
      >
        <span>{{ characterCount }} chars</span>
        <span>{{ wordCount }} words</span>
      </slot>
    </footer>
  </section>
</template>

<script lang="ts" setup>
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  useId,
  watch,
} from 'vue'
import { ElMarkdownRenderer } from '@element-plus/components/markdown-renderer'
import { CHANGE_EVENT, UPDATE_MODEL_EVENT } from '@element-plus/constants'
import { useNamespace } from '@element-plus/hooks'
import {
  applyMarkdownEditorCommand,
  markdownEditorEmits,
  markdownEditorProps,
} from './markdown-editor'

import type {
  MarkdownEditorActionItem,
  MarkdownEditorActionKey,
  MarkdownEditorCommand,
  MarkdownEditorMode,
  MarkdownEditorSelection,
} from './markdown-editor'

defineOptions({
  name: 'ElMarkdownEditor',
})

const props = defineProps(markdownEditorProps)
const emit = defineEmits(markdownEditorEmits)
const ns = useNamespace('markdown-editor')
const modes: MarkdownEditorMode[] = ['write', 'split', 'preview']
const commandTrayId = `${useId()}-command-tray`
const textareaRef = ref<HTMLTextAreaElement | null>(null)
const commandsExpanded = ref(false)
const visualViewportHeight = ref(0)
const compactMode = computed(() => props.mobileLayout === 'compact')
const normalizeModeForLayout = (mode: MarkdownEditorMode): MarkdownEditorMode =>
  compactMode.value && mode === 'split' ? 'write' : mode
const currentMode = ref<MarkdownEditorMode>(
  normalizeModeForLayout(props.mode ?? props.defaultMode),
)

watch(
  [() => props.mode, () => props.defaultMode, () => props.mobileLayout],
  ([mode, defaultMode]) => {
    currentMode.value = normalizeModeForLayout(mode ?? defaultMode)
  },
)

const characterCount = computed(() => props.modelValue.length)
const effectivePlaceholder = computed(
  () => props.writingPlaceholder || props.placeholder,
)
const editorStyle = computed<Record<string, string> | undefined>(() =>
  visualViewportHeight.value > 0
    ? {
        '--el-markdown-editor-visual-viewport-height': `${visualViewportHeight.value}px`,
      }
    : undefined,
)
const primaryCommandKeySet = computed(() =>
  props.primaryCommandKeys?.length ? new Set(props.primaryCommandKeys) : null,
)
const primaryCommands = computed(() => {
  const keySet = primaryCommandKeySet.value
  return keySet
    ? props.commands.filter((command) => keySet.has(command.key))
    : props.commands.slice(0, 6)
})
const overflowCommands = computed(() => {
  const keySet = primaryCommandKeySet.value
  return keySet
    ? props.commands.filter((command) => !keySet.has(command.key))
    : props.commands.slice(6)
})
const visibleActions = computed<MarkdownEditorActionItem[]>(() => {
  if (!props.showActions) return []

  const actions: MarkdownEditorActionItem[] = []
  if (props.showImageAction) {
    actions.push({ key: 'image', label: props.imageActionLabel })
  }
  if (props.showSaveAction) {
    actions.push({ key: 'save', label: props.saveActionLabel })
  }
  if (props.showSubmitAction) {
    actions.push({ key: 'submit', label: props.submitActionLabel })
  }
  return actions
})
const actionOverflowKeySet = computed(
  () => new Set<MarkdownEditorActionKey>(props.actionOverflowKeys),
)
const primaryActions = computed(() =>
  visibleActions.value.filter(
    (action) => !actionOverflowKeySet.value.has(action.key),
  ),
)
const overflowActions = computed(() =>
  visibleActions.value.filter((action) =>
    actionOverflowKeySet.value.has(action.key),
  ),
)
const overflowItemCount = computed(
  () => overflowCommands.value.length + overflowActions.value.length,
)
const commandOverflowAriaLabel = computed(
  () => `${props.commandOverflowLabel}，${overflowItemCount.value} 个工具`,
)
const visibleModes = computed(() =>
  compactMode.value ? modes.filter((mode) => mode !== 'split') : modes,
)
const wordCount = computed(() => {
  const trimmed = props.modelValue.trim()
  return trimmed ? trimmed.split(/\s+/).length : 0
})

watch(
  [() => props.disabled, overflowItemCount],
  ([disabled, itemCount]) => {
    if (disabled || !itemCount) {
      commandsExpanded.value = false
    }
  },
)

const emitValue = (value: string) => {
  emit(UPDATE_MODEL_EVENT, value)
  emit(CHANGE_EVENT, value)
}

const updateVisualViewportHeight = () => {
  if (typeof window === 'undefined') return

  visualViewportHeight.value =
    window.visualViewport?.height || window.innerHeight || 0
}

onMounted(() => {
  updateVisualViewportHeight()
  window.visualViewport?.addEventListener('resize', updateVisualViewportHeight)
  window.visualViewport?.addEventListener('scroll', updateVisualViewportHeight)
  window.addEventListener('resize', updateVisualViewportHeight)
})

onBeforeUnmount(() => {
  if (typeof window === 'undefined') return

  window.visualViewport?.removeEventListener(
    'resize',
    updateVisualViewportHeight,
  )
  window.visualViewport?.removeEventListener(
    'scroll',
    updateVisualViewportHeight,
  )
  window.removeEventListener('resize', updateVisualViewportHeight)
})

const handleInput = (event: Event) => {
  if (props.disabled) return

  const target = event.target
  if (target instanceof HTMLTextAreaElement) {
    emitValue(target.value)
  }
}

const readSelection = (): MarkdownEditorSelection => {
  const textarea = textareaRef.value
  return {
    start: textarea?.selectionStart ?? props.modelValue.length,
    end: textarea?.selectionEnd ?? props.modelValue.length,
  }
}

const restoreSelection = async (selection: MarkdownEditorSelection) => {
  await nextTick()
  const textarea = textareaRef.value
  textarea?.focus()
  textarea?.setSelectionRange(
    Math.max(0, Math.min(props.modelValue.length, selection.start)),
    Math.max(0, Math.min(props.modelValue.length, selection.end)),
  )
}

const replaceValueRange = (
  start: number,
  end: number,
  replacement: string,
  nextSelection: MarkdownEditorSelection,
) => {
  const value = props.modelValue
  const safeStart = Math.max(0, Math.min(value.length, start))
  const safeEnd = Math.max(safeStart, Math.min(value.length, end))
  emitValue(value.slice(0, safeStart) + replacement + value.slice(safeEnd))
  void restoreSelection(nextSelection)
}

const selectedLineRange = () => {
  const value = props.modelValue
  const selection = readSelection()
  const rangeStart = Math.max(0, Math.min(value.length, selection.start))
  const rangeEnd = Math.max(rangeStart, Math.min(value.length, selection.end))
  const blockEndSeed =
    rangeEnd > rangeStart && value[rangeEnd - 1] === '\n'
      ? rangeEnd - 1
      : rangeEnd
  const lineStart = value.lastIndexOf('\n', Math.max(0, rangeStart - 1)) + 1
  const lineEndIndex = value.indexOf('\n', blockEndSeed)
  const lineEnd = lineEndIndex === -1 ? value.length : lineEndIndex
  return {
    lineEnd,
    lineStart,
    rangeEnd,
    rangeStart,
  }
}

const applyLineIndent = (outdent: boolean) => {
  const value = props.modelValue
  const { lineEnd, lineStart, rangeEnd, rangeStart } = selectedLineRange()
  const block = value.slice(lineStart, lineEnd)
  const lines = block.split('\n')
  let charsBeforeSelectionStart = 0
  let charsBeforeSelectionEnd = 0
  let originalOffset = 0

  const nextLines = lines.map((line) => {
    if (!outdent) {
      if (lineStart + originalOffset < rangeStart) {
        charsBeforeSelectionStart += 2
      }
      if (lineStart + originalOffset < rangeEnd) {
        charsBeforeSelectionEnd += 2
      }
      originalOffset += line.length + 1
      return `  ${line}`
    }

    const removable = line.startsWith('  ')
      ? 2
      : line.startsWith(' ') || line.startsWith('\t')
        ? 1
        : 0
    if (lineStart + originalOffset < rangeStart) {
      charsBeforeSelectionStart -= removable
    }
    if (lineStart + originalOffset < rangeEnd) {
      charsBeforeSelectionEnd -= removable
    }
    originalOffset += line.length + 1
    return removable > 0 ? line.slice(removable) : line
  })

  const replacement = nextLines.join('\n')
  replaceValueRange(lineStart, lineEnd, replacement, {
    start: Math.max(lineStart, rangeStart + charsBeforeSelectionStart),
    end: Math.max(lineStart, rangeEnd + charsBeforeSelectionEnd),
  })
}

const handleLineContinuation = () => {
  const value = props.modelValue
  const selection = readSelection()
  if (selection.start !== selection.end) return false

  const cursor = Math.max(0, Math.min(value.length, selection.start))
  const lineStart = value.lastIndexOf('\n', Math.max(0, cursor - 1)) + 1
  const beforeCursor = value.slice(lineStart, cursor)
  const unordered = beforeCursor.match(
    /^(\s*)([-*+])\s+(?:(\[[ xX]\])\s+)?(.*)$/u,
  )

  if (unordered) {
    const [, indent, marker, taskMarker, text] = unordered
    if (!text.trim()) {
      replaceValueRange(lineStart, cursor, indent, {
        start: lineStart + indent.length,
        end: lineStart + indent.length,
      })
      return true
    }

    const nextMarker = `${indent}${marker} ${taskMarker ? '[ ] ' : ''}`
    replaceValueRange(cursor, cursor, `\n${nextMarker}`, {
      start: cursor + nextMarker.length + 1,
      end: cursor + nextMarker.length + 1,
    })
    return true
  }

  const ordered = beforeCursor.match(/^(\s*)(\d+)([.)])\s+(.*)$/u)
  if (ordered) {
    const [, indent, numberText, suffix, text] = ordered
    if (!text.trim()) {
      replaceValueRange(lineStart, cursor, indent, {
        start: lineStart + indent.length,
        end: lineStart + indent.length,
      })
      return true
    }

    const nextMarker = `${indent}${Number(numberText) + 1}${suffix} `
    replaceValueRange(cursor, cursor, `\n${nextMarker}`, {
      start: cursor + nextMarker.length + 1,
      end: cursor + nextMarker.length + 1,
    })
    return true
  }

  const quote = beforeCursor.match(/^(\s*> ?)(.*)$/u)
  if (quote) {
    const [, marker, text] = quote
    if (!text.trim()) {
      replaceValueRange(lineStart, cursor, '', {
        start: lineStart,
        end: lineStart,
      })
      return true
    }

    replaceValueRange(cursor, cursor, `\n${marker}`, {
      start: cursor + marker.length + 1,
      end: cursor + marker.length + 1,
    })
    return true
  }

  return false
}

const runCommand = (command: MarkdownEditorCommand) => {
  if (props.disabled) return

  const result = applyMarkdownEditorCommand(
    props.modelValue,
    readSelection(),
    command,
  )
  emitValue(result.value)
  emit('command', command)
  if (result.nextSelection) {
    void restoreSelection(result.nextSelection)
  }
}

const runOverflowCommand = (command: MarkdownEditorCommand) => {
  runCommand(command)
  commandsExpanded.value = false
}

const runAction = (action: MarkdownEditorActionItem) => {
  if (action.key === 'image') {
    emitUploadImage()
    return
  }
  if (action.key === 'save') {
    emitSave()
    return
  }
  emitSubmit()
}

const runOverflowAction = (action: MarkdownEditorActionItem) => {
  runAction(action)
  commandsExpanded.value = false
}

const toggleCommands = () => {
  if (props.disabled) return

  commandsExpanded.value = !commandsExpanded.value
}

const setMode = (mode: MarkdownEditorMode) => {
  if (props.disabled) return

  const nextMode = normalizeModeForLayout(mode)
  currentMode.value = nextMode
  emit('mode-change', nextMode)
}

const modeLabel = (mode: MarkdownEditorMode) => {
  if (mode === 'split') return '分屏'
  return mode === 'preview' ? '预览' : '编写'
}

const emitSave = () => {
  if (props.disabled) return

  emit('save', props.modelValue)
}

const emitSubmit = () => {
  if (props.disabled) return

  emit('submit', props.modelValue)
}

const emitUploadImage = () => {
  if (props.disabled) return

  emit('upload-image')
}

const emitRenderEvent = (
  event: 'features-activated' | 'render-complete' | 'render-error',
  payload: unknown,
) => {
  if (event === 'features-activated') {
    emit('features-activated', payload)
    return
  }
  if (event === 'render-complete') {
    emit('render-complete', payload)
    return
  }
  emit('render-error', payload)
}

const handleKeydown = (event: KeyboardEvent) => {
  if (props.disabled) return

  if (event.key === 'Tab') {
    event.preventDefault()
    applyLineIndent(event.shiftKey)
    return
  }

  if (
    event.key === 'Enter' &&
    !event.altKey &&
    !event.ctrlKey &&
    !event.metaKey &&
    !event.shiftKey &&
    handleLineContinuation()
  ) {
    event.preventDefault()
    return
  }

  const isMod = event.metaKey || event.ctrlKey
  if (!isMod) return

  const key = event.key.toLowerCase()
  if (key === 's') {
    event.preventDefault()
    emitSave()
    return
  }
  if (key === 'enter') {
    event.preventDefault()
    emitSubmit()
    return
  }

  const command = props.commands.find((item) => {
    const shortcut = item.shortcut?.toLowerCase()
    return shortcut === `mod+${key}`
  })

  if (command) {
    event.preventDefault()
    runCommand(command)
  }
}

const insertMarkdownAtCursor = (markdown: string) => {
  if (props.disabled) return false

  const selection = readSelection()
  const start = Math.max(0, Math.min(props.modelValue.length, selection.start))
  const end = Math.max(0, Math.min(props.modelValue.length, selection.end))
  const value =
    props.modelValue.slice(0, start) + markdown + props.modelValue.slice(end)
  const cursor = start + markdown.length

  emitValue(value)
  void restoreSelection({ start: cursor, end: cursor })

  return true
}

defineExpose({
  insertMarkdownAtCursor,
})
</script>
