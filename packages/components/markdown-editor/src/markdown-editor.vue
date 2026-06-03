<template>
  <section :class="[ns.b(), ns.m(currentMode)]">
    <header :class="ns.e('toolbar')">
      <div :class="ns.e('commands')">
        <button
          v-for="command in commands"
          :key="command.key"
          type="button"
          :class="ns.e('command')"
          :title="command.title || command.label"
          @click="runCommand(command)"
        >
          {{ command.label }}
        </button>
      </div>

      <div :class="ns.e('modes')" role="tablist" aria-label="Markdown mode">
        <button
          v-for="mode in modes"
          :key="mode"
          type="button"
          role="tab"
          :aria-selected="currentMode === mode"
          :class="[ns.e('mode'), ns.is('active', currentMode === mode)]"
          @click="setMode(mode)"
        >
          {{ mode }}
        </button>
      </div>

      <div :class="ns.e('actions')">
        <button type="button" :class="ns.e('action')" @click="emitUploadImage">
          Image
        </button>
        <button type="button" :class="ns.e('action')" @click="emitSave">
          Save
        </button>
        <button type="button" :class="ns.e('action')" @click="emitSubmit">
          Submit
        </button>
      </div>
    </header>

    <div :class="ns.e('body')">
      <textarea
        v-show="currentMode !== 'preview'"
        ref="textareaRef"
        :class="ns.e('textarea')"
        :placeholder="placeholder"
        :rows="minRows"
        :value="modelValue"
        @input="handleInput"
        @keydown="handleKeydown"
      />

      <div v-if="currentMode !== 'write'" :class="ns.e('preview')">
        <el-markdown-renderer
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
const currentMode = ref<MarkdownEditorMode>(props.defaultMode)
const textareaRef = ref<HTMLTextAreaElement | null>(null)

watch(
  () => props.defaultMode,
  (mode) => {
    currentMode.value = mode
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
  currentMode.value = mode
  emit('mode-change', mode)
}

const emitSave = () => {
  emit('save', props.modelValue)
}

const emitSubmit = () => {
  emit('submit', props.modelValue)
}

const emitUploadImage = () => {
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
</script>
