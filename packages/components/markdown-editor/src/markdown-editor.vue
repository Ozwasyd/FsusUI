<template>
  <section :class="[ns.b(), ns.m(currentMode)]">
    <header :class="ns.e('toolbar')">
      <div :class="ns.e('commands')">
        <button
          v-for="command in commands"
          :key="command.key"
          type="button"
          :class="ns.e('command')"
          :disabled="disabled"
          :title="command.title || command.label"
          @click="runCommand(command)"
        >
          {{ command.label }}
        </button>
      </div>

      <div
        v-if="showModeSwitcher"
        :class="ns.e('modes')"
        role="tablist"
        aria-label="Markdown mode"
      >
        <button
          v-for="mode in modes"
          :key="mode"
          type="button"
          role="tab"
          :aria-selected="currentMode === mode"
          :class="[ns.e('mode'), ns.is('active', currentMode === mode)]"
          :disabled="disabled"
          @click="setMode(mode)"
        >
          {{ mode }}
        </button>
      </div>

      <div
        v-if="showActions && (showImageAction || showSaveAction || showSubmitAction)"
        :class="ns.e('actions')"
      >
        <button
          v-if="showImageAction"
          type="button"
          :class="ns.e('action')"
          :disabled="disabled"
          @click="emitUploadImage"
        >
          Image
        </button>
        <button
          v-if="showSaveAction"
          type="button"
          :class="ns.e('action')"
          :disabled="disabled"
          @click="emitSave"
        >
          Save
        </button>
        <button
          v-if="showSubmitAction"
          type="button"
          :class="ns.e('action')"
          :disabled="disabled"
          @click="emitSubmit"
        >
          Submit
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
        :placeholder="placeholder"
        :rows="minRows"
        :value="modelValue"
        @input="handleInput"
        @keydown="handleKeydown"
      />

      <el-markdown-renderer
        v-if="currentMode !== 'write'"
        :class="ns.e('preview')"
        :allow-html="allowHtml"
        :base-url="previewBaseUrl"
        :content="modelValue"
        :csp-nonce="previewCspNonce"
        :features="previewFeatures"
        mode="editor"
        :sanitize-html="sanitizeHtml"
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
import { computed, nextTick, ref, watch } from 'vue'
import { ElMarkdownRenderer } from '@element-plus/components/markdown-renderer'
import { CHANGE_EVENT, UPDATE_MODEL_EVENT } from '@element-plus/constants'
import { useNamespace } from '@element-plus/hooks'
import {
  applyMarkdownEditorCommand,
  markdownEditorEmits,
  markdownEditorProps,
} from './markdown-editor'

import type {
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
const currentMode = ref<MarkdownEditorMode>(props.mode ?? props.defaultMode)
const textareaRef = ref<HTMLTextAreaElement | null>(null)

watch(
  [() => props.mode, () => props.defaultMode],
  ([mode, defaultMode]) => {
    currentMode.value = mode ?? defaultMode
  },
)

const characterCount = computed(() => props.modelValue.length)
const wordCount = computed(() => {
  const trimmed = props.modelValue.trim()
  return trimmed ? trimmed.split(/\s+/).length : 0
})

const emitValue = (value: string) => {
  emit(UPDATE_MODEL_EVENT, value)
  emit(CHANGE_EVENT, value)
}

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
  textarea?.setSelectionRange(selection.start, selection.end)
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

const setMode = (mode: MarkdownEditorMode) => {
  if (props.disabled) return

  currentMode.value = mode
  emit('mode-change', mode)
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
