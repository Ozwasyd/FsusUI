<template>
  <section
    v-bind="$attrs"
    ref="rootElementRef"
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
        :spellcheck="languageCapability.spellcheck"
        :lang="languageCapability.lang || undefined"
        @beforeinput="handleBeforeInput"
        @blur="handleBlur"
        @click="handlePointerReveal"
        @compositionend="handleCompositionEnd"
        @compositionstart="handleCompositionStart"
        @copy="handleCopy"
        @cut="handleCut"
        @dragover.prevent
        @drop="handleDrop"
        @input="handleInput"
        @keydown="handleKeydown"
        @paste="handlePaste"
        @scroll="handleLayoutScroll"
        @select="handleSelectionMove"
        @touchmove="handleLayoutTouch"
        @wheel="handleLayoutWheel"
      />

      <input
        ref="attachmentInputRef"
        type="file"
        multiple
        :class="ns.e('attachment-picker')"
        tabindex="-1"
        aria-hidden="true"
        @change="handleAttachmentPickerChange"
      />

      <ul
        v-if="attachmentPresentations.length"
        :class="ns.e('attachments')"
        aria-label="Attachments"
      >
        <li
          v-for="attachment in attachmentPresentations"
          :key="attachment.itemId"
          :class="ns.e('attachment')"
        >
          <span :class="ns.e('attachment-name')">{{ attachment.name }}</span>
          <span
            :class="ns.e('attachment-status')"
            :aria-live="attachment.statusAriaLive"
          >
            {{ attachment.progressAriaText }}
          </span>
          <div :class="ns.e('attachment-actions')">
            <button
              v-for="action in attachment.actions"
              :key="action.key"
              type="button"
              :disabled="action.disabled"
              @click="runAttachmentAction(attachment.itemId, action.key)"
            >
              {{ action.label }}
            </button>
          </div>
        </li>
      </ul>

      <form
        v-if="activeImage"
        :class="ns.e('media-properties')"
        aria-label="Image properties"
        @submit.prevent="applyImageProperties"
      >
        <label>
          <span>Alternative text</span>
          <input v-model="imageAltDraft" :disabled="editingBlocked" />
        </label>
        <label>
          <span>Destination</span>
          <input
            v-model="imageDestinationDraft"
            :aria-invalid="imagePropertyError ? 'true' : undefined"
            :disabled="editingBlocked"
          />
        </label>
        <label>
          <span>Title</span>
          <input v-model="imageTitleDraft" :disabled="editingBlocked" />
        </label>
        <label>
          <span>Caption</span>
          <input v-model="imageCaptionDraft" :disabled="editingBlocked" />
        </label>
        <p v-if="imagePropertyError" role="alert">
          {{ imagePropertyError }}
        </p>
        <div :class="ns.e('media-actions')">
          <button type="submit" :disabled="editingBlocked">Apply</button>
          <button
            type="button"
            :disabled="editingBlocked"
            @click="revealActiveImageSource"
          >
            Source
          </button>
          <button
            type="button"
            :disabled="!activeImageOpenAllowed"
            @click="openActiveImage"
          >
            Open
          </button>
          <button type="button" @click="copyActiveFigure('exact')">
            Copy source
          </button>
          <button
            v-if="activeImage.figure"
            type="button"
            @click="copyActiveFigure('visible')"
          >
            Copy visible
          </button>
          <button
            type="button"
            :disabled="editingBlocked"
            @click="openActiveImageReplacement"
          >
            Replace
          </button>
          <button
            v-if="activeImage.figure"
            type="button"
            :disabled="editingBlocked"
            @click="removeActiveCaption"
          >
            Remove caption
          </button>
          <button
            type="button"
            :disabled="editingBlocked"
            @click="removeActiveImage"
          >
            Remove image
          </button>
        </div>
      </form>

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

      <div
        v-for="atomicNode in atomicActionNodes"
        :key="atomicNode.id"
        :class="ns.e('visually-hidden')"
        role="group"
        :aria-label="`${atomicNode.kind} atomic Markdown actions`"
        v-bind="{ 'data-markdown-atomic-actions': '' }"
      >
        <button
          type="button"
          tabindex="-1"
          :aria-label="`${atomicNode.kind} enter before`"
          @click="invokeAtomicNodeAction(atomicNode.id, 'caret-before')"
        >
          Enter before
        </button>
        <button
          type="button"
          tabindex="-1"
          :aria-label="`${atomicNode.kind} enter after`"
          @click="invokeAtomicNodeAction(atomicNode.id, 'caret-after')"
        >
          Enter after
        </button>
        <button
          type="button"
          tabindex="-1"
          :aria-label="`${atomicNode.kind} edit source`"
          @click="invokeAtomicNodeAction(atomicNode.id, 'enter-source')"
        >
          Edit source
        </button>
      </div>

      <el-markdown-renderer
        v-if="liveSurface.rendererVisible"
        :class="ns.e('preview')"
        :base-url="previewBaseUrl"
        :content="editorValue"
        :csp-nonce="previewCspNonce"
        :features="previewFeatures"
        mode="editor"
        @features-activated="emitRenderEvent('features-activated', $event)"
        @render-complete="emitRenderEvent('render-complete', $event)"
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
              <ul :aria-label="localeText.pasteAsMarkdown.conversionWarnings">
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
import {
  provideMarkdownEditorFrameScheduler,
  useMarkdownEditorFrameScheduler,
  useNamespace,
} from '@element-plus/hooks'
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
import {
  captureMarkdownAttachmentInput,
  createMarkdownAttachmentAtomicPresentation,
  createMarkdownAttachmentCaptureSession,
  type MarkdownAttachmentBatchIntent,
  type MarkdownAttachmentProviderResult,
  type MarkdownAttachmentSourceKind,
} from './markdown-editor-attachment'
import {
  cancelMarkdownAttachmentJob,
  planMarkdownAttachmentInsert,
  planMarkdownAttachmentRemove,
  planMarkdownAttachmentResolve,
  progressMarkdownAttachmentJob,
  rebaseMarkdownAttachmentJob,
  retryMarkdownAttachmentJob,
  type MarkdownAttachmentJob,
} from './markdown-editor-attachment-lifecycle'
import {
  decomposeMarkdownImageNode,
  planMarkdownImageAltEdit,
  planMarkdownImageDestinationEdit,
  planMarkdownImageRemove,
  planMarkdownImageTitleEdit,
  validateMarkdownPropertyUrl,
} from './markdown-editor-link-image'
import {
  findMarkdownFigures,
  formatMarkdownFigureExactCopy,
  formatMarkdownFigureVisibleCopy,
  planMarkdownCaptionEdit,
  planMarkdownCaptionInsert,
  planMarkdownCaptionRemove,
  planMarkdownFigureDelete,
} from './markdown-editor-caption'
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
import { resolveMarkdownLanguageToolCapability } from './markdown-editor-language-tools'
import {
  bindMarkdownWebLanguageTools,
  type MarkdownWebLanguageController,
} from './markdown-editor-language-web'
import { createMarkdownEditorNativeEventMachine } from './markdown-editor-native-event'
import { resolveMarkdownLiveSurface } from './markdown-editor-live-surface'
import {
  resolveMarkdownLiveSyntaxReveal,
  type MarkdownLiveRevealIntent,
} from './markdown-editor-live-reveal'
import {
  MARKDOWN_ATOMIC_NODE_KINDS,
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

import type { MarkdownHtmlImportSnapshot } from '../../../wasm/markdown-html-import'
import {
  createMarkdownAnchorMap,
  createMarkdownEditorProjection,
  stabilizeMarkdownEditorProjection,
  type MarkdownStableProjection,
} from '../../../wasm/markdown-runtime'

defineOptions({
  name: 'ElMarkdownEditor',
  inheritAttrs: false,
})

const props = defineProps(markdownEditorProps)
const emit = defineEmits(markdownEditorEmits)
const ns = useNamespace('markdown-editor')
const rootElementRef = ref<HTMLElement | null>(null)
const frameScheduler = useMarkdownEditorFrameScheduler({
  onFrameEnd: (metrics) => {
    const target = rootElementRef.value
    if (!target) return
    const next = JSON.stringify({
      coalesced: metrics.coalescedTasks,
      executed: metrics.executed,
      frame: metrics.frameId,
      pending: metrics.pendingTasks,
      stale: metrics.staleTasks,
      violations: metrics.readAfterWriteViolations,
    })
    if (target.dataset.markdownFrameMetrics !== next) {
      target.dataset.markdownFrameMetrics = next
    }
  },
})
provideMarkdownEditorFrameScheduler(frameScheduler)
const modes: MarkdownEditorMode[] = ['source', 'live', 'split', 'preview']
const commandTrayId = `${useId()}-command-tray`
const textareaRef = ref<HTMLTextAreaElement | null>(null)
let languageToolsController: MarkdownWebLanguageController | null = null
let languageToolsRevision = -1
let languageToolsSource = ''
let languageToolsConfigKey = ''
const attachmentInputRef = ref<HTMLInputElement | null>(null)
const attachmentReplaceRange = ref<{
  readonly nodeId: string
  readonly start: number
  readonly end: number
} | null>(null)
const pasteAsMarkdownDialogRef = ref<HTMLElement | null>(null)
const pasteAsMarkdownPrimaryActionRef = ref<HTMLButtonElement | null>(null)
const pasteAsMarkdownSession = ref<MarkdownPasteAsMarkdownSession | null>(null)
const pasteAsMarkdownError = ref('')
const pasteAsMarkdownBusy = ref(false)
const pasteAsMarkdownDescriptionId = `${useId()}-paste-as-markdown-description`
const pasteAsMarkdownTitleId = `${useId()}-paste-as-markdown-title`
const pasteAsMarkdownHelpId = `${useId()}-paste-as-markdown-help`
const commandsExpanded = ref(false)
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
  currentMode.value === 'live'
    ? 'Markdown editor live editing surface'
    : 'Markdown editor source',
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
const documentIdentity = Object.freeze(
  props.documentIdentity ?? { epoch: 0, id: commandTrayId },
)
const transactionStore = new MarkdownEditorTransactionStore(
  props.modelValue,
  initialSelection,
  documentIdentity,
)
const editorValue = ref(transactionStore.value)
let previousEditorProjection: MarkdownStableProjection | undefined
let previousEditorProjectionSource = ''
const editorProjection = computed(() => {
  const source = editorValue.value
  try {
    const change = previousEditorProjection
      ? deriveMarkdownEditorChange(previousEditorProjectionSource, source)
      : undefined
    const projection = stabilizeMarkdownEditorProjection(
      createMarkdownEditorProjection(source),
      documentIdentity,
      previousEditorProjection,
      change ?? undefined,
    )
    previousEditorProjection = projection
    previousEditorProjectionSource = source
    return projection
  } catch {
    return undefined
  }
})
const editorAnchorMap = computed(() => {
  const projection = editorProjection.value
  if (!projection) return undefined
  try {
    const syntax = projection.nodes.flatMap((node) => [
      {
        atomic: node.presentation === 'live-atomic',
        id: node.id,
        projectionId: node.id,
        range: node.rawRange,
      },
      ...node.rawMarkerRanges.map((range, index) => ({
        hidden: true,
        id: `${node.id}:marker:${index}`,
        parentId: node.id,
        projectionId: node.id,
        range,
      })),
    ])
    return createMarkdownAnchorMap({
      identity: documentIdentity,
      projection,
      source: editorValue.value,
      syntax,
    })
  } catch {
    return undefined
  }
})
const attachmentCaptureSession = createMarkdownAttachmentCaptureSession()
const attachmentJobs = ref<MarkdownAttachmentJob[]>([])
const attachmentBatches = new Map<string, MarkdownAttachmentBatchIntent>()
const attachmentItems = new Map<
  string,
  MarkdownAttachmentBatchIntent['items'][number]
>()
const attachmentPresentations = computed(() =>
  attachmentJobs.value
    .filter((job) => job.phase !== 'deleted')
    .map((job) => {
      const item = attachmentItems.get(job.itemId ?? job.id)
      return createMarkdownAttachmentAtomicPresentation({
        itemId: job.itemId ?? job.id,
        name: item?.name ?? 'Attachment',
        kind: item?.kind,
        status: job.phase === 'idle' ? 'pending' : job.phase,
        progress: job.progress,
      })
    }),
)
const selectionTick = ref(0)
const activeImage = computed(() => {
  void selectionTick.value
  if (currentMode.value === 'preview') return null
  const selection = transactionStore.selection
  const projection = createMarkdownEditorProjection(editorValue.value)
  const imageNode = projection.nodes
    .filter(
      (node) =>
        node.kind === 'image' &&
        selection.start >= node.rawRange.start &&
        selection.end <= node.rawRange.end,
    )
    .sort(
      (left, right) =>
        left.rawRange.end -
        left.rawRange.start -
        (right.rawRange.end - right.rawRange.start),
    )[0]
  if (!imageNode) return null
  const image = decomposeMarkdownImageNode(
    editorValue.value,
    imageNode.rawRange,
  )
  if (!image) return null
  const figure =
    findMarkdownFigures(editorValue.value).find(
      (candidate) =>
        candidate.mediaRange.start === imageNode.rawRange.start &&
        candidate.mediaRange.end === imageNode.rawRange.end,
    ) ?? null
  return Object.freeze({
    figure,
    image,
    nodeId: `image:${imageNode.rawRange.start}:${imageNode.rawRange.end}`,
    range: imageNode.rawRange,
  })
})
const imageAltDraft = ref('')
const imageDestinationDraft = ref('')
const imageTitleDraft = ref('')
const imageCaptionDraft = ref('')
const imagePropertyError = ref('')
watch(
  () => {
    const active = activeImage.value
    if (!active) return null
    return [
      active.nodeId,
      active.image.alt.value,
      active.image.destination.value,
      active.image.title?.value ?? '',
      active.figure?.text ?? '',
    ].join('\u0000')
  },
  () => {
    const active = activeImage.value
    imageAltDraft.value = active?.image.alt.value ?? ''
    imageDestinationDraft.value = active?.image.destination.value ?? ''
    imageTitleDraft.value = active?.image.title?.value ?? ''
    imageCaptionDraft.value = active?.figure?.text ?? ''
    imagePropertyError.value = ''
  },
  { immediate: true },
)
const activeImageUrlValidation = computed(() => {
  const active = activeImage.value
  if (!active) return null
  return validateMarkdownPropertyUrl(active.image.destination.value, {
    documentEpoch: documentIdentity.epoch,
    nodeId: active.nodeId,
    revision: transactionStore.revision,
    value: active.image.destination.value,
    version: 1,
  })
})
const activeImageOpenAllowed = computed(
  () => activeImageUrlValidation.value?.open.allowed === true,
)
const liveSurface = computed(() =>
  resolveMarkdownLiveSurface({
    documentIdentity,
    mode: currentMode.value,
    projection: editorProjection.value,
    projectionError: !editorProjection.value,
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
const languageCapability = computed(() =>
  resolveMarkdownLanguageToolCapability({
    lang: props.lang,
    nativeWritingTools: props.nativeWritingTools,
    spellcheck: props.spellcheck,
  }),
)
const languageToolsConfig = () => ({
  lang: props.lang,
  nativeWritingTools: props.nativeWritingTools,
  spellcheck: props.spellcheck,
})
const syncLanguageToolsState = () => {
  const controller = languageToolsController
  if (!controller) return null
  const config = languageToolsConfig()
  const configKey = JSON.stringify(config)
  if (
    languageToolsRevision !== transactionStore.revision ||
    languageToolsSource !== transactionStore.value ||
    languageToolsConfigKey !== configKey
  ) {
    controller.updateState({
      anchorMap: editorAnchorMap.value,
      config,
      projection: editorProjection.value,
      projectionRevision: transactionStore.revision,
      revision: transactionStore.revision,
      source: transactionStore.value,
    })
    languageToolsRevision = transactionStore.revision
    languageToolsSource = transactionStore.value
    languageToolsConfigKey = configKey
  }
  controller.switchMode(currentMode.value)
  return controller.updateContext({
    disabled: inputDisabled.value,
    isComposing: nativeMachine.composing,
    mode: currentMode.value,
    readonly: props.readonly,
    selection: transactionStore.selection,
  })
}
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
const atomicActionNodes = computed(() => {
  if (currentMode.value !== 'live') return []
  return MARKDOWN_ATOMIC_NODE_KINDS.map((kind) =>
    resolveMarkdownAtomicNodeIntent({
      action: 'caret-before',
      documentIdentity,
      kind,
      mode: currentMode.value,
      revision: transactionStore.revision,
      selection: transactionStore.selection,
      source: editorValue.value,
    }),
  )
    .filter(
      (
        plan,
      ): plan is MarkdownAtomicNodePlan & { kind: string; nodeId: string } =>
        plan.state === 'current' &&
        plan.kind !== null &&
        plan.nodeId !== null &&
        (plan.kind !== 'attachment' ||
          editorValue.value.includes('pending://')),
    )
    .map((plan) => ({ id: plan.nodeId, kind: plan.kind }))
})
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
let viewportRestoreCurrentScrollTop = 0
let viewportRestoreNextScrollTop: number | null = null
const liveDecorations = computed(() => {
  const decorations = liveSurface.value.decorations
  if (currentMode.value !== 'live' || !liveWindow.value) return decorations
  const mounted = new Set(liveWindow.value.mountedNodeIds)
  return decorations.filter((decoration) => mounted.has(decoration.nodeId))
})
const restoreTextareaViewport = (plan: MarkdownLiveLayoutPlan) => {
  const textarea = textareaRef.value
  if (!textarea || plan.action !== 'restore' || !plan.anchor) return
  const anchor = plan.anchor
  const line =
    transactionStore.value.slice(0, anchor.sourceOffset).split('\n').length - 1
  frameScheduler.schedule({
    // Same-frame supersede: a newer layout plan (or a user gesture yield)
    // replaces or cancels this restore before the frame commits it.
    guard: () => liveLayout.value === plan,
    key: 'viewport-restore',
    measure: () => {
      const target = textareaRef.value
      if (!target) {
        viewportRestoreNextScrollTop = null
        return
      }
      const lineHeight =
        Number.parseFloat(window.getComputedStyle(target).lineHeight) || 20
      viewportRestoreNextScrollTop = Math.max(
        0,
        line * lineHeight - target.clientHeight / 3,
      )
      viewportRestoreCurrentScrollTop = target.scrollTop
    },
    mutate: () => {
      const target = textareaRef.value
      if (
        !target ||
        viewportRestoreNextScrollTop === null ||
        Math.abs(
          viewportRestoreCurrentScrollTop - viewportRestoreNextScrollTop,
        ) <= 1
      ) {
        viewportRestoreNextScrollTop = null
        return
      }
      restoringViewport = true
      target.scrollTop = viewportRestoreNextScrollTop
      viewportRestoreNextScrollTop = null
      queueMicrotask(() => {
        restoringViewport = false
      })
    },
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
let virtualWindowNext: MarkdownLiveVirtualWindow | null = null
const refreshLiveWindow = (
  origin: 'input' | 'document-switch' | 'mode-switch' | 'feature' | 'initial',
) => {
  frameScheduler.schedule({
    key: 'virtual-window',
    // The window plan is pure data (projection + selection distance); it is
    // recomputed in the measure phase so rapid input always commits the
    // freshest window, and the mount/unmount commit lands in the mutate phase.
    measure: () => {
      virtualWindowNext = resolveMarkdownLiveVirtualWindow({
        documentIdentity,
        origin,
        previousMountedNodeIds: liveWindow.value?.mountedNodeIds,
        selection: transactionStore.selection,
        source: transactionStore.value,
      })
    },
    mutate: () => {
      if (virtualWindowNext) liveWindow.value = virtualWindowNext
      virtualWindowNext = null
    },
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
const invokeAtomicNodeAction = (
  nodeId: string,
  action: Parameters<typeof resolveMarkdownAtomicNodeIntent>[0]['action'],
) => {
  const plan = resolveMarkdownAtomicNodeIntent({
    action,
    composing: isComposing.value,
    documentIdentity,
    mode: currentMode.value,
    nodeId,
    revision: transactionStore.revision,
    selection: captureSelection(),
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

  if (result.accepted && result.value !== previousValue) {
    const appliedChanges =
      operation.kind === 'transaction'
        ? operation.transaction.changes
        : (() => {
            const change = deriveMarkdownEditorChange(
              previousValue,
              result.value,
            )
            return change ? [change] : []
          })()
    const ownedItemId =
      operation.kind === 'transaction'
        ? operation.transaction.metadata?.attachmentItemId
        : undefined
    for (const job of attachmentJobs.value) {
      if (job.itemId === ownedItemId || job.phase === 'deleted') continue
      rebaseMarkdownAttachmentJob(job, appliedChanges)
    }
    triggerRef(attachmentJobs)
  }

  if (
    result.accepted &&
    result.value !== previousValue &&
    (operation.kind !== 'transaction' || operation.emitValue !== false)
  ) {
    emit(UPDATE_MODEL_EVENT, result.value)
    emit(CHANGE_EVENT, result.value)
    refreshLiveWindow('input')
  }
  if (result.accepted) syncLanguageToolsState()
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
  selectionTick.value += 1
  return selection
}

const captureAttachmentFiles = (
  sourceKind: MarkdownAttachmentSourceKind,
  files: readonly File[],
  selection: MarkdownEditorSelection,
  eventFingerprint?: string,
  nodeId: string | null = null,
) => {
  const captured = captureMarkdownAttachmentInput({
    sourceKind,
    documentIdentity,
    revision: transactionStore.revision,
    anchor: { range: selection, nodeId },
    files: files.map((file) => ({
      name: file.name,
      mimeType: file.type,
      byteLength: file.size,
    })),
    context: {
      readonly: props.readonly,
      disabled: inputDisabled.value,
      mode: currentMode.value,
      isComposing: isComposing.value,
      currentRevision: transactionStore.revision,
    },
    eventFingerprint,
    session: attachmentCaptureSession,
  })
  if (!captured.ok) return captured

  const planned = planMarkdownAttachmentInsert(
    transactionStore.value,
    captured.batch.anchor,
    captured.batch,
  )
  const dispatched = dispatchTransaction(planned.transaction)
  if (!dispatched.accepted) return captured

  attachmentBatches.set(captured.batch.batchId, captured.batch)
  for (const item of captured.batch.items)
    attachmentItems.set(item.itemId, item)
  attachmentJobs.value = [...attachmentJobs.value, ...planned.jobs]
  emit('upload-image', captured.batch)
  return captured
}

const resolveDropSelection = (
  event: DragEvent,
): MarkdownEditorSelection | null => {
  const textarea = textareaRef.value
  if (!textarea || typeof document === 'undefined') return null
  const caretDocument = document as Document & {
    caretPositionFromPoint?: (
      x: number,
      y: number,
    ) => { readonly offset: number; readonly offsetNode: Node } | null
    caretRangeFromPoint?: (x: number, y: number) => Range | null
  }
  const position = caretDocument.caretPositionFromPoint?.(
    event.clientX,
    event.clientY,
  )
  const range = position
    ? null
    : caretDocument.caretRangeFromPoint?.(event.clientX, event.clientY)
  const offset =
    position?.offsetNode === textarea
      ? position.offset
      : range?.startContainer === textarea
        ? range.startOffset
        : null
  if (offset === null) return null

  const bounded = Math.max(0, Math.min(transactionStore.value.length, offset))
  const anchorMap = createMarkdownAnchorMap({
    identity: documentIdentity,
    source: transactionStore.value,
  })
  const mapped = anchorMap.visualAnchorToSourceSelection(
    anchorMap.sourceRangeToVisual({ start: bounded, end: bounded }),
  )
  return Object.freeze({
    direction: 'none' as const,
    start: mapped.anchor,
    end: mapped.focus,
  })
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
    syncLanguageToolsState()
  },
)

watch(
  [() => props.lang, () => props.nativeWritingTools, () => props.spellcheck],
  () => syncLanguageToolsState(),
)

watch(
  () => props.modelValue,
  (value) => {
    if (value === transactionStore.value) return

    abortPendingCommands()
    // Document switch: pending frame tasks from the previous document must
    // not commit geometry into the new document (#640 stale cancellation).
    frameScheduler.cancelAll()
    // One settle frame samples the scheduler so evidence can observe that no
    // stale task survived the document switch.
    frameScheduler.schedulePostPaint('frame-metrics-settle', () => undefined)
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
    dispatchEditorOperation({
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

let viewportHeightNext: number | null = null
let viewportTrigger: MarkdownLiveLayoutTrigger | null = null
const updateVisualViewportHeight = () => {
  if (typeof window === 'undefined') return

  frameScheduler.schedule({
    key: 'visual-viewport-read',
    measure: () => {
      const height = window.visualViewport?.height || window.innerHeight || 0
      const previous = visualViewportHeight.value
      viewportHeightNext = height
      viewportTrigger =
        previous > 0 && height + 80 < previous
          ? 'soft-keyboard'
          : 'visual-viewport'
    },
    mutate: () => {
      if (viewportHeightNext === null) return
      visualViewportHeight.value = viewportHeightNext
      const trigger = viewportTrigger ?? 'visual-viewport'
      viewportHeightNext = null
      viewportTrigger = null
      // Applies the (already planned) layout response; a resulting scroll
      // restore is measured in the next frame because this mutate phase has
      // already begun — the read-after-write violation counter records it.
      applyLiveLayout(trigger)
    },
  })
}

onMounted(() => {
  const textarea = textareaRef.value
  if (textarea) {
    languageToolsController = bindMarkdownWebLanguageTools(textarea, {
      anchorMap: editorAnchorMap.value,
      config: languageToolsConfig(),
      documentIdentity,
      mode: currentMode.value,
      projection: editorProjection.value,
      projectionRevision: transactionStore.revision,
      revision: transactionStore.revision,
      source: transactionStore.value,
    })
    languageToolsRevision = transactionStore.revision
    languageToolsSource = transactionStore.value
    languageToolsConfigKey = JSON.stringify(languageToolsConfig())
    syncLanguageToolsState()
  }
  refreshLiveWindow('initial')
  updateVisualViewportHeight()
  window.visualViewport?.addEventListener('resize', updateVisualViewportHeight)
  window.visualViewport?.addEventListener('scroll', updateVisualViewportHeight)
  window.addEventListener('resize', updateVisualViewportHeight)
})

onBeforeUnmount(() => {
  languageToolsController = null
  abortPendingCommands()
  attachmentCaptureSession.clear()
  attachmentBatches.clear()
  attachmentItems.clear()
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
  syncLanguageToolsState()
  if (event.inputType === 'insertReplacementText' && languageToolsController) {
    const replacement = languageToolsController.handleBeforeInput(event)
    if (replacement.handled && replacement.transaction) {
      dispatchTransaction(replacement.transaction)
      beforeInputSnapshot = undefined
      pendingClipboardIdentity = undefined
      pendingInputOrigin = undefined
      return
    }
    if (replacement.handled) {
      beforeInputSnapshot = undefined
      pendingClipboardIdentity = undefined
      pendingInputOrigin = undefined
      return
    }
  }
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
  if (
    plan.action === 'dedup' ||
    plan.action === 'prevent' ||
    plan.action === 'ignore'
  ) {
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
  attachmentSelection?: MarkdownEditorSelection | null,
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
    selection: attachmentSelection ?? captureSelection(),
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
    if (plan.action === 'attachment-intent') {
      if (origin === 'drop' && !attachmentSelection) return
      captureAttachmentFiles(
        origin,
        Array.from(data?.files ?? []),
        attachmentSelection ?? captureSelection(),
        plan.identity,
      )
    }
    if (plan.transaction) dispatchTransaction(plan.transaction)
    return
  }

  event.preventDefault()
}

const handlePaste = (event: ClipboardEvent) => {
  applyClipboardTransfer(event, 'paste', event.clipboardData)
}

const handleDrop = (event: DragEvent) => {
  event.preventDefault()
  applyClipboardTransfer(
    event,
    'drop',
    event.dataTransfer,
    resolveDropSelection(event),
  )
}

const handleCopy = (event: ClipboardEvent) => {
  if (
    currentMode.value === 'live' &&
    atomicSession.value?.phase === 'selected'
  ) {
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
  if (
    currentMode.value === 'live' &&
    atomicSession.value?.phase === 'selected'
  ) {
    const atomic = applyAtomicIntent('cut')
    if (atomic.copy && 'payload' in atomic.copy) {
      event.preventDefault()
      writeMarkdownClipboardPayload(event.clipboardData, atomic.copy.payload)
      return
    }
    if (atomic.copy && 'copy' in atomic.copy) {
      event.preventDefault()
      writeMarkdownClipboardPayload(
        event.clipboardData,
        atomic.copy.copy.payload,
      )
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
  syncLanguageToolsState()
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
    if (
      !isMarkdownEditorCommandVisible(command, context) ||
      !isMarkdownEditorCommandEnabled(command, context)
    )
      return
    const result = await runMarkdownEditorCommand(command, context)
    if (
      commandController.signal.aborted ||
      commandControllers.get(command.key) !== commandController
    )
      return
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
  attachmentInputRef.value?.click()
}

const handleAttachmentPickerChange = (event: Event) => {
  const input = event.currentTarget
  if (!(input instanceof HTMLInputElement)) return
  const files = Array.from(input.files ?? [])
  if (files.length > 0) {
    const replacement = attachmentReplaceRange.value
    captureAttachmentFiles(
      'pick',
      files,
      replacement
        ? {
            direction: 'none',
            end: replacement.end,
            start: replacement.start,
          }
        : captureSelection(),
      `pick:${event.timeStamp}:${files.map((file) => `${file.name}:${file.size}:${file.lastModified}`).join('|')}`,
      replacement?.nodeId ?? null,
    )
  }
  attachmentReplaceRange.value = null
  input.value = ''
}

const applyAttachmentResult = (result: MarkdownAttachmentProviderResult) => {
  const job = attachmentJobs.value.find(
    (candidate) => candidate.itemId === result.itemId,
  )
  if (!job) return false
  if (result.status === 'progress') {
    const ratio = result.ratio ?? 0
    progressMarkdownAttachmentJob(job, ratio <= 1 ? ratio * 100 : ratio)
    triggerRef(attachmentJobs)
    return true
  }

  const planned = planMarkdownAttachmentResolve(
    transactionStore.value,
    job,
    result,
  )
  triggerRef(attachmentJobs)
  if (!planned.transaction) return planned.accepted
  return dispatchTransaction({
    ...planned.transaction,
    metadata: Object.freeze({ attachmentItemId: job.itemId }),
  }).accepted
}

const runAttachmentAction = (
  itemId: string,
  action: 'cancel' | 'retry' | 'remove',
) => {
  const job = attachmentJobs.value.find(
    (candidate) => candidate.itemId === itemId,
  )
  if (!job) return
  if (action === 'cancel') {
    cancelMarkdownAttachmentJob(job)
  } else if (action === 'retry') {
    retryMarkdownAttachmentJob(job)
    const batch = job.batchId ? attachmentBatches.get(job.batchId) : undefined
    const item = attachmentItems.get(itemId)
    if (batch && item) {
      emit(
        'upload-image',
        Object.freeze({ ...batch, items: Object.freeze([item]) }),
      )
    }
  } else {
    const planned = planMarkdownAttachmentRemove(transactionStore.value, job)
    dispatchTransaction({
      ...planned.transaction,
      metadata: Object.freeze({ attachmentItemId: job.itemId }),
    })
  }
  triggerRef(attachmentJobs)
  applyLiveLayout('block-height-change')
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
  if (editingBlocked.value || nativeMachine.freezeSmartInput) return

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
    if (
      event.key === 'Enter' &&
      !event.altKey &&
      !event.ctrlKey &&
      !event.metaKey
    ) {
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
  if (blockKey && !event.altKey && !event.ctrlKey && !event.metaKey) {
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

const dispatchTransaction = (transaction: MarkdownEditorTransaction) => {
  const result = dispatchEditorOperation({
    kind: 'transaction',
    transaction,
  })
  selectionTick.value += 1
  return result
}

const applyImageProperties = () => {
  const active = activeImage.value
  if (!active || editingBlocked.value || isComposing.value) return
  const source = transactionStore.value
  const destinationValidation = validateMarkdownPropertyUrl(
    imageDestinationDraft.value,
    {
      documentEpoch: documentIdentity.epoch,
      nodeId: active.nodeId,
      revision: transactionStore.revision,
      value: imageDestinationDraft.value,
      version: 1,
    },
  )
  if (!destinationValidation.open.allowed) {
    imagePropertyError.value = `Destination rejected: ${destinationValidation.state}`
    return
  }

  const transactions: MarkdownEditorTransaction[] = []
  if (imageAltDraft.value !== active.image.alt.value) {
    transactions.push(
      planMarkdownImageAltEdit(source, active.range, imageAltDraft.value),
    )
  }
  if (imageDestinationDraft.value !== active.image.destination.value) {
    transactions.push(
      planMarkdownImageDestinationEdit(
        source,
        active.range,
        imageDestinationDraft.value,
      ),
    )
  }
  if (imageTitleDraft.value !== (active.image.title?.value ?? '')) {
    transactions.push(
      planMarkdownImageTitleEdit(
        source,
        active.range,
        imageTitleDraft.value || null,
      ),
    )
  }
  if (active.figure) {
    if (imageCaptionDraft.value !== active.figure.text) {
      transactions.push(
        imageCaptionDraft.value
          ? planMarkdownCaptionEdit(
              source,
              active.figure.captionNode,
              imageCaptionDraft.value,
            )
          : planMarkdownCaptionRemove(source, active.figure.captionNode),
      )
    }
  } else if (imageCaptionDraft.value) {
    transactions.push(
      planMarkdownCaptionInsert(source, active.range, imageCaptionDraft.value),
    )
  }

  const changes = transactions
    .flatMap((transaction) => transaction.changes)
    .filter((change) => source.slice(change.from, change.to) !== change.insert)
    .sort((left, right) => left.from - right.from || left.to - right.to)
  if (!changes.length) {
    imagePropertyError.value = ''
    return
  }
  const result = dispatchTransaction({
    changes: Object.freeze(changes),
    history: 'separate',
    origin: 'command',
  })
  imagePropertyError.value = result.accepted
    ? ''
    : `Image properties rejected: ${result.reason ?? 'invalid-change'}`
}

const revealActiveImageSource = () => {
  const active = activeImage.value
  if (!active) return
  const range = active.figure?.captionRange ?? active.range
  setMode('source')
  transactionStore.setSelection(
    { direction: 'none', end: range.end, start: range.start },
    false,
  )
  selectionTick.value += 1
  void restoreTextareaSelection(transactionStore.selection)
}

const openActiveImage = () => {
  const validated = activeImageUrlValidation.value
  if (!validated?.open.allowed || typeof window === 'undefined') return
  window.open(
    validated.open.href,
    validated.open.target,
    validated.open.rel ? 'noopener,noreferrer' : undefined,
  )
}

const copyActiveFigure = async (mode: 'exact' | 'visible') => {
  const active = activeImage.value
  if (!active || typeof navigator === 'undefined') return
  const source = transactionStore.value
  const payload =
    active.figure && mode === 'visible'
      ? formatMarkdownFigureVisibleCopy(source, active.figure)
      : active.figure
        ? formatMarkdownFigureExactCopy(source, active.figure)
        : source.slice(active.range.start, active.range.end)
  await navigator.clipboard?.writeText(payload)
}

const openActiveImageReplacement = () => {
  const active = activeImage.value
  if (!active || editingBlocked.value || isComposing.value) return
  attachmentReplaceRange.value = Object.freeze({
    end: active.range.end,
    nodeId: active.nodeId,
    start: active.range.start,
  })
  attachmentInputRef.value?.click()
}

const removeActiveCaption = () => {
  const active = activeImage.value
  if (!active?.figure || editingBlocked.value || isComposing.value) return
  dispatchTransaction(
    planMarkdownCaptionRemove(
      transactionStore.value,
      active.figure.captionNode,
    ),
  )
}

const removeActiveImage = () => {
  const active = activeImage.value
  if (!active || editingBlocked.value || isComposing.value) return
  dispatchTransaction(
    active.figure
      ? planMarkdownFigureDelete(transactionStore.value, active.figure)
      : planMarkdownImageRemove(transactionStore.value, active.range),
  )
}

function undo() {
  const result = dispatchEditorOperation({ kind: 'undo' })
  selectionTick.value += 1
  return result
}

function redo() {
  const result = dispatchEditorOperation({ kind: 'redo' })
  selectionTick.value += 1
  return result
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
  applyAttachmentResult,
  dispatchTransaction,
  insertMarkdownAtCursor,
  redo,
  undo,
})
</script>
