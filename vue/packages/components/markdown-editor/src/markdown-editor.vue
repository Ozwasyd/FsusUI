<template>
  <section
    v-bind="$attrs"
    :class="[
      ns.b(),
      ns.m(currentMode),
      ns.m(`chrome-${chrome}`),
      ns.m(`mobile-${mobileLayout}`),
      ns.m(`profile-${editorProfile}`),
      ns.m(`interaction-${interactionProfile}`),
      ns.m(`toolbar-${toolbarDensity}`),
      ns.is('commands-expanded', commandsExpanded),
    ]"
    role="region"
    :aria-label="localeText.editorAria"
    :data-markdown-instance="commandTrayId"
    data-markdown-scroll-container="body"
    :style="editorStyle"
  >
    <header
      v-if="chromeRegions.toolbar && surfaceOptions.toolbar"
      :class="ns.e('toolbar')"
    >
      <div :class="ns.e('commands')">
        <button
          v-for="command in primaryCommands"
          :key="command.key"
          type="button"
          :class="ns.e('command')"
          :disabled="isCommandDisabled(command)"
          :aria-describedby="commandDescriptionId(command)"
          :aria-label="command.title || command.label"
          :title="command.title || command.label"
          @click="activateCommand(command)"
        >
          {{ command.label }}
        </button>
        <button
          v-if="gatedPasteAsMarkdownCommand"
          type="button"
          :class="ns.e('command')"
          disabled
          :aria-describedby="pasteAsMarkdownDescriptionId"
          :aria-label="
            gatedPasteAsMarkdownCommand.title ||
            gatedPasteAsMarkdownCommand.label
          "
          :title="
            gatedPasteAsMarkdownCommand.title ||
            gatedPasteAsMarkdownCommand.label
          "
        >
          {{ gatedPasteAsMarkdownCommand.label }}
        </button>
        <button
          v-if="overflowItemCount"
          type="button"
          :class="[ns.e('command-more'), ns.is('expanded', commandsExpanded)]"
          :aria-expanded="commandsExpanded"
          :aria-controls="commandTrayId"
          :aria-label="commandOverflowAriaLabel"
          aria-haspopup="true"
          :disabled="editingBlocked"
          @click="toggleCommands"
        >
          <span>{{ commandOverflowLabel }}</span>
          <span :class="ns.e('command-more-count')">{{
            overflowItemCount
          }}</span>
        </button>
      </div>

      <div
        v-if="showModeSwitcher"
        :class="ns.e('modes')"
        role="tablist"
        :aria-label="localeText.modeSwitcherAria"
      >
        <button
          v-for="mode in visibleModes"
          :key="mode"
          type="button"
          role="tab"
          :aria-selected="currentMode === mode"
          :class="[
            ns.e('mode'),
            `${ns.e('mode')}--${mode}`,
            ns.is('active', currentMode === mode),
          ]"
          :disabled="editingBlocked"
          @click="setMode(mode)"
        >
          {{ modeLabel(mode) }}
        </button>
      </div>

      <div v-if="primaryActions.length" :class="ns.e('actions')">
        <button
          v-for="action in primaryActions"
          :key="action.key"
          type="button"
          :class="ns.e('action')"
          :disabled="editingBlocked"
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
          :disabled="isCommandDisabled(command)"
          :aria-describedby="commandDescriptionId(command)"
          :aria-label="command.title || command.label"
          :title="command.title || command.label"
          @click="activateOverflowCommand(command)"
        >
          {{ command.label }}
        </button>
        <button
          v-for="action in overflowActions"
          :key="action.key"
          type="button"
          :class="[ns.e('command'), ns.e('command-tray-action')]"
          :disabled="editingBlocked"
          @click="runOverflowAction(action)"
        >
          {{ action.label }}
        </button>
      </div>
      <span
        v-if="pasteAsMarkdownGate"
        :id="pasteAsMarkdownDescriptionId"
        :class="ns.e('visually-hidden')"
      >
        {{ pasteAsMarkdownGateDescription }}
      </span>
    </header>

    <div
      :class="ns.e('body')"
      data-markdown-scroll-container="body"
      :data-markdown-reveal-state="liveReveal.state"
      :data-markdown-surface-owner="liveSurface.inputOwner"
      :data-markdown-atomic-kind="liveAtomic?.kind || undefined"
      :data-markdown-atomic-status="liveAtomic?.state || undefined"
      :data-markdown-layout-action="liveLayout.action"
      :data-markdown-layout-smooth="liveLayout.smooth ? 'true' : 'false'"
    >
      <textarea
        :id="textareaId"
        ref="textareaRef"
        :class="ns.e('textarea')"
        :aria-hidden="liveSurface.inputVisible ? undefined : 'true'"
        :aria-label="textareaAriaLabel"
        :aria-busy="loading || undefined"
        :aria-disabled="editingBlocked"
        :aria-readonly="props.readonly || undefined"
        :disabled="inputDisabled"
        :readonly="props.readonly"
        :hidden="!liveSurface.inputVisible || undefined"
        :name="textareaName"
        :placeholder="effectivePlaceholder"
        :rows="minRows"
        :tabindex="liveSurface.inputVisible ? undefined : -1"
        :value="editorValue"
        @beforeinput="handleBeforeInput"
        @blur="handleBlur"
        @click="handlePointerReveal"
        @compositionend="handleCompositionEnd"
        @compositionstart="handleCompositionStart"
        @contextmenu="handleTableContextMenu"
        @copy="handleCopy"
        @cut="handleCut"
        @drop="handleDrop"
        @input="handleInput"
        @keydown="handleKeydown"
        @paste="handlePaste"
        @scroll="handleLayoutScroll"
        @select="handleSelectionMove"
        @touchmove="handleLayoutTouch"
        @wheel="handleLayoutWheel"
      />

      <div
        v-if="currentTableCell && !editingBlocked"
        :class="ns.e('table-context')"
      >
        <button
          ref="tableMenuTriggerRef"
          type="button"
          :class="ns.e('table-menu-trigger')"
          aria-haspopup="menu"
          :aria-controls="tableMenuId"
          :aria-expanded="tableMenuOpen"
          aria-label="表格操作"
          @click="toggleTableMenu"
        >
          表格操作
        </button>
        <div
          v-if="tableMenuOpen"
          :id="tableMenuId"
          ref="tableMenuRef"
          :class="ns.e('table-menu')"
          role="menu"
          aria-label="表格操作"
          @keydown="handleTableMenuKeydown"
        >
          <button
            v-for="action in tableContextActions"
            :key="action.key"
            type="button"
            role="menuitem"
            :data-group="action.group"
            :title="action.title"
            :aria-label="action.title"
            @click="runTableContextAction(action.key)"
          >
            {{ action.label }}
          </button>
        </div>
      </div>
      <span :class="ns.e('visually-hidden')" aria-live="polite">
        {{ tableAnnouncement }}
      </span>

      <div
        v-if="liveDecorations.length"
        :class="ns.e('live-decorations')"
        aria-hidden="true"
        data-markdown-live-decorations
      >
        <span
          v-for="decoration in liveDecorations"
          :key="decoration.nodeId"
          :data-kind="decoration.kind"
          :data-node-id="decoration.nodeId"
          :data-role="decoration.role"
        />
      </div>

      <el-markdown-renderer
        v-if="liveSurface.rendererVisible"
        ref="previewRef"
        :class="ns.e('preview')"
        :base-url="previewBaseUrl"
        :content="editorValue"
        :csp-nonce="previewCspNonce"
        :features="previewFeatures"
        mode="editor"
        @scroll="handlePreviewScroll"
        @features-activated="emitRenderEvent('features-activated', $event)"
        @render-complete="handlePreviewRenderComplete"
        @render-error="emitRenderEvent('render-error', $event)"
      />
    </div>

    <footer
      v-if="chromeRegions.status && statusDensity !== 'none'"
      :class="ns.e('status')"
    >
      <slot
        name="status"
        :characters="characterCount"
        :mode="currentMode"
        :words="wordCount"
      >
        <span>{{ characterCount }} {{ localeText.metrics.characters }}</span>
        <span v-if="statusDensity === 'detailed'">
          {{ wordCount }} {{ localeText.metrics.words }}
        </span>
      </slot>
    </footer>

    <Teleport to="body">
      <div
        v-if="pasteAsMarkdownSession"
        :class="ns.e('paste-backdrop')"
        @mousedown.self.prevent
      >
        <section
          ref="pasteAsMarkdownDialogRef"
          :class="ns.e('paste-dialog')"
          role="dialog"
          aria-modal="true"
          :aria-labelledby="pasteAsMarkdownTitleId"
          :aria-describedby="pasteAsMarkdownHelpId"
          @keydown="handlePasteAsMarkdownDialogKeydown"
        >
          <header :class="ns.e('paste-header')">
            <h2 :id="pasteAsMarkdownTitleId">
              {{ localeText.pasteAsMarkdown.title }}
            </h2>
            <p :id="pasteAsMarkdownHelpId">
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
              <pre>{{ pasteAsMarkdownSession.preview.markdown }}</pre>
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
                  <pre>{{ pasteAsMarkdownSession.preview.diff.before }}</pre>
                </div>
                <div>
                  <h4>{{ localeText.pasteAsMarkdown.sourceAfter }}</h4>
                  <pre>{{ pasteAsMarkdownSession.preview.diff.after }}</pre>
                </div>
              </div>
            </section>

            <div
              v-if="pasteAsMarkdownSession.preview.warnings.length"
              :class="ns.e('paste-warnings')"
              role="region"
              :aria-label="localeText.pasteAsMarkdown.conversionWarnings"
            >
              <h3>{{ localeText.pasteAsMarkdown.conversionWarnings }}</h3>
              <ul
                :aria-label="localeText.pasteAsMarkdown.conversionWarnings"
              >
                <li
                  v-for="warning in pasteAsMarkdownSession.preview.warnings"
                  :key="`${warning.kind}:${warning.code}:${warning.detail || ''}`"
                >
                  <strong>{{ warning.kind }}</strong
                  >: {{ warning.code
                  }}<span v-if="warning.detail"> — {{ warning.detail }}</span>
                </li>
              </ul>
            </div>

            <p v-if="pasteAsMarkdownError" role="alert">
              {{ pasteAsMarkdownError }}
            </p>
          </div>

          <footer :class="ns.e('paste-actions')">
            <button
              type="button"
              @click="confirmPasteAsMarkdownChoice('plain-text')"
            >
              {{ localeText.pasteAsMarkdown.pastePlainText }}
            </button>
            <button
              ref="pasteAsMarkdownPrimaryActionRef"
              type="button"
              @click="confirmPasteAsMarkdownChoice('markdown-import')"
            >
              {{ localeText.pasteAsMarkdown.importMarkdown }}
            </button>
            <button type="button" @click="cancelPasteAsMarkdownSurface">
              {{ localeText.pasteAsMarkdown.cancel }}
            </button>
          </footer>
        </section>
      </div>
    </Teleport>
  </section>
</template>

<script lang="ts" setup>
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  triggerRef,
  useId,
  watch,
} from 'vue'
import { ElMarkdownRenderer } from '@element-plus/components/markdown-renderer'
import { CHANGE_EVENT, UPDATE_MODEL_EVENT } from '@element-plus/constants'
import { useNamespace } from '@element-plus/hooks'
import {
  filterMarkdownEditorCommands,
  isMarkdownEditorCommandEnabled,
  isMarkdownEditorCommandVisible,
  markdownEditorEmits,
  markdownEditorProps,
  calculateMarkdownEditorMetrics,
  resolveMarkdownEditorLocaleText,
  resolveMarkdownEditorOverflowCommands,
  resolveMarkdownEditorPrimaryCommands,
  resolveMarkdownEditorShortcut,
  runMarkdownEditorCommand,
} from './markdown-editor'
import { resolveMarkdownEditorChromeRegions } from './markdown-editor-chrome'
import {
  deriveMarkdownEditorChange,
  MarkdownEditorTransactionStore,
  toMarkdownEditorTransactionEvent,
} from './markdown-editor-transaction'

import type {
  MarkdownEditorActionItem,
  MarkdownEditorActionKey,
  MarkdownEditorCommand,
  MarkdownEditorInsertOptions,
  MarkdownEditorMode,
  MarkdownEditorSurfaceOptions,
} from './markdown-editor'
import type {
  BeforeInputSnapshot,
  MarkdownEditorDispatchResult,
  MarkdownEditorHistoryState,
  MarkdownEditorInputMergeDirection,
  MarkdownEditorSelection,
  MarkdownEditorTransaction,
  MarkdownEditorTransactionRejection,
} from './markdown-editor-transaction'
import {
  resolveMarkdownBlockInputIntent,
  type MarkdownBlockInputKey,
} from './markdown-editor-input-intent'
import {
  MARKDOWN_PAIR_DEFAULTS,
  resolveMarkdownPairInput,
} from './markdown-editor-pair-input'
import {
  markdownClipboardItemsFromDataTransfer,
  resolveMarkdownClipboardCopy,
  resolveMarkdownClipboardCut,
  resolveMarkdownClipboardPaste,
  writeMarkdownClipboardPayload,
} from './markdown-editor-clipboard'
import {
  cancelMarkdownPasteAsMarkdown,
  confirmMarkdownPasteAsMarkdown,
  openMarkdownPasteAsMarkdown,
  type MarkdownPasteAsMarkdownChoice,
  type MarkdownPasteAsMarkdownSession,
} from './markdown-editor-paste-markdown'
import { createMarkdownEditorNativeEventMachine } from './markdown-editor-native-event'
import { createMarkdownLiveSurface } from './markdown-editor-live-surface'
import {
  resolveMarkdownLiveSyntaxReveal,
  type MarkdownLiveRevealIntent,
} from './markdown-editor-live-reveal'
import {
  resolveMarkdownAtomicNodeIntent,
  resolveMarkdownLiveSelectionMotion,
  retainMarkdownLiveSelection,
  type MarkdownAtomicNodePlan,
  type MarkdownAtomicNodeSession,
  type MarkdownLiveSelectionMotion,
} from './markdown-editor-live-selection'
import {
  resolveMarkdownLiveLayoutStability,
  resolveMarkdownLiveVirtualWindow,
  type MarkdownLiveLayoutGesture,
  type MarkdownLiveLayoutPlan,
  type MarkdownLiveLayoutTrigger,
  type MarkdownLiveVirtualWindow,
} from './markdown-editor-live-layout'
import {
  planMarkdownTableAlignColumn,
  planMarkdownTableDeleteColumn,
  planMarkdownTableDeleteRow,
  planMarkdownTableInsertColumn,
  planMarkdownTableInsertRow,
  resolveMarkdownTableCellAtOffset,
  resolveMarkdownTableCellCoordinates,
  type MarkdownTableCellIdentity,
} from './markdown-editor-table-structure'
import {
  planMarkdownTableFormat,
  planMarkdownTablePaste,
  resolveMarkdownTableInputIntent,
} from './markdown-editor-table-input'
import { resolveMarkdownTableContextActions } from './markdown-editor-table-acceptance'

import type { MarkdownHtmlImportSnapshot } from '../../../wasm/markdown-html-import'

defineOptions({
  name: 'ElMarkdownEditor',
  inheritAttrs: false,
})

const props = defineProps(markdownEditorProps)
const emit = defineEmits(markdownEditorEmits)
const ns = useNamespace('markdown-editor')
const modes: MarkdownEditorMode[] = ['source', 'live', 'split', 'preview']
const commandTrayId = `${useId()}-command-tray`
const textareaRef = ref<HTMLTextAreaElement | null>(null)
const pasteAsMarkdownDialogRef = ref<HTMLElement | null>(null)
const pasteAsMarkdownPrimaryActionRef = ref<HTMLButtonElement | null>(null)
const pasteAsMarkdownSession = ref<MarkdownPasteAsMarkdownSession | null>(null)
const pasteAsMarkdownError = ref('')
const pasteAsMarkdownBusy = ref(false)
const pasteAsMarkdownDescriptionId = `${useId()}-paste-as-markdown-description`
const pasteAsMarkdownTitleId = `${useId()}-paste-as-markdown-title`
const pasteAsMarkdownHelpId = `${useId()}-paste-as-markdown-help`
const tableMenuId = `${useId()}-table-menu`
const commandsExpanded = ref(false)
const tableMenuOpen = ref(false)
const tableMenuRef = ref<HTMLElement | null>(null)
const tableMenuTriggerRef = ref<HTMLButtonElement | null>(null)
const previewRef = ref<HTMLElement | { $el?: HTMLElement } | null>(null)
const retainedPreviewScrollLeft = ref(0)
const visualViewportHeight = ref(0)
const inputDisabled = computed(() => props.disabled || props.loading)
const editingBlocked = computed(() => props.readonly || inputDisabled.value)
const surfaceOptions = computed<Required<MarkdownEditorSurfaceOptions>>(() => ({
  commandPalette: props.surfaces.commandPalette ?? false,
  selectionToolbar: props.surfaces.selectionToolbar ?? false,
  slashMenu: props.surfaces.slashMenu ?? false,
  toolbar: props.surfaces.toolbar ?? true,
}))
const chromeRegions = computed(() =>
  resolveMarkdownEditorChromeRegions(props.chrome, {
    toolbar: surfaceOptions.value.toolbar,
    status: props.statusDensity !== 'none',
  }),
)
const textareaAriaLabel = computed(() =>
  currentMode.value === 'live' ? 'Markdown editor live editing surface' : 'Markdown editor source',
)
const compactMode = computed(() => props.mobileLayout === 'compact')
const normalizeModeForLayout = (
  mode: MarkdownEditorMode,
): MarkdownEditorMode =>
  compactMode.value && mode === 'split' ? 'source' : mode
const currentMode = ref<MarkdownEditorMode>(
  normalizeModeForLayout(props.mode ?? props.defaultMode),
)
const initialSelection: MarkdownEditorSelection = {
  direction: 'none',
  end: props.modelValue.length,
  start: props.modelValue.length,
}
const documentIdentity = Object.freeze({ epoch: 0, id: commandTrayId })
const transactionStore = new MarkdownEditorTransactionStore(
  props.modelValue,
  initialSelection,
  documentIdentity,
)
const editorValue = ref(transactionStore.value)
const currentTableCell = ref<MarkdownTableCellIdentity | null>(null)
const tableAnnouncement = ref('')
const tableContextActions = computed(() =>
  resolveMarkdownTableContextActions().filter(
    (action) => action.key !== 'delete-row' || currentTableCell.value?.row !== 0,
  ),
)
const liveSurface = computed(() =>
  createMarkdownLiveSurface({
    documentIdentity,
    mode: currentMode.value,
    revision: transactionStore.revision,
    source: editorValue.value,
  }),
)
const liveReveal = ref(
  resolveMarkdownLiveSyntaxReveal({
    documentIdentity,
    mode: currentMode.value,
    selection: transactionStore.selection,
    source: editorValue.value,
  }),
)
const isComposing = ref(false)
const pasteAsMarkdownGate = computed<
  'composition' | 'readonly' | 'disabled' | 'loading' | 'previewOnly' | null
>(() => {
  if (isComposing.value) return 'composition'
  if (props.readonly) return 'readonly'
  if (props.loading) return 'loading'
  if (props.disabled) return 'disabled'
  if (currentMode.value === 'preview') return 'previewOnly'
  return null
})
const atomicSession = ref<MarkdownAtomicNodeSession | null>(null)
const liveAtomic = ref<MarkdownAtomicNodePlan | null>(null)
const layoutGesture = ref<MarkdownLiveLayoutGesture | null>(null)
const liveWindow = ref<MarkdownLiveVirtualWindow | null>(null)
const liveLayout = ref<MarkdownLiveLayoutPlan>(
  resolveMarkdownLiveLayoutStability({
    documentIdentity,
    revision: transactionStore.revision,
    selection: transactionStore.selection,
    source: editorValue.value,
    trigger: 'block-height-change',
  }),
)
let layoutGestureTimer: ReturnType<typeof setTimeout> | undefined
let restoringViewport = false
const liveDecorations = computed(() => {
  const decorations = liveSurface.value.decorations
  if (currentMode.value !== 'live' || !liveWindow.value) return decorations
  const mounted = new Set(liveWindow.value.mountedNodeIds)
  return decorations.filter((decoration) => mounted.has(decoration.nodeId))
})
const restoreTextareaViewport = (plan: MarkdownLiveLayoutPlan) => {
  const textarea = textareaRef.value
  if (!textarea || plan.action !== 'restore' || !plan.anchor) return
  const line =
    transactionStore.value.slice(0, plan.anchor.sourceOffset).split('\n')
      .length - 1
  const lineHeight =
    Number.parseFloat(window.getComputedStyle(textarea).lineHeight) || 20
  const next = Math.max(0, line * lineHeight - textarea.clientHeight / 3)
  if (Math.abs(textarea.scrollTop - next) <= 1) return
  restoringViewport = true
  textarea.scrollTop = next
  queueMicrotask(() => {
    restoringViewport = false
  })
}
const applyLiveLayout = (
  trigger: MarkdownLiveLayoutTrigger,
  extras: {
    readonly gesture?: MarkdownLiveLayoutGesture | null
    readonly reducedMotion?: boolean
  } = {},
) => {
  const plan = resolveMarkdownLiveLayoutStability({
    composing: isComposing.value,
    documentIdentity,
    gesture: extras.gesture ?? layoutGesture.value,
    previousAnchor: liveLayout.value.anchor,
    reducedMotion: extras.reducedMotion,
    revision: transactionStore.revision,
    selection: transactionStore.selection,
    source: transactionStore.value,
    trigger,
  })
  liveLayout.value = plan
  if (plan.action === 'restore') restoreTextareaViewport(plan)
  return plan
}
const refreshLiveWindow = (
  origin: 'input' | 'document-switch' | 'mode-switch' | 'feature' | 'initial',
) => {
  liveWindow.value = resolveMarkdownLiveVirtualWindow({
    documentIdentity,
    origin,
    previousMountedNodeIds: liveWindow.value?.mountedNodeIds,
    selection: transactionStore.selection,
    source: transactionStore.value,
  })
}
const markLayoutGesture = (gesture: MarkdownLiveLayoutGesture) => {
  layoutGesture.value = gesture
  applyLiveLayout('block-height-change', { gesture })
  if (layoutGestureTimer) clearTimeout(layoutGestureTimer)
  layoutGestureTimer = setTimeout(() => {
    layoutGesture.value = null
  }, 200)
}
const handleLayoutWheel = () => markLayoutGesture('wheel')
const handleLayoutTouch = () => markLayoutGesture('touch')
const handleLayoutScroll = () => {
  if (restoringSelection || restoringViewport) return
  markLayoutGesture('scrollbar')
}
const previewElement = () => {
  const current = previewRef.value
  if (!current) return null
  return current instanceof HTMLElement ? current : (current.$el ?? null)
}
const handlePreviewScroll = () => {
  retainedPreviewScrollLeft.value = previewElement()?.scrollLeft ?? 0
}
const restorePreviewScroll = () => {
  void nextTick(() => {
    const preview = previewElement()
    if (preview) preview.scrollLeft = retainedPreviewScrollLeft.value
  })
}
const refreshLiveReveal = (
  extras: {
    readonly intent?: MarkdownLiveRevealIntent
    readonly pointerOffset?: number
  } = {},
) => {
  const previousState = liveReveal.value.state
  liveReveal.value = resolveMarkdownLiveSyntaxReveal({
    composing: isComposing.value,
    documentIdentity,
    intent: extras.intent,
    mode: currentMode.value,
    pointerOffset: extras.pointerOffset,
    previous: liveReveal.value,
    selection: transactionStore.selection,
    source: transactionStore.value,
  })
  if (previousState === 'inactive' && liveReveal.value.state !== 'inactive') {
    applyLiveLayout('marker-reveal')
  } else if (
    previousState !== 'inactive' &&
    liveReveal.value.state === 'inactive'
  ) {
    applyLiveLayout('marker-hide')
  }
}

const applyLiveSelectionMotion = (
  motion: MarkdownLiveSelectionMotion,
  extras: {
    readonly dragOffset?: number
    readonly pointerOffset?: number
    readonly shift?: boolean
  } = {},
) => {
  const plan = resolveMarkdownLiveSelectionMotion({
    composing: isComposing.value,
    documentIdentity,
    dragOffset: extras.dragOffset,
    mode: currentMode.value,
    motion,
    pointerOffset: extras.pointerOffset,
    revision: transactionStore.revision,
    selection: captureSelection(false),
    session: atomicSession.value,
    shift: extras.shift,
    source: transactionStore.value,
  })
  liveAtomic.value = plan.atomic
  atomicSession.value = plan.atomic?.session ?? null
  if (!plan.transaction) return plan
  dispatchTransaction(plan.transaction)
  refreshLiveReveal()
  return plan
}

const applyAtomicIntent = (
  action: Parameters<typeof resolveMarkdownAtomicNodeIntent>[0]['action'],
) => {
  const plan = resolveMarkdownAtomicNodeIntent({
    action,
    composing: isComposing.value,
    documentIdentity,
    mode: currentMode.value,
    revision: transactionStore.revision,
    selection: captureSelection(),
    session: atomicSession.value,
    source: transactionStore.value,
  })
  liveAtomic.value = plan.state === 'unsupported' ? null : plan
  atomicSession.value = plan.session
  if (plan.transaction) dispatchTransaction(plan.transaction)
  refreshLiveReveal()
  return plan
}
const pendingCommandKeys = ref(new Set<string>())
const commandControllers = new Map<string, AbortController>()
const commandContextSignal = new AbortController().signal

const abortPendingCommands = () => {
  for (const controller of commandControllers.values()) controller.abort()
  commandControllers.clear()
  pendingCommandKeys.value = new Set()
}

type EditorOperation =
  | {
      readonly allowBlocked?: boolean
      readonly emitValue?: boolean
      readonly internalPropReset?: boolean
      readonly kind: 'transaction'
      readonly mergeDirection?: MarkdownEditorInputMergeDirection
      readonly restoreSelection?: boolean
      readonly transaction: MarkdownEditorTransaction
    }
  | {
      readonly kind: 'undo' | 'redo'
      readonly restoreSelection?: boolean
    }

const nativeMachine = createMarkdownEditorNativeEventMachine({
  documentIdentity,
})
let beforeInputSnapshot: BeforeInputSnapshot | undefined
let pendingClipboardIdentity: string | undefined
let pendingInputOrigin: 'drop' | 'paste' | undefined
let restoringSelection = false

const syncNativeComposing = () => {
  isComposing.value = nativeMachine.composing
}

const historiesEqual = (
  first: MarkdownEditorHistoryState,
  second: MarkdownEditorHistoryState,
) =>
  first.undoDepth === second.undoDepth &&
  first.redoDepth === second.redoDepth &&
  first.retainedUnits === second.retainedUnits &&
  first.canUndo === second.canUndo &&
  first.canRedo === second.canRedo

const rejectedResult = (
  reason: MarkdownEditorTransactionRejection,
): MarkdownEditorDispatchResult =>
  Object.freeze({
    accepted: false,
    beforeRevision: transactionStore.revision,
    documentIdentity: transactionStore.documentIdentity,
    history: transactionStore.history,
    reason,
    revision: transactionStore.revision,
    selection: transactionStore.selection,
    value: transactionStore.value,
  })

const operationTransaction = (
  operation: EditorOperation,
): MarkdownEditorTransaction => {
  if (operation.kind === 'transaction') return operation.transaction
  return Object.freeze({
    changes: [],
    history: 'skip',
    metadata: Object.freeze({ action: operation.kind }),
    origin: 'command',
  })
}

const restoreTextareaSelection = async (
  selection: MarkdownEditorSelection,
  focus = true,
) => {
  if (isComposing.value) return
  await nextTick()
  if (isComposing.value) return
  const textarea = textareaRef.value
  if (!textarea) return

  restoringSelection = true
  if (focus) textarea.focus()
  textarea.setSelectionRange(
    selection.start,
    selection.end,
    selection.direction,
  )
  queueMicrotask(() => {
    restoringSelection = false
  })
}

const dispatchEditorOperation = (
  operation: EditorOperation,
): MarkdownEditorDispatchResult => {
  const transaction = operationTransaction(
    operation.kind === 'transaction'
      ? {
          ...operation,
          transaction: Object.freeze({
            ...operation.transaction,
            documentIdentity:
              operation.transaction.documentIdentity ?? documentIdentity,
          }),
        }
      : operation,
  )
  const blocked =
    operation.kind === 'transaction'
      ? !operation.allowBlocked && editingBlocked.value
      : editingBlocked.value
  const compositionBlocked =
    isComposing.value &&
    !(operation.kind === 'transaction' && operation.internalPropReset)
  if (blocked || compositionBlocked) {
    const result = rejectedResult(blocked ? 'disabled' : 'composition-active')
    emit('transaction', toMarkdownEditorTransactionEvent(transaction, result))
    return result
  }

  const previousValue = transactionStore.value
  const previousSelection = transactionStore.selection
  const previousHistory = transactionStore.history
  const result =
    operation.kind === 'transaction'
      ? transactionStore.dispatch(transaction, {
          mergeDirection: operation.mergeDirection,
          now: Date.now(),
        })
      : operation.kind === 'undo'
        ? transactionStore.undo()
        : transactionStore.redo()

  editorValue.value = result.value
  emit('transaction', toMarkdownEditorTransactionEvent(transaction, result))

  if (
    result.accepted &&
    result.value !== previousValue &&
    (operation.kind !== 'transaction' || operation.emitValue !== false)
  ) {
    emit(UPDATE_MODEL_EVENT, result.value)
    emit(CHANGE_EVENT, result.value)
    refreshLiveWindow('input')
  }
  if (
    result.accepted &&
    (result.selection.start !== previousSelection.start ||
      result.selection.end !== previousSelection.end ||
      result.selection.direction !== previousSelection.direction)
  ) {
    emit(
      'selection-change',
      Object.freeze({
        revision: result.revision,
        selection: result.selection,
      }),
    )
  }
  if (result.accepted && !historiesEqual(previousHistory, result.history)) {
    emit('history-change', result.history)
  }
  if (
    result.accepted &&
    operation.restoreSelection !== false &&
    operation.kind !== 'transaction'
  ) {
    void restoreTextareaSelection(result.selection)
  } else if (
    result.accepted &&
    operation.kind === 'transaction' &&
    operation.restoreSelection !== false
  ) {
    void restoreTextareaSelection(result.selection)
  }
  return result
}

const readSelectionFrom = (
  textarea: HTMLTextAreaElement | null,
): MarkdownEditorSelection => {
  if (!textarea) return transactionStore.selection
  return {
    direction: textarea.selectionDirection,
    end: textarea.selectionEnd,
    start: textarea.selectionStart,
  }
}

const captureSelection = (breakMerge = true) => {
  const previous = transactionStore.selection
  transactionStore.setSelection(
    readSelectionFrom(textareaRef.value),
    breakMerge,
  )
  const selection = transactionStore.selection
  if (
    selection.start !== previous.start ||
    selection.end !== previous.end ||
    selection.direction !== previous.direction
  ) {
    emit(
      'selection-change',
      Object.freeze({
        revision: transactionStore.revision,
        selection,
      }),
    )
  }
  return selection
}

const refreshCurrentTableCell = (offset = transactionStore.selection.start) => {
  const previousCellId = currentTableCell.value?.cellId
  const nextCell = resolveMarkdownTableCellAtOffset(
    transactionStore.value,
    documentIdentity,
    offset,
  )
  currentTableCell.value = nextCell
  if (!nextCell || (previousCellId && nextCell.cellId !== previousCellId)) {
    tableMenuOpen.value = false
  }
  return nextCell
}

const selectTableCell = async (cell: MarkdownTableCellIdentity) => {
  const resolved = resolveMarkdownTableCellCoordinates(
    transactionStore.value,
    documentIdentity,
    cell.tableId,
    cell.row,
    cell.column,
    cell.cellId,
  )
  if (!resolved?.anchor) {
    currentTableCell.value = null
    return
  }
  currentTableCell.value = resolved
  transactionStore.setSelection(
    {
      direction: 'none',
      end: resolved.anchor.end,
      start: resolved.anchor.start,
    },
    true,
  )
  await restoreTextareaSelection(transactionStore.selection)
}

const dispatchReplacement = (
  nextValue: string,
  selection: MarkdownEditorSelection,
  options: Omit<MarkdownEditorTransaction, 'changes' | 'selection'>,
  mergeDirection: MarkdownEditorInputMergeDirection = 'none',
) => {
  const change = deriveMarkdownEditorChange(transactionStore.value, nextValue)
  return dispatchEditorOperation({
    kind: 'transaction',
    mergeDirection,
    transaction: {
      ...options,
      changes: change ? [change] : [],
      selection,
    },
  })
}

watch(
  [() => props.mode, () => props.defaultMode, () => props.mobileLayout],
  ([mode, defaultMode]) => {
    transactionStore.breakMergeGroup()
    currentMode.value = normalizeModeForLayout(mode ?? defaultMode)
  },
)

watch(
  () => props.modelValue,
  (value) => {
    if (value === transactionStore.value) return

    abortPendingCommands()
    nativeMachine.apply({
      documentIdentity,
      kind: 'external-reset',
      revision: transactionStore.revision,
      value,
    })
    syncNativeComposing()
    beforeInputSnapshot = undefined
    pendingClipboardIdentity = undefined
    pendingInputOrigin = undefined
    const result = dispatchEditorOperation({
      allowBlocked: true,
      emitValue: false,
      internalPropReset: true,
      kind: 'transaction',
      restoreSelection: false,
      transaction: {
        changes: [
          {
            from: 0,
            insert: value,
            to: transactionStore.value.length,
          },
        ],
        history: 'skip',
        externalUpdate: 'reset',
        metadata: Object.freeze({ kind: 'external-reset' }),
        origin: 'external',
        selection: {
          direction: transactionStore.selection.direction,
          end: value.length,
          start: value.length,
        },
      },
    })
    if (result.accepted) {
      currentTableCell.value = null
      tableMenuOpen.value = false
    }
  },
)

const editorMetrics = computed(() =>
  calculateMarkdownEditorMetrics(editorValue.value, props.metrics),
)
const characterCount = computed(() => editorMetrics.value.codeUnitLength)
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
const commandContext = computed(() => ({
  dispatch: {
    dispatch: (transaction: MarkdownEditorTransaction) =>
      dispatchEditorOperation({ kind: 'transaction', transaction }),
  },
  documentIdentity,
  mode: currentMode.value,
  readonly: editingBlocked.value,
  revision: transactionStore.revision,
  selection: transactionStore.selection,
  signal: commandContextSignal,
  value: transactionStore.value,
}))
const toolbarCommands = computed(() =>
  filterMarkdownEditorCommands(props.commands, commandContext.value, 'toolbar'),
)
const gatedPasteAsMarkdownCommand = computed(() =>
  pasteAsMarkdownGate.value &&
  !resolveMarkdownEditorPrimaryCommands(
    toolbarCommands.value,
    props.toolbarDensity,
    props.primaryCommandKeys,
  ).some((command) => command.key === 'paste-as-markdown')
    ? toolbarCommands.value.find(
        (command) => command.key === 'paste-as-markdown',
      )
    : undefined,
)
const localeText = computed(() =>
  resolveMarkdownEditorLocaleText(props.localeText),
)
const pasteAsMarkdownGateDescription = computed(() => {
  const gate = pasteAsMarkdownGate.value
  return gate ? localeText.value.pasteAsMarkdown.disabledDescriptions[gate] : ''
})
const isPasteAsMarkdownCommand = (command: MarkdownEditorCommand) =>
  command.key === 'paste-as-markdown'
const isCommandDisabled = (command: MarkdownEditorCommand) =>
  editingBlocked.value ||
  (isPasteAsMarkdownCommand(command) &&
    (Boolean(pasteAsMarkdownGate.value) || pasteAsMarkdownBusy.value))
const commandDescriptionId = (command: MarkdownEditorCommand) =>
  isPasteAsMarkdownCommand(command) && pasteAsMarkdownGate.value
    ? pasteAsMarkdownDescriptionId
    : undefined
const primaryCommands = computed(() =>
  resolveMarkdownEditorPrimaryCommands(
    toolbarCommands.value,
    props.toolbarDensity,
    props.primaryCommandKeys,
  ),
)
const overflowCommands = computed(() =>
  resolveMarkdownEditorOverflowCommands(
    toolbarCommands.value,
    props.toolbarDensity,
    props.primaryCommandKeys,
  ),
)
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
watch([editingBlocked, overflowItemCount], ([blocked, itemCount]) => {
  if (blocked || !itemCount) commandsExpanded.value = false
  if (!blocked) return

  transactionStore.breakMergeGroup()
  if (isComposing.value) {
    nativeMachine.apply({
      documentIdentity,
      kind: 'external-reset',
      revision: transactionStore.revision,
    })
    syncNativeComposing()
    beforeInputSnapshot = undefined
    pendingClipboardIdentity = undefined
    pendingInputOrigin = undefined
    triggerRef(editorValue)
  }
})
const commandOverflowAriaLabel = computed(() =>
  props.localeText?.overflowAria
    ? props.localeText.overflowAria(overflowItemCount.value)
    : `${props.commandOverflowLabel}，${overflowItemCount.value} 个工具`,
)
const visibleModes = computed(() =>
  compactMode.value
    ? modes.filter((mode) => mode !== 'split' && mode !== 'live')
    : modes,
)
const wordCount = computed(() => editorMetrics.value.wordCount)

const updateVisualViewportHeight = () => {
  if (typeof window === 'undefined') return

  const previous = visualViewportHeight.value
  visualViewportHeight.value =
    window.visualViewport?.height || window.innerHeight || 0
  const trigger =
    previous > 0 && visualViewportHeight.value + 80 < previous
      ? 'soft-keyboard'
      : 'visual-viewport'
  applyLiveLayout(trigger)
}

onMounted(() => {
  refreshLiveWindow('initial')
  updateVisualViewportHeight()
  window.visualViewport?.addEventListener('resize', updateVisualViewportHeight)
  window.visualViewport?.addEventListener('scroll', updateVisualViewportHeight)
  window.addEventListener('resize', updateVisualViewportHeight)
})

onBeforeUnmount(() => {
  abortPendingCommands()
  if (layoutGestureTimer) clearTimeout(layoutGestureTimer)
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

const handleBeforeInput = (event: InputEvent) => {
  const plan = nativeMachine.apply({
    clipboardIdentity: pendingClipboardIdentity,
    data: event.data,
    disabled: editingBlocked.value,
    documentIdentity,
    inputType: event.inputType,
    isComposing: event.isComposing,
    kind: 'beforeinput',
    origin: pendingInputOrigin,
    previousValue: transactionStore.value,
    revision: transactionStore.revision,
    selection: captureSelection(!nativeMachine.composing),
  })
  syncNativeComposing()
  if (plan.snapshot) beforeInputSnapshot = plan.snapshot
  if (plan.preventDefault) event.preventDefault()
  if (plan.restoreDisplay) triggerRef(editorValue)
  if (plan.action === 'undo') {
    undo()
    return
  }
  if (plan.action === 'redo') {
    redo()
    return
  }
}

const handleInput = (event: Event) => {
  const target = event.target
  if (!(target instanceof HTMLTextAreaElement)) return
  const inputEvent = event instanceof InputEvent ? event : undefined
  const snapshot =
    beforeInputSnapshot?.value === transactionStore.value
      ? beforeInputSnapshot
      : nativeMachine.snapshot
  const plan = nativeMachine.apply({
    clipboardIdentity: pendingClipboardIdentity,
    data: inputEvent?.data ?? snapshot?.data ?? null,
    disabled: editingBlocked.value,
    documentIdentity,
    inputType: inputEvent?.inputType ?? snapshot?.inputType,
    isComposing: inputEvent?.isComposing,
    kind: 'input',
    origin: pendingInputOrigin,
    previousValue: transactionStore.value,
    revision: transactionStore.revision,
    selection: readSelectionFrom(target),
    value: target.value,
  })
  syncNativeComposing()
  beforeInputSnapshot = undefined
  if (plan.action === 'dedup' || plan.action === 'prevent' || plan.action === 'ignore') {
    pendingClipboardIdentity = undefined
    pendingInputOrigin = undefined
    if (plan.restoreDisplay && target.value !== transactionStore.value) {
      triggerRef(editorValue)
      void restoreTextareaSelection(transactionStore.selection)
    } else if (plan.restoreDisplay) {
      triggerRef(editorValue)
    }
    return
  }
  if (plan.action !== 'dispatch' && plan.action !== 'commit') {
    pendingClipboardIdentity = undefined
    pendingInputOrigin = undefined
    return
  }

  dispatchReplacement(
    target.value,
    readSelectionFrom(target),
    {
      history: plan.history,
      metadata: Object.freeze({
        ...(plan.composition ? { composition: true } : {}),
        data: snapshot?.data ?? inputEvent?.data ?? null,
        identity: plan.identity,
        inputType: snapshot?.inputType ?? inputEvent?.inputType ?? 'insertText',
      }),
      origin: plan.origin,
    },
    plan.mergeDirection,
  )
  pendingClipboardIdentity = undefined
  pendingInputOrigin = undefined
}

const handleCompositionStart = () => {
  nativeMachine.apply({
    disabled: editingBlocked.value,
    documentIdentity,
    kind: 'compositionstart',
    revision: transactionStore.revision,
  })
  syncNativeComposing()
  if (editingBlocked.value || !nativeMachine.composing) return
  transactionStore.breakMergeGroup()
  captureSelection()
  beforeInputSnapshot = undefined
  pendingClipboardIdentity = undefined
  pendingInputOrigin = undefined
  refreshLiveReveal()
}

const handleCompositionEnd = (event: CompositionEvent) => {
  const target = event.target
  if (!(target instanceof HTMLTextAreaElement)) return
  const plan = nativeMachine.apply({
    data: event.data,
    disabled: editingBlocked.value,
    documentIdentity,
    kind: 'compositionend',
    previousValue: transactionStore.value,
    revision: transactionStore.revision,
    selection: readSelectionFrom(target),
    value: target.value,
  })
  syncNativeComposing()
  beforeInputSnapshot = undefined
  pendingClipboardIdentity = undefined
  pendingInputOrigin = undefined
  if (plan.action !== 'commit') {
    if (plan.restoreDisplay) triggerRef(editorValue)
    return
  }
  const laggedComposition =
    target.value === transactionStore.value && event.data
      ? `${transactionStore.value}${event.data}`
      : target.value
  const laggedSelection = {
    direction: 'forward' as const,
    end: laggedComposition.length,
    start: laggedComposition.length,
  }
  dispatchReplacement(
    laggedComposition,
    target.value === transactionStore.value && event.data
      ? laggedSelection
      : readSelectionFrom(target),
    {
    history: plan.history,
    metadata: Object.freeze({
      composition: true,
      data: event.data,
      identity: plan.identity,
      inputType: 'insertCompositionText',
    }),
    origin: 'input',
  },
  )
  refreshLiveReveal()
}

const applyClipboardTransfer = (
  event: { preventDefault(): void; dataTransfer?: DataTransfer | null },
  origin: 'paste' | 'drop',
  data: DataTransfer | null | undefined,
) => {
  const transfer = markdownClipboardItemsFromDataTransfer(data ?? null)
  const hasTransfer = transfer.items.length > 0 || transfer.files.length > 0
  if (!hasTransfer) {
    if (!editingBlocked.value && !nativeMachine.freezeSmartInput) {
      pendingInputOrigin = origin
    }
    return
  }

  const plan = resolveMarkdownClipboardPaste({
    composing: isComposing.value,
    disabled: editingBlocked.value,
    documentIdentity,
    files: transfer.files,
    items: transfer.items,
    mode: currentMode.value,
    origin,
    revision: transactionStore.revision,
    selection: captureSelection(),
    source: transactionStore.value,
  })

  if (
    plan.rejected === 'composition-active' ||
    plan.rejected === 'disabled' ||
    plan.rejected === 'preview' ||
    plan.rejected === 'readonly' ||
    plan.rejected === 'stale-document' ||
    plan.rejected === 'budget-exceeded' ||
    plan.rejected === 'cancelled'
  ) {
    event.preventDefault()
    return
  }

  if (plan.action === 'attachment-intent' || plan.transaction) {
    event.preventDefault()
    pendingClipboardIdentity = plan.identity
    pendingInputOrigin = origin
    nativeMachine.apply({
      clipboardIdentity: plan.identity,
      documentIdentity,
      kind: origin,
      origin,
      revision: transactionStore.revision,
    })
    if (plan.transaction) dispatchTransaction(plan.transaction)
    return
  }

  event.preventDefault()
}

const handlePaste = (event: ClipboardEvent) => {
  const cell = refreshCurrentTableCell(captureSelection(false).start)
  const clipboard = event.clipboardData
  if (
    cell &&
    clipboard &&
    clipboard.files.length === 0 &&
    !isComposing.value &&
    !editingBlocked.value
  ) {
    const tsv = clipboard.getData('text/tab-separated-values')
    const csv = clipboard.getData('text/csv')
    const plain = clipboard.getData('text/plain')
    const carriesHtml = Array.from(clipboard.types).includes('text/html')
    const payload = tsv || csv || (carriesHtml ? '' : plain)
    const mime = tsv
      ? 'text/tab-separated-values'
      : csv
        ? 'text/csv'
        : undefined
    if (payload.includes('\t') || mime === 'text/csv') {
      const transfer = markdownClipboardItemsFromDataTransfer(clipboard)
      const clipboardPlan = resolveMarkdownClipboardPaste({
        composing: isComposing.value,
        disabled: editingBlocked.value,
        documentIdentity,
        files: transfer.files,
        items: transfer.items,
        mode: currentMode.value,
        origin: 'paste',
        revision: transactionStore.revision,
        selection: transactionStore.selection,
        source: transactionStore.value,
      })
      const plan = planMarkdownTablePaste(
        transactionStore.value,
        documentIdentity,
        cell.tableId,
        cell,
        payload,
        mime,
        transactionStore.revision,
      )
      if ('changes' in plan) {
        event.preventDefault()
        pendingClipboardIdentity = clipboardPlan.identity
        pendingInputOrigin = 'paste'
        nativeMachine.apply({
          clipboardIdentity: clipboardPlan.identity,
          documentIdentity,
          kind: 'paste',
          origin: 'paste',
          revision: transactionStore.revision,
        })
        const result = dispatchTransaction(plan)
        if (result.accepted) {
          tableAnnouncement.value = 'Pasted table data'
          void selectTableCell(cell)
        }
        return
      }
    }
  }
  applyClipboardTransfer(event, 'paste', event.clipboardData)
}

const handleDrop = (event: DragEvent) => {
  applyClipboardTransfer(event, 'drop', event.dataTransfer)
}

const handleCopy = (event: ClipboardEvent) => {
  if (currentMode.value === 'live' && atomicSession.value?.phase === 'selected') {
    const atomic = applyAtomicIntent('copy-source')
    if (atomic.copy && 'payload' in atomic.copy) {
      event.preventDefault()
      writeMarkdownClipboardPayload(event.clipboardData, atomic.copy.payload)
      return
    }
  }
  const plan = resolveMarkdownClipboardCopy({
    composing: isComposing.value,
    disabled: editingBlocked.value,
    documentIdentity,
    mode: currentMode.value,
    revision: transactionStore.revision,
    selection: captureSelection(false),
    source: transactionStore.value,
  })
  if (plan.rejected) {
    event.preventDefault()
    return
  }
  event.preventDefault()
  writeMarkdownClipboardPayload(event.clipboardData, plan.payload)
}

const handleCut = (event: ClipboardEvent) => {
  if (currentMode.value === 'live' && atomicSession.value?.phase === 'selected') {
    const atomic = applyAtomicIntent('cut')
    if (atomic.copy && 'payload' in atomic.copy) {
      event.preventDefault()
      writeMarkdownClipboardPayload(event.clipboardData, atomic.copy.payload)
      return
    }
    if (atomic.copy && 'copy' in atomic.copy) {
      event.preventDefault()
      writeMarkdownClipboardPayload(event.clipboardData, atomic.copy.copy.payload)
      return
    }
  }
  const plan = resolveMarkdownClipboardCut({
    composing: isComposing.value,
    disabled: editingBlocked.value,
    documentIdentity,
    mode: currentMode.value,
    revision: transactionStore.revision,
    selection: captureSelection(),
    source: transactionStore.value,
  })
  if (plan.rejected || !plan.transaction) {
    event.preventDefault()
    return
  }
  event.preventDefault()
  writeMarkdownClipboardPayload(event.clipboardData, plan.copy.payload)
  dispatchTransaction(plan.transaction)
}

const handleSelectionMove = () => {
  if (restoringSelection || isComposing.value) return
  captureSelection()
  refreshCurrentTableCell()
  if (currentMode.value === 'live') {
    const selection = transactionStore.selection
    if (selection.start !== selection.end) {
      markLayoutGesture('selection-drag')
      applyLiveSelectionMotion('pointer-drag', {
        dragOffset:
          selection.direction === 'backward' ? selection.start : selection.end,
      })
      return
    }
  }
  refreshLiveReveal()
}

const handlePointerReveal = () => {
  if (restoringSelection || isComposing.value) return
  captureSelection()
  refreshCurrentTableCell()
  if (currentMode.value === 'live') {
    applyLiveSelectionMotion('pointer-click', {
      pointerOffset: transactionStore.selection.start,
    })
  }
  refreshLiveReveal({
    intent: 'pointer',
    pointerOffset: transactionStore.selection.start,
  })
}

const handleTableContextMenu = (event: MouseEvent) => {
  const cell = refreshCurrentTableCell(captureSelection(false).start)
  if (!cell || editingBlocked.value) return
  event.preventDefault()
  tableAnnouncement.value = `Table row ${cell.row + 1}, column ${cell.column + 1}`
  tableMenuOpen.value = true
  void nextTick(() =>
    tableMenuRef.value?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus(),
  )
}

const focusTableMenuItem = (index: number) => {
  const items = Array.from(
    tableMenuRef.value?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? [],
  )
  if (!items.length) return
  items[(index + items.length) % items.length]?.focus()
}

const closeTableMenu = (restoreTrigger = false) => {
  tableMenuOpen.value = false
  if (restoreTrigger) {
    void nextTick(() => tableMenuTriggerRef.value?.focus())
  }
}

const toggleTableMenu = () => {
  tableMenuOpen.value = !tableMenuOpen.value
  if (tableMenuOpen.value) {
    void nextTick(() => focusTableMenuItem(0))
  }
}

const handleTableMenuKeydown = (event: KeyboardEvent) => {
  const items = Array.from(
    tableMenuRef.value?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? [],
  )
  const currentIndex = items.indexOf(document.activeElement as HTMLButtonElement)
  if (event.key === 'Escape') {
    event.preventDefault()
    closeTableMenu(true)
    return
  }
  if (event.key === 'Tab') {
    tableMenuOpen.value = false
    return
  }
  const targetIndex =
    event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? items.length - 1
        : event.key === 'ArrowDown'
          ? currentIndex + 1
          : event.key === 'ArrowUp'
            ? currentIndex - 1
            : null
  if (targetIndex === null) return
  event.preventDefault()
  focusTableMenuItem(targetIndex)
}

const runTableContextAction = (key: string) => {
  const cell = currentTableCell.value
  if (!cell || editingBlocked.value || isComposing.value) return
  const source = transactionStore.value
  const revision = transactionStore.revision
  let plan: MarkdownEditorTransaction | { readonly rejected: string }
  switch (key) {
    case 'insert-row-above':
      plan = planMarkdownTableInsertRow(
        source,
        documentIdentity,
        cell.tableId,
        cell.row,
        'above',
        revision,
        cell.column,
      )
      break
    case 'insert-row-below':
      plan = planMarkdownTableInsertRow(
        source,
        documentIdentity,
        cell.tableId,
        cell.row,
        'below',
        revision,
        cell.column,
      )
      break
    case 'delete-row':
      plan = planMarkdownTableDeleteRow(
        source,
        documentIdentity,
        cell.tableId,
        cell.row,
        revision,
        cell.column,
      )
      break
    case 'insert-col-left':
      plan = planMarkdownTableInsertColumn(
        source,
        documentIdentity,
        cell.tableId,
        cell.column,
        'left',
        revision,
        cell.row,
      )
      break
    case 'insert-col-right':
      plan = planMarkdownTableInsertColumn(
        source,
        documentIdentity,
        cell.tableId,
        cell.column,
        'right',
        revision,
        cell.row,
      )
      break
    case 'delete-col':
      plan = planMarkdownTableDeleteColumn(
        source,
        documentIdentity,
        cell.tableId,
        cell.column,
        revision,
        cell.row,
      )
      break
    case 'align-left':
    case 'align-center':
    case 'align-right':
      plan = planMarkdownTableAlignColumn(
        source,
        documentIdentity,
        cell.tableId,
        cell.column,
        key.slice('align-'.length) as 'left' | 'center' | 'right',
        revision,
        cell.row,
      )
      break
    case 'format-table':
      plan = planMarkdownTableFormat(
        source,
        documentIdentity,
        cell.tableId,
        revision,
        cell,
      )
      break
    default:
      return
  }
  if (!('changes' in plan)) return
  const result = dispatchTransaction(plan)
  if (!result.accepted) return
  tableAnnouncement.value = tableContextActions.value.find(
    (action) => action.key === key,
  )?.title ?? 'Table updated'
  closeTableMenu()
  void selectTableCell(cell)
}

const handleBlur = () => {
  transactionStore.breakMergeGroup()
}

const readPasteAsMarkdownClipboard =
  async (): Promise<MarkdownHtmlImportSnapshot> => {
    const clipboard = navigator.clipboard
    if (typeof clipboard?.read === 'function') {
      const items = await clipboard.read()
      const item = items[0]
      if (!item) return Object.freeze({ explicit: true })
      const types = new Set(item.types)
      const readType = async (type: string) =>
        types.has(type) ? (await item.getType(type)).text() : undefined
      const [html, markdown, plain] = await Promise.all([
        readType('text/html'),
        readType('text/markdown'),
        readType('text/plain'),
      ])
      return Object.freeze({
        explicit: true,
        html,
        markdown,
        plain,
        sourceApplication: undefined,
      })
    }
    if (typeof clipboard?.readText === 'function') {
      return Object.freeze({
        explicit: true,
        plain: await clipboard.readText(),
      })
    }
    throw new Error('Clipboard access is unavailable.')
  }

const restorePasteAsMarkdownFocus = (selection: MarkdownEditorSelection) => {
  void restoreTextareaSelection(selection)
}

const openPasteAsMarkdownSurface = async () => {
  if (pasteAsMarkdownGate.value || pasteAsMarkdownBusy.value) return
  const anchor = Object.freeze({
    documentIdentity,
    revision: transactionStore.revision,
    selection: Object.freeze({ ...captureSelection() }),
    source: transactionStore.value,
  })
  pasteAsMarkdownBusy.value = true
  pasteAsMarkdownError.value = ''
  try {
    const snapshot = await readPasteAsMarkdownClipboard()
    const opened = openMarkdownPasteAsMarkdown({
      anchor,
      composition: isComposing.value,
      disabled: props.disabled || props.loading,
      explicit: true,
      previewOnly: currentMode.value === 'preview',
      readonly: props.readonly,
      snapshot,
    })
    if (opened.ok === false) {
      pasteAsMarkdownError.value =
        pasteAsMarkdownGateDescription.value || opened.rejected
      restorePasteAsMarkdownFocus(anchor.selection)
      return
    }
    pasteAsMarkdownSession.value = opened.session
    await nextTick()
    pasteAsMarkdownPrimaryActionRef.value?.focus()
  } catch (error) {
    pasteAsMarkdownError.value =
      error instanceof Error ? error.message : 'Clipboard access failed.'
    restorePasteAsMarkdownFocus(anchor.selection)
  } finally {
    pasteAsMarkdownBusy.value = false
  }
}

const closePasteAsMarkdownSurface = (selection: MarkdownEditorSelection) => {
  pasteAsMarkdownSession.value = null
  pasteAsMarkdownError.value = ''
  restorePasteAsMarkdownFocus(selection)
}

const cancelPasteAsMarkdownSurface = () => {
  const session = pasteAsMarkdownSession.value
  if (!session) return
  const cancelled = cancelMarkdownPasteAsMarkdown(session)
  closePasteAsMarkdownSurface(cancelled.selection)
}

const confirmPasteAsMarkdownChoice = (
  choice: Exclude<MarkdownPasteAsMarkdownChoice, 'cancel'>,
) => {
  const session = pasteAsMarkdownSession.value
  if (!session) return
  if (pasteAsMarkdownGate.value) {
    pasteAsMarkdownError.value = pasteAsMarkdownGateDescription.value
    return
  }
  const current = Object.freeze({
    documentIdentity,
    revision: transactionStore.revision,
    selection: Object.freeze({ ...captureSelection(false) }),
    source: transactionStore.value,
  })
  const confirmed = confirmMarkdownPasteAsMarkdown(session, choice, current)
  if ('rejected' in confirmed) {
    pasteAsMarkdownError.value = localeText.value.pasteAsMarkdown.stale
    return
  }
  const result = dispatchTransaction(confirmed.transaction)
  if (!result.accepted) {
    pasteAsMarkdownError.value = localeText.value.pasteAsMarkdown.stale
    return
  }
  if (confirmed.attachmentBatch) {
    emit('upload-image', confirmed.attachmentBatch)
  }
  closePasteAsMarkdownSurface(result.selection)
}

const handlePasteAsMarkdownDialogKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape') {
    event.preventDefault()
    cancelPasteAsMarkdownSurface()
    return
  }
  if (event.key !== 'Tab') return
  const buttons = Array.from(
    pasteAsMarkdownDialogRef.value?.querySelectorAll<HTMLButtonElement>(
      'button:not(:disabled)',
    ) ?? [],
  )
  if (!buttons.length) return
  const first = buttons[0]!
  const last = buttons[buttons.length - 1]!
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first.focus()
  }
}

const activateCommand = (command: MarkdownEditorCommand) => {
  if (isPasteAsMarkdownCommand(command)) {
    void openPasteAsMarkdownSurface()
    return
  }
  void runCommand(command)
}

const activateOverflowCommand = (command: MarkdownEditorCommand) => {
  activateCommand(command)
  commandsExpanded.value = false
}

const runCommand = async (command: MarkdownEditorCommand) => {
  if (editingBlocked.value || nativeMachine.freezeSmartInput) return
  if (pendingCommandKeys.value.has(command.key)) return

  const selection = captureSelection()
  const commandController = new AbortController()
  commandControllers.set(command.key, commandController)
  pendingCommandKeys.value = new Set(pendingCommandKeys.value).add(command.key)
  const revision = transactionStore.revision
  const value = transactionStore.value
  try {
    const context = {
      dispatch: { dispatch: dispatchTransaction },
      documentIdentity,
      mode: currentMode.value,
      readonly: editingBlocked.value,
      revision,
      selection,
      signal: commandController.signal,
      value,
    }
    if (!isMarkdownEditorCommandVisible(command, context) || !isMarkdownEditorCommandEnabled(command, context)) return
    const result = await runMarkdownEditorCommand(command, context)
    if (commandController.signal.aborted || commandControllers.get(command.key) !== commandController) return
    if (!result?.transaction) return
    const dispatchResult = dispatchTransaction({
      ...result.transaction,
      expectedRevision: revision,
      history: result.transaction.history ?? 'separate',
      metadata: Object.freeze({ command: command.key }),
      origin: 'command',
    })
    if (dispatchResult.accepted) emit('command', command)
  } finally {
    if (commandControllers.get(command.key) === commandController) {
      commandControllers.delete(command.key)
      const pending = new Set(pendingCommandKeys.value)
      pending.delete(command.key)
      pendingCommandKeys.value = pending
    }
  }
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
  if (editingBlocked.value || isComposing.value) return
  commandsExpanded.value = !commandsExpanded.value
}

const setMode = (mode: MarkdownEditorMode) => {
  if (editingBlocked.value || isComposing.value) return

  const preview = previewElement()
  if (preview) retainedPreviewScrollLeft.value = preview.scrollLeft
  transactionStore.breakMergeGroup()
  const nextMode = normalizeModeForLayout(mode)
  const retained = retainMarkdownLiveSelection({
    documentIdentity,
    mode: nextMode,
    selection: captureSelection(false),
    source: transactionStore.value,
  })
  transactionStore.setSelection(retained.selection, false)
  currentMode.value = nextMode
  emit('mode-change', nextMode)
  void restoreTextareaSelection(retained.selection, false)
  applyLiveLayout('mode-switch')
  refreshLiveWindow('mode-switch')
  refreshLiveReveal()
  restorePreviewScroll()
}

const modeLabel = (mode: MarkdownEditorMode) => localeText.value.modes[mode]

const emitSave = () => {
  if (editingBlocked.value || isComposing.value) return
  emit('save', editorValue.value)
}

const emitSubmit = () => {
  if (editingBlocked.value || isComposing.value) return
  emit('submit', editorValue.value)
}

const emitUploadImage = () => {
  if (editingBlocked.value || isComposing.value) return
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

const handlePreviewRenderComplete = (payload: unknown) => {
  emitRenderEvent('render-complete', payload)
  restorePreviewScroll()
}

const handleKeydown = (event: KeyboardEvent) => {
  if (editingBlocked.value || nativeMachine.freezeSmartInput) return

  if (!event.altKey && !event.ctrlKey && !event.metaKey) {
    const selection = captureSelection(false)
    const cell = refreshCurrentTableCell(selection.start)
    const tableKey =
      event.key === 'Tab' && event.shiftKey
        ? 'Shift+Tab'
        : event.key === 'Enter' && event.shiftKey
          ? 'Shift+Enter'
          : event.key
    if (cell?.anchor) {
      const plan = resolveMarkdownTableInputIntent({
        cell,
        cellOffset: Math.max(0, selection.start - cell.anchor.start),
        cellText: transactionStore.value.slice(cell.anchor.start, cell.anchor.end),
        compositionActive: isComposing.value,
        documentIdentity,
        expectedRevision: transactionStore.revision,
        key: tableKey,
        selection,
        source: transactionStore.value,
      })
      const moved =
        plan.nextCell.row !== cell.row ||
        plan.nextCell.column !== cell.column ||
        plan.nextCell.status !== cell.status
      if (plan.transaction || moved || tableKey === 'Tab' || tableKey === 'Shift+Tab') {
        event.preventDefault()
        if (plan.transaction) {
          const result = dispatchTransaction(plan.transaction)
          if (!result.accepted) return
        }
        tableAnnouncement.value = plan.screenReaderText
        if (plan.nextCell.status === 'current') {
          void selectTableCell(plan.nextCell)
        } else {
          currentTableCell.value = null
        }
        return
      }
    }
  }

  if (event.key === 'Escape' && currentMode.value === 'live') {
    if (atomicSession.value) {
      event.preventDefault()
      applyAtomicIntent('escape')
      return
    }
    if (liveReveal.value.state !== 'inactive') {
      event.preventDefault()
      refreshLiveReveal({ intent: 'escape' })
      return
    }
  }

  if (currentMode.value === 'live') {
    const motionKey =
      event.key === 'ArrowLeft'
        ? event.ctrlKey || event.altKey
          ? 'word-left'
          : 'left'
        : event.key === 'ArrowRight'
          ? event.ctrlKey || event.altKey
            ? 'word-right'
            : 'right'
          : event.key === 'Home'
            ? 'home'
            : event.key === 'End'
              ? 'end'
              : event.key === 'PageUp'
                ? 'page-up'
                : event.key === 'PageDown'
                  ? 'page-down'
                  : null
    if (motionKey) {
      event.preventDefault()
      applyLiveSelectionMotion(motionKey, { shift: event.shiftKey })
      return
    }
    if (event.key === 'Enter' && !event.altKey && !event.ctrlKey && !event.metaKey) {
      const atomic = resolveMarkdownAtomicNodeIntent({
        action: 'caret-before',
        composing: isComposing.value,
        documentIdentity,
        mode: currentMode.value,
        revision: transactionStore.revision,
        selection: captureSelection(),
        session: atomicSession.value,
        source: transactionStore.value,
      })
      if (atomic.state === 'current') {
        event.preventDefault()
        applyAtomicIntent(event.shiftKey ? 'enter-source' : 'enter')
        return
      }
    }
    if (
      (event.key === 'Backspace' || event.key === 'Delete') &&
      !event.altKey &&
      !event.ctrlKey &&
      !event.metaKey
    ) {
      const selection = captureSelection()
      const atomic = resolveMarkdownAtomicNodeIntent({
        action: event.key === 'Backspace' ? 'backspace' : 'delete',
        composing: isComposing.value,
        documentIdentity,
        mode: currentMode.value,
        revision: transactionStore.revision,
        selection,
        session: atomicSession.value,
        source: transactionStore.value,
      })
      if (atomic.state === 'current' && atomic.nodeId) {
        const before = resolveMarkdownAtomicNodeIntent({
          action: 'caret-before',
          documentIdentity,
          mode: currentMode.value,
          nodeId: atomic.nodeId,
          revision: transactionStore.revision,
          selection,
          source: transactionStore.value,
        })
        const after = resolveMarkdownAtomicNodeIntent({
          action: 'caret-after',
          documentIdentity,
          mode: currentMode.value,
          nodeId: atomic.nodeId,
          revision: transactionStore.revision,
          selection,
          source: transactionStore.value,
        })
        const caret = selection.start
        const shouldDelete =
          atomicSession.value?.phase === 'selected' ||
          (event.key === 'Delete' && caret === before.selection.start) ||
          (event.key === 'Backspace' && caret === after.selection.start)
        if (shouldDelete) {
          event.preventDefault()
          applyAtomicIntent(event.key === 'Backspace' ? 'backspace' : 'delete')
          return
        }
      }
    }
  }

  const isMod = event.metaKey || event.ctrlKey
  const key = event.key.toLowerCase()
  if (isMod && !event.shiftKey && key === 'z') {
    event.preventDefault()
    undo()
    return
  }
  if (
    isMod &&
    ((event.shiftKey && key === 'z') || (!event.shiftKey && key === 'y'))
  ) {
    event.preventDefault()
    redo()
    return
  }

  const pairChars = new Set<string>(
    MARKDOWN_PAIR_DEFAULTS.flatMap(([open, close]) => [open, close]),
  )
  if (
    !event.altKey &&
    !event.ctrlKey &&
    !event.metaKey &&
    (event.key === 'Backspace' || pairChars.has(event.key))
  ) {
    const pairPlan = resolveMarkdownPairInput({
      source: transactionStore.value,
      selection: captureSelection(),
      inserted: event.key === 'Backspace' ? undefined : event.key,
      key: event.key === 'Backspace' ? 'backspace' : undefined,
      composing: isComposing.value,
      readonly: props.disabled,
      mode: currentMode.value,
      documentIdentity,
    })
    if (pairPlan.transaction) {
      event.preventDefault()
      dispatchTransaction(pairPlan.transaction)
      return
    }
  }

  const blockKey =
    event.key === 'Tab'
      ? event.shiftKey
        ? 'shift-tab'
        : 'tab'
      : event.key === 'Enter'
        ? event.shiftKey
          ? 'shift-enter'
          : 'enter'
        : event.key === 'Backspace'
          ? 'backspace'
          : event.key === 'Delete'
            ? 'delete'
            : null
  if (
    blockKey &&
    !event.altKey &&
    !event.ctrlKey &&
    !event.metaKey
  ) {
    const plan = resolveMarkdownBlockInputIntent({
      source: transactionStore.value,
      selection: captureSelection(),
      key: blockKey as MarkdownBlockInputKey,
      composing: isComposing.value,
      documentIdentity,
    })
    if (plan.rejected === 'composition-active') return
    if (!plan.transaction) return
    event.preventDefault()
    dispatchTransaction(plan.transaction)
    return
  }

  if (!isMod) return

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

  const command = resolveMarkdownEditorShortcut(props.commands, `mod+${key}`)

  if (command) {
    event.preventDefault()
    runCommand(command)
  }
}

const dispatchTransaction = (transaction: MarkdownEditorTransaction) =>
  dispatchEditorOperation({
    kind: 'transaction',
    transaction,
  })

function undo() {
  return dispatchEditorOperation({ kind: 'undo' })
}

function redo() {
  return dispatchEditorOperation({ kind: 'redo' })
}

const insertMarkdownAtCursor = (
  markdown: string,
  options: MarkdownEditorInsertOptions = {},
) => {
  const selection = options.selection ?? captureSelection()
  const cursor = selection.start + markdown.length
  return dispatchEditorOperation({
    kind: 'transaction',
    transaction: {
      changes: [
        {
          from: selection.start,
          insert: markdown,
          to: selection.end,
        },
      ],
      expectedRevision: options.expectedRevision,
      history: 'separate',
      metadata: options.metadata,
      origin: 'programmatic',
      selection: {
        direction: 'none',
        end: cursor,
        start: cursor,
      },
    },
  }).accepted
}

defineExpose({
  dispatchTransaction,
  insertMarkdownAtCursor,
  redo,
  undo,
})
</script>
