<template>
  <Teleport to="body">
    <div
      v-if="commandPaletteEnabled && commandPaletteOpen"
      :class="ns.e('palette-backdrop')"
      :dir="commandPaletteDirection"
      @mousedown.self.prevent="emit('close-palette')"
    >
      <section
        :class="ns.e('palette-dialog')"
        role="dialog"
        aria-modal="true"
        :aria-label="localeText.commandPalette.title"
        @keydown="emit('palette-keydown', $event)"
      >
        <label
          :for="`${paletteListId}-search`"
          :class="[ns.e('palette-group-label'), ns.e('palette-search-label')]"
        >
          {{ localeText.commandPalette.searchPlaceholder }}
        </label>
        <input
          :id="`${paletteListId}-search`"
          ref="paletteInputRef"
          :value="paletteQuery"
          type="text"
          :class="ns.e('palette-input')"
          :aria-label="localeText.commandPalette.searchPlaceholder"
          :placeholder="localeText.commandPalette.searchPlaceholder"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded="true"
          :aria-controls="paletteListId"
          :aria-activedescendant="
            activePaletteCommand
              ? paletteItemId(activePaletteCommand.key)
              : undefined
          "
          @input="
            emit(
              'update:paletteQuery',
              ($event.target as HTMLInputElement).value,
            )
          "
          @keydown.down.prevent="emit('select-next-palette')"
          @keydown.up.prevent="emit('select-prev-palette')"
          @keydown.enter="emit('execute-active-palette', $event)"
        />
        <div :id="paletteListId" :class="ns.e('palette-list')" role="listbox">
          <div
            v-for="group in paletteCommandGroups"
            :key="group.key"
            :class="ns.e('palette-group')"
            role="group"
            :aria-label="commandGroupName(group.key)"
          >
            <div :class="ns.e('palette-group-label')">
              {{ commandGroupName(group.key) }}
            </div>
            <button
              v-for="item in group.commands"
              :id="paletteItemId(item.key)"
              :key="item.key"
              type="button"
              :class="[
                ns.e('palette-item'),
                ns.is('active', paletteItemIndex(item.key) === activePaletteIndex),
              ]"
              role="option"
              :aria-selected="paletteItemIndex(item.key) === activePaletteIndex"
              :aria-describedby="commandDescriptionId(item.command)"
              :disabled="isCommandDisabled(item.command)"
              @click="emit('execute-palette-command', item.command)"
            >
              <span>{{ commandName(item.command) }}</span>
              <kbd v-if="item.shortcut">{{ item.shortcut }}</kbd>
            </button>
          </div>
          <p v-if="!paletteCommandCount" :class="ns.e('palette-empty')">
            {{ localeText.commandPalette.empty }}
          </p>
        </div>
        <p :class="ns.e('visually-hidden')" aria-live="polite">
          {{ localeText.commandPalette.results(paletteCommandCount) }}
        </p>
      </section>
    </div>

    <div
      v-if="pasteSession"
      :class="ns.e('paste-backdrop')"
      @mousedown.self.prevent
    >
      <section
        ref="pasteDialogRef"
        :class="ns.e('paste-dialog')"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="pasteTitleId"
        :aria-describedby="pasteHelpId"
        @keydown="emit('paste-keydown', $event)"
      >
        <header :class="ns.e('paste-header')">
          <h2 :id="pasteTitleId">
            {{ localeText.pasteAsMarkdown.title }}
          </h2>
          <p :id="pasteHelpId">
            {{ localeText.pasteAsMarkdown.description }}
          </p>
        </header>

        <div :class="ns.e('paste-content')">
          <section
            :class="ns.e('paste-preview')"
            role="region"
            :aria-label="localeText.pasteAsMarkdown.markdownPreview"
          >
            <h3>{{ localeText.pasteAsMarkdown.markdownPreview }}</h3>
            <pre>{{ pasteSession.preview.markdown }}</pre>
          </section>

          <section
            :class="ns.e('paste-diff')"
            role="region"
            :aria-label="localeText.pasteAsMarkdown.sourceDiff"
          >
            <h3>{{ localeText.pasteAsMarkdown.sourceDiff }}</h3>
            <div :class="ns.e('paste-diff-columns')">
              <div>
                <h4>{{ localeText.pasteAsMarkdown.sourceBefore }}</h4>
                <pre>{{ pasteSession.preview.diff.before }}</pre>
              </div>
              <div>
                <h4>{{ localeText.pasteAsMarkdown.sourceAfter }}</h4>
                <pre>{{ pasteSession.preview.diff.after }}</pre>
              </div>
            </div>
          </section>

          <div
            v-if="pasteSession.preview.warnings.length"
            :class="ns.e('paste-warnings')"
            role="region"
            :aria-label="localeText.pasteAsMarkdown.conversionWarnings"
          >
            <h3>{{ localeText.pasteAsMarkdown.conversionWarnings }}</h3>
            <ul :aria-label="localeText.pasteAsMarkdown.conversionWarnings">
              <li
                v-for="warning in pasteSession.preview.warnings"
                :key="`${warning.kind}:${warning.code}:${warning.detail || ''}`"
              >
                <strong>{{ warning.kind }}</strong
                >: {{ warning.code
                }}<span v-if="warning.detail"> — {{ warning.detail }}</span>
              </li>
            </ul>
          </div>

          <p v-if="pasteError" role="alert">
            {{ pasteError }}
          </p>
        </div>

        <footer :class="ns.e('paste-actions')">
          <button
            type="button"
            @click="emit('confirm-paste', 'plain-text')"
          >
            {{ localeText.pasteAsMarkdown.pastePlainText }}
          </button>
          <button
            ref="pastePrimaryActionRef"
            type="button"
            @click="emit('confirm-paste', 'markdown-import')"
          >
            {{ localeText.pasteAsMarkdown.importMarkdown }}
          </button>
          <button type="button" @click="emit('cancel-paste')">
            {{ localeText.pasteAsMarkdown.cancel }}
          </button>
        </footer>
      </section>
    </div>
  </Teleport>
</template>

<script lang="ts" setup>
import { ref } from 'vue'
import { useNamespace } from '@element-plus/hooks'
import type {
  MarkdownEditorCommand,
  MarkdownEditorLocaleText,
} from '../markdown-editor'
import type { MarkdownEditorCommandSnapshotItem } from '../markdown-editor-command-snapshot'
import type {
  MarkdownPasteAsMarkdownChoice,
  MarkdownPasteAsMarkdownSession,
} from '../markdown-editor-paste-markdown'

export interface MarkdownCommandGroupView {
  readonly commands: readonly MarkdownEditorCommandSnapshotItem[]
  readonly key: string
}

defineProps<{
  activePaletteCommand?: MarkdownEditorCommand
  activePaletteIndex: number
  commandDescriptionId: (command: MarkdownEditorCommand) => string | undefined
  commandGroupName: (group: string) => string
  commandName: (command: MarkdownEditorCommand) => string
  commandPaletteDirection: 'ltr' | 'rtl'
  commandPaletteEnabled: boolean
  commandPaletteOpen: boolean
  isCommandDisabled: (command: MarkdownEditorCommand) => boolean
  localeText: MarkdownEditorLocaleText
  paletteCommandCount: number
  paletteCommandGroups: readonly MarkdownCommandGroupView[]
  paletteItemId: (key: string) => string
  paletteItemIndex: (key: string) => number
  paletteListId: string
  paletteQuery: string
  pasteError: string
  pasteHelpId: string
  pasteSession: MarkdownPasteAsMarkdownSession | null
  pasteTitleId: string
}>()

const emit = defineEmits<{
  'cancel-paste': []
  'close-palette': []
  'confirm-paste': [choice: Exclude<MarkdownPasteAsMarkdownChoice, 'cancel'>]
  'execute-active-palette': [event: KeyboardEvent]
  'execute-palette-command': [command: MarkdownEditorCommand]
  'palette-keydown': [event: KeyboardEvent]
  'paste-keydown': [event: KeyboardEvent]
  'select-next-palette': []
  'select-prev-palette': []
  'update:paletteQuery': [value: string]
}>()

const ns = useNamespace('markdown-editor')
const paletteInputRef = ref<HTMLInputElement | null>(null)
const pasteDialogRef = ref<HTMLElement | null>(null)
const pastePrimaryActionRef = ref<HTMLButtonElement | null>(null)

const focusPaletteInput = () => {
  paletteInputRef.value?.focus()
}

const getPaletteInputElement = () => paletteInputRef.value

const focusPastePrimaryAction = () => {
  pastePrimaryActionRef.value?.focus()
}

const getPasteDialogElement = () => pasteDialogRef.value

defineExpose({
  focusPaletteInput,
  focusPastePrimaryAction,
  getPaletteInputElement,
  getPasteDialogElement,
})
</script>
