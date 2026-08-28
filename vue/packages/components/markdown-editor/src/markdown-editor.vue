<template>
  <section
    ref="editorRootRef"
    v-bind="$attrs"
    :class="[
      ns.b(),
      ns.m(currentMode),
      ns.m(`chrome-${chrome}`),
      ns.m(`mobile-${mobileLayout}`),
      ns.m(`profile-${editorProfile}`),
      ns.m(`interaction-${interactionProfile}`),
      ns.m(`toolbar-${effectiveToolbarDensity}`),
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
          :aria-label="commandName(command)"
          :title="commandName(command)"
          @click="activateCommand(command)"
        >
          {{ commandName(command) }}
        </button>
        <button
          v-if="gatedPasteAsMarkdownCommand"
          type="button"
          :class="ns.e('command')"
          disabled
          :aria-describedby="pasteAsMarkdownDescriptionId"
          :aria-label="commandName(gatedPasteAsMarkdownCommand)"
          :title="commandName(gatedPasteAsMarkdownCommand)"
        >
          {{ commandName(gatedPasteAsMarkdownCommand) }}
        </button>
        <button
          v-if="overflowItemCount"
          ref="commandOverflowRef"
          type="button"
          :class="[ns.e('command-more'), ns.is('expanded', commandsExpanded)]"
          :aria-expanded="commandsExpanded"
          :aria-controls="commandTrayId"
          :aria-label="commandOverflowAriaLabel"
          aria-haspopup="true"
          :disabled="editingBlocked"
          @click="toggleCommands"
        >
          <span>{{ resolvedCommandOverflowLabel }}</span>
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
        ref="commandTrayRef"
        :class="ns.e('command-tray')"
        @keydown.esc.prevent.stop="closeCommandOverflow(true)"
      >
        <button
          v-for="command in overflowCommands"
          :key="command.key"
          type="button"
          :class="ns.e('command')"
          :disabled="isCommandDisabled(command)"
          :aria-describedby="commandDescriptionId(command)"
          :aria-label="commandName(command)"
          :title="commandName(command)"
          @click="activateOverflowCommand(command)"
        >
          {{ commandName(command) }}
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
        :aria-controls="activeSlashTrigger ? slashMenuId : undefined"
        :aria-activedescendant="
          activeSlashTrigger && slashCommands[activeSlashIndex]
            ? slashItemId(slashCommands[activeSlashIndex].key)
            : undefined
        "
        :aria-haspopup="activeSlashTrigger ? 'menu' : undefined"
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
        :class="ns.e('preview')"
        :base-url="previewBaseUrl"
        :content="editorValue"
        :csp-nonce="previewCspNonce"
        :features="previewFeatures"
        :loading-text="localeText.states.loading"
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
        :metrics="editorMetrics"
        :state="statusResolution.slotPayload.state"
        :capability="statusResolution.slotPayload.capability"
        :payload="statusResolution.slotPayload"
      >
        <div v-if="statusDensity === 'minimal'" :class="ns.e('status-summary')">
          <span>{{ characterCount }} {{ localeText.metrics.characters }}</span>
          <span>{{ wordCount }} {{ localeText.metrics.words }}</span>
        </div>
        <dl v-else :class="ns.e('status-details')">
          <div>
            <dt>{{ localeText.metrics.line }}</dt>
            <dd>{{ editorMetrics.caretLine }}</dd>
          </div>
          <div>
            <dt>{{ localeText.metrics.column }}</dt>
            <dd>{{ editorMetrics.caretColumn }}</dd>
          </div>
          <div>
            <dt>{{ localeText.metrics.lines }}</dt>
            <dd>{{ editorMetrics.lineCount }}</dd>
          </div>
          <div>
            <dt>{{ localeText.metrics.characters }}</dt>
            <dd>{{ editorMetrics.graphemeCount }}</dd>
          </div>
          <div>
            <dt>{{ localeText.metrics.words }}</dt>
            <dd>{{ editorMetrics.wordCount }}</dd>
          </div>
          <div>
            <dt>{{ localeText.metrics.selected }}</dt>
            <dd>{{ editorMetrics.graphemeSelectionLength }}</dd>
          </div>
          <div v-if="editorMetrics.byteCount !== undefined">
            <dt>{{ localeText.metrics.bytes }}</dt>
            <dd>{{ editorMetrics.byteCount }}</dd>
          </div>
        </dl>
      </slot>
    </footer>

    <div
      v-if="statusDensity === 'none' && statusResolution.ariaLiveMessage"
      :class="ns.e('visually-hidden')"
      aria-live="polite"
    >
      {{ statusResolution.ariaLiveMessage }}
    </div>

    <span
      v-for="item in commandSnapshot"
      v-show="commandStateText(item)"
      :id="commandStateId(item.key)"
      :key="item.key"
      :class="ns.e('visually-hidden')"
    >
      {{ commandStateText(item) }}
    </span>

    <div
      v-if="
        surfaceOptions.selectionToolbar &&
        selectionToolbarVisible &&
        selectionToolbarCommands.length
      "
      :class="ns.e('selection-toolbar')"
      role="toolbar"
      :aria-label="localeText.surfaces.selectionToolbar"
      :data-markdown-anchor-id="
        selectionToolbarPlacement.visual?.anchor.anchorId
      "
      :data-markdown-anchor-epoch="
        selectionToolbarPlacement.visual?.documentIdentity.epoch
      "
      :data-markdown-anchor-projection="
        selectionToolbarPlacement.reveal?.reveal.anchorId
      "
      @keydown.esc.prevent.stop="closeSelectionToolbar"
    >
      <button
        v-for="command in selectionToolbarCommands"
        :key="command.key"
        type="button"
        :class="ns.e('command')"
        :disabled="isCommandDisabled(command)"
        :aria-describedby="commandDescriptionId(command)"
        :aria-label="commandName(command)"
        :title="commandName(command)"
        @click="activateCommand(command)"
      >
        {{ commandName(command) }}
      </button>
    </div>

    <div
      v-if="
        surfaceOptions.slashMenu && activeSlashTrigger && slashCommands.length
      "
      :id="slashMenuId"
      :class="ns.e('slash-menu')"
      role="menu"
      :aria-label="localeText.surfaces.slashMenu"
      @keydown.esc.prevent.stop="closeSlashMenu"
    >
      <button
        v-for="(command, idx) in slashCommands"
        :id="slashItemId(command.key)"
        :key="command.key"
        type="button"
        role="menuitem"
        :class="[ns.e('command'), ns.is('active', idx === activeSlashIndex)]"
        :disabled="isCommandDisabled(command)"
        :aria-describedby="commandDescriptionId(command)"
        :aria-label="commandName(command)"
        @click="executeSlashCommand(command)"
        @mouseenter="activeSlashIndex = idx"
      >
        {{ commandName(command) }}
      </button>
    </div>

    <form
      v-if="contextualSurface === 'link-properties' && activeLink"
      ref="contextualSurfaceRef"
      :class="ns.e('property-surface')"
      role="dialog"
      :aria-label="localeText.contextual.editLink"
      :data-markdown-anchor-id="activeLink.nodeId"
      :data-markdown-anchor-epoch="documentIdentity.epoch"
      @submit.prevent="applyLinkProperties"
      @keydown.esc.prevent.stop="closeContextualSurface()"
    >
      <label :class="ns.e('property-field')">
        <span>{{ localeText.contextual.label }}</span>
        <input v-model="linkLabelDraft" type="text" />
      </label>
      <label
        v-if="activeLink.ranges.destination"
        :class="ns.e('property-field')"
      >
        <span>{{ localeText.contextual.destination }}</span>
        <input v-model="linkDestinationDraft" type="url" />
      </label>
      <label
        v-if="activeLink.kind === 'inline'"
        :class="ns.e('property-field')"
      >
        <span>{{ localeText.contextual.title }}</span>
        <input v-model="linkTitleDraft" type="text" />
      </label>
      <p v-if="contextualError" role="alert">{{ contextualError }}</p>
      <footer :class="ns.e('property-actions')">
        <button type="submit">{{ localeText.contextual.apply }}</button>
        <button v-if="activeLink.url" type="button" @click="openActiveLink">
          {{ localeText.contextual.open }}
        </button>
        <button type="button" @click="copyActiveLink">
          {{ localeText.contextual.copy }}
        </button>
        <button type="button" @click="revealActiveLink">
          {{ localeText.contextual.sourceReveal }}
        </button>
        <button type="button" @click="removeActiveLink">
          {{ localeText.contextual.removeLink }}
        </button>
        <button type="button" @click="closeContextualSurface()">
          {{ localeText.contextual.cancel }}
        </button>
      </footer>
    </form>

    <form
      v-else-if="contextualSurface === 'anchor-properties'"
      ref="contextualSurfaceRef"
      :class="ns.e('property-surface')"
      role="dialog"
      :aria-label="
        activeAnchor
          ? localeText.contextual.editAnchor
          : localeText.contextual.insertAnchor
      "
      :data-markdown-anchor-id="activeAnchor?.projectionId"
      :data-markdown-anchor-epoch="documentIdentity.epoch"
      @submit.prevent="applyAnchorProperties"
      @keydown.esc.prevent.stop="closeContextualSurface()"
    >
      <label :class="ns.e('property-field')">
        <span>{{ localeText.contextual.anchorId }}</span>
        <input
          v-model="anchorIdDraft"
          type="text"
          autocomplete="off"
          pattern="[a-z][a-z0-9-]{0,63}"
          required
        />
      </label>
      <p v-if="contextualError" role="alert">{{ contextualError }}</p>
      <footer :class="ns.e('property-actions')">
        <button type="submit">{{ localeText.contextual.apply }}</button>
        <button v-if="activeAnchor" type="button" @click="copyActiveAnchor">
          {{ localeText.contextual.copy }}
        </button>
        <button v-if="activeAnchor" type="button" @click="removeActiveAnchor">
          {{ localeText.contextual.removeAnchor }}
        </button>
        <button type="button" @click="closeContextualSurface()">
          {{ localeText.contextual.cancel }}
        </button>
      </footer>
    </form>

    <Teleport to="body">
      <div
        v-if="surfaceOptions.commandPalette && commandPaletteOpen"
        :class="ns.e('palette-backdrop')"
        :dir="commandPaletteDirection"
        @mousedown.self.prevent="closeCommandPalette"
      >
        <section
          :class="ns.e('palette-dialog')"
          role="dialog"
          aria-modal="true"
          :aria-label="localeText.commandPalette.title"
          @keydown="handleCommandPaletteKeydown"
        >
          <label
            :for="`${paletteListId}-search`"
            :class="[ns.e('palette-group-label'), ns.e('palette-search-label')]"
          >
            {{ localeText.commandPalette.searchPlaceholder }}
          </label>
          <input
            :id="`${paletteListId}-search`"
            ref="commandPaletteInputRef"
            v-model="paletteQuery"
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
            @keydown.down.prevent="selectNextPaletteItem"
            @keydown.up.prevent="selectPreviousPaletteItem"
            @keydown.enter.prevent="executeActivePaletteItem"
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
                  ns.is(
                    'active',
                    paletteItemIndex(item.key) === activePaletteIndex,
                  ),
                ]"
                role="option"
                :aria-selected="
                  paletteItemIndex(item.key) === activePaletteIndex
                "
                :aria-describedby="commandDescriptionId(item.command)"
                :disabled="isCommandDisabled(item.command)"
                @click="executePaletteCommand(item.command)"
              >
                <span>{{ commandName(item.command) }}</span>
                <kbd v-if="item.shortcut">{{ item.shortcut }}</kbd>
              </button>
            </div>
            <p v-if="!paletteCommands.length" :class="ns.e('palette-empty')">
              {{ localeText.commandPalette.empty }}
            </p>
          </div>
          <p :class="ns.e('visually-hidden')" aria-live="polite">
            {{ localeText.commandPalette.results(paletteCommands.length) }}
          </p>
        </section>
      </div>

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
  reactive,
  ref,
  shallowRef,
  triggerRef,
  useId,
  watch,
} from 'vue'
import { ElMarkdownRenderer } from '@element-plus/components/markdown-renderer'
import { CHANGE_EVENT, UPDATE_MODEL_EVENT } from '@element-plus/constants'
import { useNamespace } from '@element-plus/hooks'
import {
  createMarkdownAnchorMap,
  createMarkdownEditorProjection,
  stabilizeMarkdownEditorProjection,
} from '../../../wasm/markdown-runtime'
import {
  isMarkdownEditorCommandEnabled,
  isMarkdownEditorCommandVisible,
  markdownEditorEmits,
  markdownEditorProps,
  createMarkdownEditorMetricsSession,
  resolveMarkdownEditorCommandCopy,
  resolveMarkdownEditorLocaleText,
  resolveMarkdownEditorOverflowCommands,
  resolveMarkdownEditorPrimaryCommands,
  resolveMarkdownEditorSyntaxContext,
  resolveMarkdownEditorShortcut,
  runMarkdownEditorCommand,
} from './markdown-editor'
import {
  createMarkdownEditorCommandSnapshot,
  selectMarkdownEditorCommandSnapshot,
  type MarkdownEditorCommandSnapshotItem,
  type MarkdownEditorCommandRuntimeState,
} from './markdown-editor-command-snapshot'
import { resolveMarkdownEditorChromeRegions } from './markdown-editor-chrome'
import {
  composeMarkdownEditorPositionMapInstances,
  createMarkdownEditorPositionMap,
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
  MarkdownEditorPositionMap,
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
import { resolveMarkdownSelectionToolbarPlacement } from './markdown-editor-selection-toolbar'
import {
  abortMarkdownEditorCommandSessions,
  createMarkdownEditorCommandSession,
  rebaseMarkdownEditorCommandSession,
  resolveMarkdownEditorCommandSession,
  type MarkdownEditorCommandSession,
} from './markdown-editor-command-async'
import {
  planMarkdownSlashCommit,
  groupMarkdownEditorCommandSnapshot,
  resolveMarkdownSlashTrigger,
  searchMarkdownEditorCommandSnapshot,
} from './markdown-editor-surfaces'
import {
  parseMarkdownLinkNode,
  planMarkdownLinkPropertyEdit,
  planMarkdownLinkUnwrap,
  validateMarkdownPropertyUrl,
  type MarkdownParsedLink,
} from './markdown-editor-link-image'
import {
  currentMarkdownAnchors,
  planMarkdownAnchorCopy,
  planMarkdownAnchorEdit,
  planMarkdownAnchorInsert,
  planMarkdownAnchorRemove,
  type MarkdownProjectedAnchor,
} from './markdown-editor-anchor-commands'
import { resolveMarkdownEditorStatus } from './markdown-editor-status'
import {
  cancelMarkdownPasteAsMarkdown,
  confirmMarkdownPasteAsMarkdown,
  openMarkdownPasteAsMarkdown,
  type MarkdownPasteAsMarkdownChoice,
  type MarkdownPasteAsMarkdownRejection,
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
const editorRootRef = ref<HTMLElement | null>(null)
const commandTrayRef = ref<HTMLElement | null>(null)
const textareaRef = ref<HTMLTextAreaElement | null>(null)
const commandOverflowRef = ref<HTMLButtonElement | null>(null)
const commandPaletteInputRef = ref<HTMLInputElement | null>(null)
const paletteListId = `${useId()}-command-palette-list`
const slashMenuId = `${useId()}-slash-menu`
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
    ? localeText.value.textarea.live
    : localeText.value.textarea.source,
)
const compactMode = computed(() => props.mobileLayout === 'compact')
const effectiveToolbarDensity = computed(() =>
  compactMode.value ? 'minimal' : props.toolbarDensity,
)
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
const documentIdentity = reactive({
  epoch: props.documentIdentity?.epoch ?? 0,
  id: props.documentIdentity?.id ?? commandTrayId,
})
const transactionStore = new MarkdownEditorTransactionStore(
  props.modelValue,
  initialSelection,
  documentIdentity,
)
const editorRevision = ref(transactionStore.revision)
const editorSelection = ref(transactionStore.selection)
const editorValue = ref(transactionStore.value)
const liveSurface = computed(() =>
  createMarkdownLiveSurface({
    documentIdentity,
    mode: currentMode.value,
    revision: transactionStore.revision,
    source: editorValue.value,
  }),
)
const editorProjection = shallowRef(
  stabilizeMarkdownEditorProjection(
    createMarkdownEditorProjection(editorValue.value),
    documentIdentity,
  ),
)
const editorAnchorMap = computed(() =>
  createMarkdownAnchorMap({
    identity: documentIdentity,
    projection: editorProjection.value,
    source: editorValue.value,
  }),
)
const commandRevisionMaps = new Map<number, MarkdownEditorPositionMap>()
const refreshEditorProjection = (previousValue: string, nextValue: string) => {
  const change = deriveMarkdownEditorChange(previousValue, nextValue)
  editorProjection.value = stabilizeMarkdownEditorProjection(
    createMarkdownEditorProjection(nextValue),
    documentIdentity,
    editorProjection.value,
    change,
  )
  return change
}
const positionMapFromRevision = (
  fromRevision: number,
  toRevision: number,
): MarkdownEditorPositionMap | undefined => {
  if (fromRevision === toRevision) {
    return createMarkdownEditorPositionMap([], {
      documentIdentity,
      projection: editorProjection.value,
      source: editorValue.value,
    })
  }
  const maps: MarkdownEditorPositionMap[] = []
  for (let revision = fromRevision; revision < toRevision; revision += 1) {
    const map = commandRevisionMaps.get(revision)
    if (!map) return undefined
    maps.push(map)
  }
  return composeMarkdownEditorPositionMapInstances(maps)
}
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
const commandSessions = new Map<string, MarkdownEditorCommandSession>()
const commandRuntimeStates = ref(
  new Map<string, MarkdownEditorCommandRuntimeState>(),
)
const commandContextSignal = new AbortController().signal

const abortPendingCommands = () => {
  for (const session of commandSessions.values()) {
    session.abort.abort('editor-reset')
    commandRuntimeStates.value.set(session.key, {
      state: 'aborted',
    })
  }
  abortMarkdownEditorCommandSessions(commandSessions.values(), 'editor-reset')
  commandSessions.clear()
  triggerRef(commandRuntimeStates)
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
  const previousProjection = editorProjection.value
  const previousRevision = transactionStore.revision
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

  if (result.accepted && result.value !== previousValue) {
    const change = deriveMarkdownEditorChange(previousValue, result.value)
    if (change) {
      commandRevisionMaps.set(
        previousRevision,
        createMarkdownEditorPositionMap([change], {
          documentIdentity,
          projection: previousProjection,
          source: previousValue,
        }),
      )
      while (commandRevisionMaps.size > 128) {
        const oldest = commandRevisionMaps.keys().next().value
        if (oldest === undefined) break
        commandRevisionMaps.delete(oldest)
      }
      refreshEditorProjection(previousValue, result.value)
    }
  }
  editorValue.value = result.value
  editorRevision.value = result.revision
  editorSelection.value = result.selection
  if (
    contextualSurface.value &&
    result.revision !== contextualSurfaceRevision.value
  ) {
    contextualSurface.value = null
    contextualError.value = ''
  }
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
  editorSelection.value = selection
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

const metricsSession = createMarkdownEditorMetricsSession(props.metrics)
let metricsSource = editorValue.value
const editorMetrics = ref(
  metricsSession.calculate(metricsSource, {
    ...props.metrics,
    includeBytes: props.statusDensity === 'detailed',
    selection: editorSelection.value,
  }),
)
watch(
  [
    editorValue,
    editorSelection,
    () => props.metrics,
    () => props.statusDensity,
  ],
  ([value, selection, options, density]) => {
    const change = deriveMarkdownEditorChange(metricsSource, value) ?? {
      from: 0,
      insert: '',
      to: 0,
    }
    metricsSource = value
    editorMetrics.value = metricsSession.calculate(value, {
      ...options,
      change,
      includeBytes: density === 'detailed',
      selection,
    })
  },
  { deep: true },
)

const liveCapabilities = computed(() => [
  liveSurface.value.capability.capability,
])

const statusResolution = computed(() =>
  resolveMarkdownEditorStatus(
    editorValue.value,
    props.statusDensity,
    props.localeText,
    editorSelection.value,
    liveCapabilities.value,
    {
      mode: currentMode.value,
      readonly: editingBlocked.value,
      disabled: props.disabled,
      loading: props.loading,
    },
    editorMetrics.value,
  ),
)

const selectionToolbarCommands = computed(() =>
  selectMarkdownEditorCommandSnapshot(commandSnapshot.value, 'selection').map(
    (item) => item.command,
  ),
)
const selectionToolbarPlacement = computed(() =>
  resolveMarkdownSelectionToolbarPlacement(
    editorSelection.value,
    editorRevision.value,
    editorRevision.value,
    {
      anchorMap: editorAnchorMap.value,
      documentEpoch: documentIdentity.epoch,
      expectedEpoch: documentIdentity.epoch,
    },
  ),
)
const dismissedSelectionRevision = ref<number | null>(null)
const selectionToolbarVisible = computed(
  () =>
    selectionToolbarPlacement.value.visible &&
    dismissedSelectionRevision.value !== editorRevision.value,
)
const closeSelectionToolbar = () => {
  dismissedSelectionRevision.value = editorRevision.value
  textareaRef.value?.focus()
}
const contextualSurface = ref<'anchor-properties' | 'link-properties' | null>(
  null,
)
const contextualSurfaceEpoch = ref(documentIdentity.epoch)
const contextualSurfaceRevision = ref(editorRevision.value)
const contextualError = ref('')
const linkLabelDraft = ref('')
const linkDestinationDraft = ref('')
const linkTitleDraft = ref('')
const anchorIdDraft = ref('')
const currentSyntaxNode = computed(() => {
  const syntax = resolveMarkdownEditorSyntaxContext(
    editorProjection.value,
    editorSelection.value,
  )
  return syntax ? editorProjection.value.resolve(syntax.nodeId).node : undefined
})
const activeLink = computed<MarkdownParsedLink | undefined>(() => {
  const node = currentSyntaxNode.value
  return node?.kind === 'link'
    ? parseMarkdownLinkNode(editorValue.value, node)
    : undefined
})
const activeAnchor = computed<MarkdownProjectedAnchor | undefined>(() => {
  const syntax = currentSyntaxNode.value
  if (syntax?.kind !== 'anchor') return undefined
  return currentMarkdownAnchors(editorValue.value, editorProjection.value).find(
    (anchor) => anchor.projectionId === syntax.id,
  )
})
const closeContextualSurface = async (restore = true) => {
  contextualSurface.value = null
  contextualError.value = ''
  if (restore) await restoreTextareaSelection(editorSelection.value)
}
const openContextualSurface = async (
  surface: 'anchor-properties' | 'link-properties',
) => {
  contextualError.value = ''
  contextualSurfaceEpoch.value = documentIdentity.epoch
  contextualSurfaceRevision.value = editorRevision.value
  if (surface === 'link-properties') {
    const link = activeLink.value
    if (!link || link.kind === 'unsupported') return
    linkLabelDraft.value = link.labelText
    linkDestinationDraft.value = link.url ?? ''
    linkTitleDraft.value = link.title ?? ''
  } else {
    anchorIdDraft.value = activeAnchor.value?.id ?? ''
  }
  contextualSurface.value = surface
  await nextTick()
  contextualSurfaceRef.value?.querySelector<HTMLInputElement>('input')?.focus()
}
const contextualSurfaceRef = ref<HTMLElement | null>(null)
const contextualSurfaceIsCurrent = () =>
  contextualSurfaceEpoch.value === documentIdentity.epoch &&
  contextualSurfaceRevision.value === editorRevision.value
const applyLinkProperties = () => {
  const link = activeLink.value
  if (!link || !contextualSurfaceIsCurrent()) {
    contextualError.value = localeText.value.results.stale
    return
  }
  if (link.ranges.destination) {
    const validation = validateMarkdownPropertyUrl(linkDestinationDraft.value, {
      documentEpoch: documentIdentity.epoch,
      nodeId: link.nodeId,
      revision: editorRevision.value,
      value: linkDestinationDraft.value,
      version: 1,
    })
    if (!validation.open.allowed) {
      contextualError.value = localeText.value.contextual.unsafeUrl
      return
    }
  }
  const result = dispatchTransaction(
    planMarkdownLinkPropertyEdit(
      editorValue.value,
      link,
      {
        label: linkLabelDraft.value,
        ...(link.ranges.destination ? { url: linkDestinationDraft.value } : {}),
        ...(link.kind === 'inline' &&
        (link.title !== undefined || linkTitleDraft.value)
          ? { title: linkTitleDraft.value }
          : {}),
      },
      contextualSurfaceRevision.value,
    ),
  )
  if (result.accepted) void closeContextualSurface()
}
const removeActiveLink = () => {
  const link = activeLink.value
  if (!link || !contextualSurfaceIsCurrent()) {
    contextualError.value = localeText.value.results.stale
    return
  }
  const result = dispatchTransaction({
    ...planMarkdownLinkUnwrap(editorValue.value, link),
    expectedRevision: contextualSurfaceRevision.value,
  })
  if (result.accepted) void closeContextualSurface()
}
const revealActiveLink = () => {
  const link = activeLink.value
  if (!link || !contextualSurfaceIsCurrent()) return
  const reveal = editorAnchorMap.value.sourceRangeToReveal(link.ranges.full)
  const result = dispatchTransaction({
    changes: [],
    expectedRevision: contextualSurfaceRevision.value,
    history: 'skip',
    metadata: Object.freeze({
      anchorId: reveal.reveal.anchorId,
      action: 'source-reveal',
    }),
    origin: 'command',
    selection: {
      start: reveal.reveal.range.start,
      end: reveal.reveal.range.end,
    },
  })
  if (result.accepted) void closeContextualSurface()
}
const copyActiveLink = async () => {
  const link = activeLink.value
  if (!link || !contextualSurfaceIsCurrent()) return
  try {
    await navigator.clipboard.writeText(link.url ?? link.labelText)
  } catch {
    contextualError.value = localeText.value.pasteAsMarkdown.clipboardFailed
  }
}
const openActiveLink = () => {
  const link = activeLink.value
  if (!link?.url || !contextualSurfaceIsCurrent()) return
  const validation = validateMarkdownPropertyUrl(link.url, {
    documentEpoch: documentIdentity.epoch,
    nodeId: link.nodeId,
    revision: editorRevision.value,
    value: link.url,
    version: 1,
  })
  if (!validation.open.allowed) {
    contextualError.value = localeText.value.contextual.unsafeUrl
    return
  }
  window.open(validation.open.href, validation.open.target, validation.open.rel)
}
const applyAnchorProperties = () => {
  if (!contextualSurfaceIsCurrent()) {
    contextualError.value = localeText.value.results.stale
    return
  }
  let transaction: MarkdownEditorTransaction
  try {
    transaction = activeAnchor.value
      ? planMarkdownAnchorEdit(
          editorValue.value,
          activeAnchor.value,
          anchorIdDraft.value,
          editorProjection.value,
        )
      : planMarkdownAnchorInsert(
          editorValue.value,
          editorSelection.value.start,
          anchorIdDraft.value,
          { projection: editorProjection.value },
        )
  } catch {
    contextualError.value = localeText.value.contextual.invalidAnchor
    return
  }
  const result = dispatchTransaction({
    ...transaction,
    expectedRevision: contextualSurfaceRevision.value,
  })
  if (result.accepted) void closeContextualSurface()
}
const removeActiveAnchor = () => {
  const anchor = activeAnchor.value
  if (!anchor || !contextualSurfaceIsCurrent()) return
  const result = dispatchTransaction({
    ...planMarkdownAnchorRemove(
      anchor,
      editorValue.value,
      editorProjection.value,
    ),
    expectedRevision: contextualSurfaceRevision.value,
  })
  if (result.accepted) void closeContextualSurface()
}
const copyActiveAnchor = async () => {
  const anchor = activeAnchor.value
  if (!anchor || !contextualSurfaceIsCurrent()) return
  try {
    await navigator.clipboard.writeText(planMarkdownAnchorCopy(anchor, 'exact'))
  } catch {
    contextualError.value = localeText.value.pasteAsMarkdown.clipboardFailed
  }
}

const slashTrigger = computed(() => {
  if (
    !surfaceOptions.value.slashMenu ||
    editingBlocked.value ||
    isComposing.value
  )
    return null
  return resolveMarkdownSlashTrigger(
    editorValue.value,
    editorSelection.value.start,
    {
      blockOnly: true,
      documentEpoch: documentIdentity.epoch,
      isComposing: isComposing.value,
      projection: editorProjection.value,
      revision: editorRevision.value,
    },
  )
})
const slashCommands = computed(() => {
  if (!slashTrigger.value) return []
  return searchMarkdownEditorCommandSnapshot(
    commandSnapshot.value,
    slashTrigger.value.query,
    'slash',
  ).map((item) => item.command)
})
const activeSlashIndex = ref(0)
const dismissedSlashTrigger = ref('')
const activeSlashTrigger = computed(() => {
  const trigger = slashTrigger.value
  if (!trigger) return null
  if (
    trigger.documentEpoch !== documentIdentity.epoch ||
    trigger.revision !== editorRevision.value ||
    (trigger.nodeId &&
      editorProjection.value.resolve(trigger.nodeId).status !== 'current')
  )
    return null
  const identity = `${trigger.documentEpoch}:${trigger.revision}:${trigger.nodeId ?? 'document'}:${trigger.range.start}:${trigger.range.end}`
  return dismissedSlashTrigger.value === identity ? null : trigger
})
const closeSlashMenu = () => {
  const trigger = slashTrigger.value
  if (trigger) {
    dismissedSlashTrigger.value = `${trigger.documentEpoch}:${trigger.revision}:${trigger.nodeId ?? 'document'}:${trigger.range.start}:${trigger.range.end}`
  }
  textareaRef.value?.focus()
}
const executeSlashCommand = (command: MarkdownEditorCommand) => {
  if (!activeSlashTrigger.value) return
  if (isCommandDisabled(command)) return
  void runCommand(command, activeSlashTrigger.value.range)
}
const slashItemId = (key: string) =>
  `${slashMenuId}-${key.replace(/[^a-zA-Z0-9_-]/gu, '-')}`
const moveSlashIndex = (direction: 1 | -1) => {
  if (!slashCommands.value.length) return
  for (let step = 1; step <= slashCommands.value.length; step += 1) {
    const candidate =
      (activeSlashIndex.value + direction * step + slashCommands.value.length) %
      slashCommands.value.length
    const command = slashCommands.value[candidate]
    if (command && !isCommandDisabled(command)) {
      activeSlashIndex.value = candidate
      return
    }
  }
}
const commandPaletteOpen = ref(false)
const commandPaletteDirection = ref<'ltr' | 'rtl'>('ltr')
const paletteQuery = ref('')
const activePaletteIndex = ref(0)
const paletteRestoreSelection = ref<MarkdownEditorSelection | null>(null)
const paletteCommandItems = computed(() =>
  searchMarkdownEditorCommandSnapshot(
    commandSnapshot.value,
    paletteQuery.value,
  ),
)
const paletteCommands = computed(() =>
  paletteCommandItems.value.map((item) => item.command),
)
const paletteCommandGroups = computed(() =>
  groupMarkdownEditorCommandSnapshot(paletteCommandItems.value),
)
const activePaletteCommand = computed(
  () => paletteCommands.value[activePaletteIndex.value],
)
const paletteItemId = (key: string) =>
  `${paletteListId}-${key.replace(/[^a-zA-Z0-9_-]/gu, '-')}`
const paletteItemIndex = (key: string) =>
  paletteCommands.value.findIndex((command) => command.key === key)
const openCommandPalette = () => {
  if (editingBlocked.value || isComposing.value) return
  const directionOwner = editorRootRef.value
  const declaredDirection =
    directionOwner?.closest<HTMLElement>('[dir]')?.dir ?? ''
  commandPaletteDirection.value =
    declaredDirection === 'rtl' ||
    (declaredDirection !== 'ltr' &&
      directionOwner &&
      getComputedStyle(directionOwner).direction === 'rtl')
      ? 'rtl'
      : 'ltr'
  paletteRestoreSelection.value = captureSelection(false)
  commandPaletteOpen.value = true
  paletteQuery.value = ''
  activePaletteIndex.value = Math.max(
    0,
    paletteCommands.value.findIndex((command) => !isCommandDisabled(command)),
  )
  void nextTick(() => commandPaletteInputRef.value?.focus())
}
const closeCommandPalette = () => {
  commandPaletteOpen.value = false
  const selection = paletteRestoreSelection.value
  paletteRestoreSelection.value = null
  if (selection) {
    void restoreTextareaSelection(selection)
  } else {
    textareaRef.value?.focus()
  }
}
const movePaletteIndex = (direction: 1 | -1) => {
  if (!paletteCommands.value.length) return
  for (let step = 1; step <= paletteCommands.value.length; step += 1) {
    const candidate =
      (activePaletteIndex.value +
        direction * step +
        paletteCommands.value.length) %
      paletteCommands.value.length
    const command = paletteCommands.value[candidate]
    if (command && !isCommandDisabled(command)) {
      activePaletteIndex.value = candidate
      return
    }
  }
}
const selectNextPaletteItem = () => movePaletteIndex(1)
const selectPreviousPaletteItem = () => movePaletteIndex(-1)
const executeActivePaletteItem = () => {
  const command = paletteCommands.value[activePaletteIndex.value]
  if (command && !isCommandDisabled(command)) {
    executePaletteCommand(command)
  }
}
const executePaletteCommand = (command: MarkdownEditorCommand) => {
  if (isCommandDisabled(command)) return
  closeCommandPalette()
  activateCommand(command)
}
const handleCommandPaletteKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape') {
    event.preventDefault()
    event.stopPropagation()
    closeCommandPalette()
    return
  }
  if (event.key !== 'Tab') return
  const controls = [
    commandPaletteInputRef.value,
    ...Array.from(
      document
        .getElementById(paletteListId)
        ?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? [],
    ),
  ].filter(
    (control): control is HTMLInputElement | HTMLButtonElement =>
      control !== null,
  )
  if (!controls.length) return
  const currentIndex = controls.indexOf(
    document.activeElement as HTMLInputElement | HTMLButtonElement,
  )
  const nextIndex = event.shiftKey
    ? (currentIndex - 1 + controls.length) % controls.length
    : (currentIndex + 1) % controls.length
  event.preventDefault()
  controls[nextIndex]?.focus()
}
const characterCount = computed(() => editorMetrics.value.graphemeCount)
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
  positionMap: createMarkdownEditorPositionMap([], {
    documentIdentity,
    projection: editorProjection.value,
    source: editorValue.value,
  }),
  projection: editorProjection.value,
  readonly: editingBlocked.value,
  revision: editorRevision.value,
  selection: editorSelection.value,
  signal: commandContextSignal,
  syntax: resolveMarkdownEditorSyntaxContext(
    editorProjection.value,
    editorSelection.value,
  ),
  value: transactionStore.value,
}))
const commandSnapshot = computed(() =>
  createMarkdownEditorCommandSnapshot(
    props.commands,
    commandContext.value,
    commandRuntimeStates.value,
  ),
)
const toolbarCommands = computed(() =>
  selectMarkdownEditorCommandSnapshot(commandSnapshot.value, 'toolbar').map(
    (item) => item.command,
  ),
)
const gatedPasteAsMarkdownCommand = computed(() =>
  pasteAsMarkdownGate.value &&
  !resolveMarkdownEditorPrimaryCommands(
    toolbarCommands.value,
    effectiveToolbarDensity.value,
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
const commandCopy = (command: MarkdownEditorCommand) =>
  resolveMarkdownEditorCommandCopy(command, localeText.value)
const commandName = (command: MarkdownEditorCommand) =>
  commandCopy(command).name
const commandGroupName = (group: string) =>
  localeText.value.commandGroups[group] ?? group
const pasteAsMarkdownGateDescription = computed(() => {
  const gate = pasteAsMarkdownGate.value
  return gate ? localeText.value.pasteAsMarkdown.disabledDescriptions[gate] : ''
})
const pasteAsMarkdownRejectionText = (
  rejection: MarkdownPasteAsMarkdownRejection,
) => {
  if (rejection === 'composition-active') {
    return localeText.value.pasteAsMarkdown.disabledDescriptions.composition
  }
  if (rejection === 'readonly') {
    return localeText.value.pasteAsMarkdown.disabledDescriptions.readonly
  }
  if (rejection === 'disabled') {
    return localeText.value.pasteAsMarkdown.disabledDescriptions.disabled
  }
  if (rejection === 'preview-only') {
    return localeText.value.pasteAsMarkdown.disabledDescriptions.previewOnly
  }
  return localeText.value.pasteAsMarkdown.stale
}
const isPasteAsMarkdownCommand = (command: MarkdownEditorCommand) =>
  command.key === 'paste-as-markdown'
const commandSnapshotItem = (command: MarkdownEditorCommand) =>
  commandSnapshot.value.find((item) => item.key === command.key)
const isCommandDisabled = (command: MarkdownEditorCommand) => {
  const item = commandSnapshotItem(command)
  return (
    editingBlocked.value ||
    item?.enabled === false ||
    (isPasteAsMarkdownCommand(command) &&
      (Boolean(pasteAsMarkdownGate.value) || pasteAsMarkdownBusy.value))
  )
}
watch(slashCommands, (commands) => {
  if (!commands.length) {
    activeSlashIndex.value = 0
    return
  }
  if (
    activeSlashIndex.value >= commands.length ||
    isCommandDisabled(commands[activeSlashIndex.value]!)
  ) {
    activeSlashIndex.value = 0
    if (isCommandDisabled(commands[0]!)) moveSlashIndex(1)
  }
})
watch(paletteCommands, (commands) => {
  if (!commands.length) {
    activePaletteIndex.value = 0
    return
  }
  if (
    activePaletteIndex.value >= commands.length ||
    isCommandDisabled(commands[activePaletteIndex.value]!)
  ) {
    activePaletteIndex.value = 0
    if (isCommandDisabled(commands[0]!)) movePaletteIndex(1)
  }
})
const commandStateId = (key: string) =>
  `${commandTrayId}-command-state-${key.replace(/[^a-zA-Z0-9_-]/gu, '-')}`
const commandStateText = (item: MarkdownEditorCommandSnapshotItem) => {
  if (item.disabledReason && item.state === 'idle') return item.disabledReason
  if (item.state === 'idle') return ''
  return localeText.value.results[item.state]
}
const commandDescriptionId = (command: MarkdownEditorCommand) => {
  if (isPasteAsMarkdownCommand(command) && pasteAsMarkdownGate.value) {
    return pasteAsMarkdownDescriptionId
  }
  const item = commandSnapshotItem(command)
  return item && commandStateText(item)
    ? commandStateId(command.key)
    : undefined
}
const primaryCommands = computed(() =>
  resolveMarkdownEditorPrimaryCommands(
    toolbarCommands.value,
    effectiveToolbarDensity.value,
    props.primaryCommandKeys,
  ),
)
const overflowCommands = computed(() =>
  resolveMarkdownEditorOverflowCommands(
    toolbarCommands.value,
    effectiveToolbarDensity.value,
    props.primaryCommandKeys,
  ),
)
const visibleActions = computed<MarkdownEditorActionItem[]>(() => {
  if (!props.showActions) return []

  const actions: MarkdownEditorActionItem[] = []
  if (props.showImageAction) {
    actions.push({
      key: 'image',
      label: props.imageActionLabel ?? localeText.value.actions.image,
    })
  }
  if (props.showSaveAction) {
    actions.push({
      key: 'save',
      label: props.saveActionLabel ?? localeText.value.actions.save,
    })
  }
  if (props.showSubmitAction) {
    actions.push({
      key: 'submit',
      label: props.submitActionLabel ?? localeText.value.actions.submit,
    })
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
watch(
  [() => props.documentIdentity?.id, () => props.documentIdentity?.epoch],
  ([id, epoch], [previousId, previousEpoch]) => {
    const nextId = id ?? commandTrayId
    const nextEpoch = epoch ?? 0
    if (nextId === previousId && nextEpoch === previousEpoch) return

    const previousHistory = transactionStore.history
    abortPendingCommands()
    commandPaletteOpen.value = false
    contextualSurface.value = null
    contextualError.value = ''
    paletteRestoreSelection.value = null
    commandsExpanded.value = false
    dismissedSlashTrigger.value = ''
    pasteAsMarkdownSession.value = null
    pasteAsMarkdownError.value = ''
    beforeInputSnapshot = undefined
    pendingClipboardIdentity = undefined
    pendingInputOrigin = undefined
    atomicSession.value = null
    liveAtomic.value = null

    documentIdentity.id = nextId
    documentIdentity.epoch = nextEpoch
    commandRevisionMaps.clear()
    nativeMachine.apply({
      documentIdentity,
      kind: 'external-reset',
      revision: transactionStore.revision,
      value: props.modelValue,
    })
    syncNativeComposing()

    transactionStore.switchDocument(documentIdentity, props.modelValue)
    const result = {
      history: transactionStore.history,
      revision: transactionStore.revision,
      selection: transactionStore.selection,
      value: transactionStore.value,
    }
    editorProjection.value = stabilizeMarkdownEditorProjection(
      createMarkdownEditorProjection(result.value),
      documentIdentity,
    )
    editorValue.value = result.value
    editorRevision.value = result.revision
    editorSelection.value = result.selection
    refreshLiveWindow('input')
    refreshLiveReveal()
    void restoreTextareaSelection(result.selection)
    if (!historiesEqual(previousHistory, result.history)) {
      emit('history-change', result.history)
    }
  },
)
const resolvedCommandOverflowLabel = computed(
  () => props.commandOverflowLabel ?? localeText.value.overflow,
)
const commandOverflowAriaLabel = computed(() =>
  props.commandOverflowLabel
    ? `${props.commandOverflowLabel} (${overflowItemCount.value})`
    : localeText.value.overflowAria(overflowItemCount.value),
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
  applyClipboardTransfer(event, 'paste', event.clipboardData)
}

const handleDrop = (event: DragEvent) => {
  applyClipboardTransfer(event, 'drop', event.dataTransfer)
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

class MarkdownClipboardUnavailableError extends Error {}

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
    throw new MarkdownClipboardUnavailableError()
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
        pasteAsMarkdownGateDescription.value ||
        pasteAsMarkdownRejectionText(opened.rejected)
      restorePasteAsMarkdownFocus(anchor.selection)
      return
    }
    pasteAsMarkdownSession.value = opened.session
    await nextTick()
    pasteAsMarkdownPrimaryActionRef.value?.focus()
  } catch (error) {
    pasteAsMarkdownError.value =
      error instanceof MarkdownClipboardUnavailableError
        ? localeText.value.pasteAsMarkdown.clipboardUnavailable
        : localeText.value.pasteAsMarkdown.clipboardFailed
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

const rebaseCommandTransaction = (
  transaction: MarkdownEditorTransaction,
  positionMap: MarkdownEditorPositionMap | undefined,
) => {
  if (!positionMap) return transaction
  const changes = transaction.changes.map((change) => {
    const rebased = positionMap.rebase({
      start: change.from,
      end: change.to,
    })
    if (rebased.status !== 'mapped') return undefined
    return Object.freeze({
      from: rebased.start,
      to: rebased.end,
      insert: change.insert,
    })
  })
  if (changes.some((change) => change === undefined)) return undefined
  const selection = transaction.selection
    ? positionMap.rebase({
        start: transaction.selection.start,
        end: transaction.selection.end,
      })
    : undefined
  if (selection?.status === 'deleted') return undefined
  return Object.freeze({
    ...transaction,
    changes: changes as MarkdownEditorTransaction['changes'],
    ...(selection
      ? {
          selection: {
            direction: transaction.selection?.direction,
            start: selection.start,
            end: selection.end,
          },
        }
      : {}),
  })
}

const runCommand = async (
  command: MarkdownEditorCommand,
  slashRange?: Readonly<{ start: number; end: number }>,
) => {
  if (editingBlocked.value || nativeMachine.freezeSmartInput) return
  const activeSession = commandSessions.get(command.key)
  if (activeSession?.state === 'pending' && !command.concurrent) return

  const selection = captureSelection()
  const initialContext = {
    ...commandContext.value,
    selection,
    syntax: resolveMarkdownEditorSyntaxContext(
      editorProjection.value,
      selection,
    ),
  }
  const session = createMarkdownEditorCommandSession(
    command.key,
    initialContext,
    {
      activeSessions: commandSessions,
      anchor: {
        ...(slashRange ?? selection),
        nodeId: initialContext.syntax?.nodeId,
      },
      concurrent: command.concurrent,
    },
  )
  commandSessions.set(command.key, session)
  commandRuntimeStates.value.set(command.key, { state: 'pending' })
  triggerRef(commandRuntimeStates)
  try {
    const context = {
      ...initialContext,
      signal: session.abort.signal,
    }
    if (
      !isMarkdownEditorCommandVisible(command, context) ||
      !isMarkdownEditorCommandEnabled(command, context)
    )
      return
    const result = await runMarkdownEditorCommand(command, context)
    if (commandSessions.get(command.key) !== session) return
    const currentContext = commandContext.value
    const positionMap = positionMapFromRevision(
      session.revision,
      currentContext.revision,
    )
    const rebasedState = rebaseMarkdownEditorCommandSession(
      session,
      currentContext,
      positionMap,
    )
    if (rebasedState !== 'pending') {
      commandRuntimeStates.value.set(command.key, { state: rebasedState })
      triggerRef(commandRuntimeStates)
      return
    }
    const resolvedState = resolveMarkdownEditorCommandSession(
      session,
      currentContext,
      'resolved-current',
    )
    commandRuntimeStates.value.set(command.key, { state: resolvedState })
    triggerRef(commandRuntimeStates)
    if (resolvedState !== 'resolved-current') return
    if (result?.surface) {
      await openContextualSurface(result.surface)
      return
    }
    if (!result?.transaction) {
      if (result?.focus !== 'surface' && result?.focus !== 'none') {
        await restoreTextareaSelection(selection)
      }
      return
    }
    const rebasedTransaction = rebaseCommandTransaction(
      result.transaction,
      positionMap,
    )
    if (!rebasedTransaction) {
      session.state = 'stale'
      commandRuntimeStates.value.set(command.key, { state: 'stale' })
      triggerRef(commandRuntimeStates)
      return
    }
    const transaction =
      slashRange && session.anchor
        ? planMarkdownSlashCommit(session.anchor, rebasedTransaction)
        : rebasedTransaction
    const dispatchResult = dispatchTransaction({
      ...transaction,
      expectedRevision: currentContext.revision,
      history: transaction.history ?? 'separate',
      metadata: Object.freeze({ command: command.key }),
      origin: 'command',
    })
    if (dispatchResult.accepted) emit('command', command)
    if (
      !dispatchResult.accepted &&
      result.focus !== 'surface' &&
      result.focus !== 'none'
    ) {
      await restoreTextareaSelection(selection)
    }
  } catch (error) {
    const state = resolveMarkdownEditorCommandSession(
      session,
      commandContext.value,
      'rejected',
      error,
    )
    commandRuntimeStates.value.set(command.key, { error, state })
    triggerRef(commandRuntimeStates)
    await restoreTextareaSelection(selection)
  } finally {
    if (commandSessions.get(command.key) === session) {
      commandSessions.delete(command.key)
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

const closeCommandOverflow = (restoreFocus = false) => {
  commandsExpanded.value = false
  if (restoreFocus) void nextTick(() => commandOverflowRef.value?.focus())
}

const toggleCommands = async () => {
  if (editingBlocked.value || isComposing.value) return
  commandsExpanded.value = !commandsExpanded.value
  if (!commandsExpanded.value) return
  await nextTick()
  commandTrayRef.value
    ?.querySelector<HTMLButtonElement>('button:not(:disabled)')
    ?.focus()
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
  if (editingBlocked.value || nativeMachine.freezeSmartInput) return

  if (activeSlashTrigger.value && slashCommands.value.length) {
    if (event.key === 'Escape') {
      event.preventDefault()
      closeSlashMenu()
      return
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      moveSlashIndex(event.key === 'ArrowDown' ? 1 : -1)
      return
    }
    if (event.key === 'Enter') {
      const command = slashCommands.value[activeSlashIndex.value]
      if (command) {
        event.preventDefault()
        executeSlashCommand(command)
      }
      return
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
  closeCommandPalette,
  dispatchTransaction,
  insertMarkdownAtCursor,
  openCommandPalette,
  redo,
  undo,
})
</script>
