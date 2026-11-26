<template>
  <section
    v-bind="rootAttrs"
    ref="rootElementRef"
    :class="[
      ns.b(),
      ns.m(currentMode),
      ns.m(`chrome-${chrome}`),
      ns.m(`mobile-${mobileLayout}`),
      ns.m(`profile-${editorProfile}`),
      ns.m(`interaction-${interactionProfile}`),
      ns.m(`toolbar-${effectiveToolbarDensity}`),
      ns.is('commands-expanded', commandsExpanded),
      ns.is('focus-mode', writingAidsFocusState.enabled),
      ns.is('live-visual', liveVisualActive),
      ns.is('composing', isComposing),
      ns.is('typewriter-mode', resolvedWritingAids.typewriter),
    ]"
    role="region"
    tabindex="-1"
    :aria-label="localeText.editorAria"
    :data-markdown-instance="commandTrayId"
    data-markdown-scroll-container="body"
    :style="editorStyle"
  >
    <markdown-editor-search-bar
      v-if="searchUiState.open"
      ref="searchBarRef"
      :editing-blocked="editingBlocked"
      :has-matches="searchMatches.length > 0"
      :locale-text="localeText"
      :query="searchQuery"
      :replace-text="searchReplaceText"
      :search-mode="searchMode"
      :search-ui-state="searchUiState"
      @close="closeSearch"
      @navigate="searchNavigate"
      @query-input="handleSearchQueryInput"
      @query-keydown="handleSearchInputKeydown"
      @replace-all="searchReplaceAll"
      @replace-current="searchReplaceCurrent"
      @replace-keydown="handleSearchReplaceKeydown"
      @toggle-mode="toggleSearchMode"
      @toggle-replace="toggleSearchReplace"
      @update:query="searchQuery = $event"
      @update:replace-text="searchReplaceText = $event"
    />

    <header
      v-if="chromeRegions.toolbar && surfaceOptions.toolbar"
      ref="toolbarRef"
      :class="ns.e('toolbar')"
    >
      <div ref="commandGroupRef" :class="ns.e('command-group')">
        <div ref="commandsRef" :class="ns.e('commands')">
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
        </div>
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
      <div
        ref="commandMeasureRef"
        :class="ns.e('command-measure')"
        aria-hidden="true"
      >
        <span
          v-for="command in configuredPrimaryCommands"
          :key="`measure:${command.key}`"
          :class="ns.e('command-measure-item')"
          data-measure-role="command"
        >
          {{ commandName(command) }}
        </span>
        <span
          v-if="gatedPasteAsMarkdownCommand"
          :class="ns.e('command-measure-item')"
          data-measure-role="reserved-end"
        >
          {{ commandName(gatedPasteAsMarkdownCommand) }}
        </span>
        <span :class="ns.e('command-measure-more')" data-measure-role="more">
          <span>{{ resolvedCommandOverflowLabel }}</span>
          <span :class="ns.e('command-more-count')">{{
            worstCaseOverflowCount
          }}</span>
        </span>
      </div>
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
      @scroll="handlePreviewScroll"
    >
      <pre
        v-if="writingAidsFocusState.enabled"
        ref="focusLayerRef"
        :class="[ns.e('focus-layer'), ns.is('live-visual', liveVisualActive)]"
        aria-hidden="true"
        :data-markdown-live-visual="liveVisualActive ? '' : undefined"
      ><template v-if="liveVisualActive"><span
          v-for="segment in liveVisualSegments"
          :key="segment.key"
          :class="[
            ns.e('live-token'),
            ns.em('live-token', segment.kind),
            ns.is('marker', segment.marker),
            ns.is('revealed', segment.revealed),
            ns.is('dimmed', segment.dimmed),
            ns.is('exempt', segment.exempt),
          ]"
          :data-live-kind="segment.kind"
          :data-node-id="segment.nodeId"
        >{{ segment.text }}</span></template><template v-else><span
          v-for="segment in focusSegments"
          :key="segment.key"
          :class="[
            ns.is('dimmed', segment.dimmed),
            ns.is('exempt', segment.exempt),
          ]"
          :data-node-id="segment.nodeId"
        >{{ segment.text }}</span></template></pre>
      <pre
        v-else-if="liveVisualActive"
        ref="liveLayerRef"
        :class="ns.e('live-layer')"
        aria-hidden="true"
        data-markdown-live-visual
      ><span
          v-for="segment in liveVisualSegments"
          :key="segment.key"
          :class="[
            ns.e('live-token'),
            ns.em('live-token', segment.kind),
            ns.is('marker', segment.marker),
            ns.is('revealed', segment.revealed),
          ]"
          :data-live-kind="segment.kind"
        >{{ segment.text }}</span></pre>
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
        :value="isComposing ? nativeCompositionValue : editorValue"
        :spellcheck="languageCapability.spellcheck"
        :lang="languageCapability.lang || undefined"
        @beforeinput="handleBeforeInput"
        @blur="handleBlur"
        @click="handlePointerReveal"
        @compositionend="handleCompositionEnd"
        @compositionstart="handleCompositionStart"
        @contextmenu="handleTableContextMenu"
        @copy="handleCopy"
        @cut="handleCut"
        @dragover.prevent
        @drop="handleDrop"
        @input="handleInput"
        @keydown="handleKeydown"
        @keyup="handleSelectionKeyup"
        @paste="handlePaste"
        @pointerdown="handleSelectionDragStart"
        @pointerup="handleSelectionDragEnd"
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
        :aria-label="localeText.attachments.region"
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

      <markdown-editor-media-panel
        v-if="activeImage"
        :alt="imageAltDraft"
        :caption="imageCaptionDraft"
        :destination="imageDestinationDraft"
        :editing-blocked="editingBlocked"
        :error="imagePropertyError"
        :has-figure="Boolean(activeImage.figure)"
        :locale-text="localeText"
        :open-allowed="activeImageOpenAllowed"
        :title="imageTitleDraft"
        @apply="applyImageProperties"
        @copy="copyActiveFigure"
        @open="openActiveImage"
        @remove-caption="removeActiveCaption"
        @remove-image="removeActiveImage"
        @replace="openActiveImageReplacement"
        @reveal-source="revealActiveImageSource"
        @update:alt="imageAltDraft = $event"
        @update:caption="imageCaptionDraft = $event"
        @update:destination="imageDestinationDraft = $event"
        @update:title="imageTitleDraft = $event"
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
          :aria-label="localeText.table.menuLabel"
          @click="toggleTableMenu"
        >
          {{ localeText.table.menuLabel }}
        </button>
        <div
          v-if="tableMenuOpen"
          :id="tableMenuId"
          ref="tableMenuRef"
          :class="ns.e('table-menu')"
          role="menu"
          :aria-label="localeText.table.menuLabel"
          @keydown="handleTableMenuKeydown"
        >
          <button
            v-for="action in tableContextActions"
            :key="action.key"
            type="button"
            role="menuitem"
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
      <div
        v-if="currentMode === 'live' && embedPresentationSegments.length"
        :class="ns.e('live-embeds')"
        :aria-label="localeText.embeds.region"
        role="region"
      >
        <markdown-editor-embed-card
          v-for="segment in embedPresentationSegments"
          :key="`live:${segment.key}`"
          :locale-text="localeText"
          :plan="segment.plan"
          @action="handleEmbedAction(segment, $event)"
        />
      </div>
      <div
        v-if="visibleSearchHighlights.length"
        :class="ns.e('search-highlights')"
        aria-hidden="true"
      >
        <span
          v-for="highlight in visibleSearchHighlights"
          :key="`search:${highlight.range.start}:${highlight.range.end}`"
          :class="[
            ns.e('search-highlight'),
            ns.is('current', highlight.current),
          ]"
          :style="searchHighlightStyle(highlight.range)"
        />
      </div>

      <div
        v-if="liveSurface.rendererVisible && embedRenderSegments.length > 1"
        ref="previewRendererRef"
        :class="ns.e('preview')"
      >
        <template v-for="segment in embedRenderSegments" :key="segment.key">
          <el-markdown-renderer
            v-if="segment.kind === 'markdown' && segment.content"
            :base-url="previewBaseUrl"
            :content="segment.content"
            :csp-nonce="previewCspNonce"
            :features="previewFeatures"
            mode="editor"
            @features-activated="emitRenderEvent('features-activated', $event)"
            @render-complete="handleRendererComplete($event)"
            @render-error="emitRenderEvent('render-error', $event)"
          />
          <markdown-editor-embed-card
            v-else-if="segment.kind === 'embed'"
            :locale-text="localeText"
            :plan="segment.plan"
            @action="handleEmbedAction(segment, $event)"
          />
        </template>
      </div>

      <template v-if="atomicActionNodes.length">
        <div
          v-for="atomicNode in atomicActionNodes"
          :key="atomicNode.id"
          :class="ns.e('visually-hidden')"
          role="group"
          :aria-label="localeText.atomic.actionsRegion(atomicNode.kind)"
          v-bind="{ 'data-markdown-atomic-actions': '' }"
        >
          <button
            type="button"
            tabindex="-1"
            :aria-label="localeText.atomic.enterBefore(atomicNode.kind)"
            @click="invokeAtomicNodeAction(atomicNode.id, 'caret-before')"
          >
            {{ localeText.atomic.enterBefore(atomicNode.kind) }}
          </button>
          <button
            type="button"
            tabindex="-1"
            :aria-label="localeText.atomic.enterAfter(atomicNode.kind)"
            @click="invokeAtomicNodeAction(atomicNode.id, 'caret-after')"
          >
            {{ localeText.atomic.enterAfter(atomicNode.kind) }}
          </button>
          <button
            type="button"
            tabindex="-1"
            :aria-label="localeText.atomic.editSource(atomicNode.kind)"
            @click="invokeAtomicNodeAction(atomicNode.id, 'enter-source')"
          >
            {{ localeText.atomic.editSource(atomicNode.kind) }}
          </button>
        </div>
      </template>

      <el-markdown-renderer
        v-else-if="
          liveSurface.rendererVisible && embedRenderSegments.length <= 1
        "
        ref="previewRendererRef"
        :class="ns.e('preview')"
        :base-url="previewBaseUrl"
        :content="editorValue"
        :csp-nonce="previewCspNonce"
        :features="previewFeatures"
        :loading-text="localeText.states.loading"
        mode="editor"
        @features-activated="emitRenderEvent('features-activated', $event)"
        @render-complete="handlePreviewRenderComplete($event)"
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
      :data-markdown-anchor-id="selectionToolbarAnchorId"
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

    <markdown-editor-contextual-popover
      ref="contextualPopoverRef"
      :active-anchor="activeAnchor"
      :active-anchor-node-id="activeAnchorNodeId"
      :active-link="activeLink"
      :active-link-node-id="activeLinkNodeId"
      :anchor-id="anchorIdDraft"
      :document-epoch="documentIdentity.epoch"
      :error="contextualError"
      :link-destination="linkDestinationDraft"
      :link-label="linkLabelDraft"
      :link-title="linkTitleDraft"
      :locale-text="localeText"
      :surface="contextualSurface"
      @apply-anchor="applyAnchorProperties"
      @apply-link="applyLinkProperties"
      @close="closeContextualSurface()"
      @copy-anchor="copyActiveAnchor"
      @copy-link="copyActiveLink"
      @open-link="openActiveLink"
      @remove-anchor="removeActiveAnchor"
      @remove-link="removeActiveLink"
      @reveal-link="revealActiveLink"
      @update:anchor-id="anchorIdDraft = $event"
      @update:link-destination="linkDestinationDraft = $event"
      @update:link-label="linkLabelDraft = $event"
      @update:link-title="linkTitleDraft = $event"
    />

    <markdown-editor-overlays
      ref="editorOverlaysRef"
      :active-palette-command="activePaletteCommand"
      :active-palette-index="activePaletteIndex"
      :command-description-id="commandDescriptionId"
      :command-group-name="commandGroupName"
      :command-name="commandName"
      :command-palette-direction="commandPaletteDirection"
      :command-palette-enabled="surfaceOptions.commandPalette"
      :command-palette-open="commandPaletteOpen"
      :is-command-disabled="isCommandDisabled"
      :locale-text="localeText"
      :palette-command-count="paletteCommands.length"
      :palette-command-groups="paletteCommandGroups"
      :palette-item-id="paletteItemId"
      :palette-item-index="paletteItemIndex"
      :palette-list-id="paletteListId"
      :palette-query="paletteQuery"
      :paste-error="pasteAsMarkdownError"
      :paste-help-id="pasteAsMarkdownHelpId"
      :paste-session="pasteAsMarkdownSession"
      :paste-title-id="pasteAsMarkdownTitleId"
      @cancel-paste="cancelPasteAsMarkdownSurface"
      @close-palette="closeCommandPalette"
      @confirm-paste="confirmPasteAsMarkdownChoice"
      @execute-active-palette="executeActivePaletteItem"
      @execute-palette-command="executePaletteCommand"
      @palette-keydown="handleCommandPaletteKeydown"
      @paste-keydown="handlePasteAsMarkdownDialogKeydown"
      @select-next-palette="selectNextPaletteItem"
      @select-prev-palette="selectPreviousPaletteItem"
      @update:palette-query="paletteQuery = $event"
    />
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
  triggerRef,
  useAttrs,
  useId,
  watch,
} from 'vue'
import { ElMarkdownRenderer } from '@element-plus/components/markdown-renderer'
import { CHANGE_EVENT, UPDATE_MODEL_EVENT } from '@element-plus/constants'
import {
  provideMarkdownEditorFrameScheduler,
  useLocale,
  useMarkdownEditorFrameScheduler,
  useNamespace,
} from '@element-plus/hooks'
import { provideMarkdownHeavyFeatureDocumentContext } from '../../../hooks/use-markdown-heavy-feature-lifecycle'
import {
  createMarkdownAnchorMap,
  createMarkdownEditorProjection,
  type MarkdownStableProjection,
  stabilizeMarkdownEditorProjection,
} from '../../../wasm/markdown-runtime'
import {
  isMarkdownEditorCommandEnabled,
  isMarkdownEditorCommandVisible,
  markdownEditorEmits,
  markdownEditorProps,
  createMarkdownEditorMetricsSession,
  type MarkdownEditorMetricsChange,
  resolveMarkdownEditorCommandCopy,
  resolveMarkdownEditorLocaleFromLanguage,
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
import { planMarkdownSlashCommit } from './markdown-editor-surfaces'
import { resolveMarkdownEditorStatus } from './markdown-editor-status'
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
import { createMarkdownLiveVisualSegments } from './markdown-editor-live-visual'
import { resolveMarkdownEditorFittingCommandCount } from './markdown-editor-toolbar-overflow'
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
  calculateMarkdownSourceAnchorY,
  createMarkdownFocusSegments,
  createWritingAidsController,
  type MarkdownEditorWritingAidsController,
} from './markdown-editor-writing-aids'
import {
  createMarkdownOutlineModelFromProjection,
  revealHeading as revealHeadingOutline,
  revealSourceRange as revealSourceRangeOutline,
} from './markdown-editor-outline'
import { planMarkdownOutlineReveal } from './markdown-editor-outline-active'
import {
  resolveMarkdownLiveLayoutStability,
  resolveMarkdownLiveVirtualWindow,
  type MarkdownLiveLayoutGesture,
  type MarkdownLiveLayoutPlan,
  type MarkdownLiveLayoutTrigger,
  type MarkdownLiveVirtualWindow,
} from './markdown-editor-live-layout'
import {
  dispatchMarkdownSearchKeydown,
  executeMarkdownSearchSession,
  resolveMarkdownSearchNavigation,
  resolveMarkdownSearchUi,
  revealMarkdownSearchMatch,
  type MarkdownSearchUiState,
} from './markdown-editor-search-ui'
import {
  planMarkdownReplaceAll,
  planMarkdownReplaceCurrentInSet,
} from '../../../wasm/markdown-replace'
import type {
  MarkdownSearchMatch,
  MarkdownSearchMode,
} from '../../../wasm/markdown-search-model'
import type { MarkdownSearchTask } from '../../../wasm/markdown-search-worker'
import { useEditorCommandPalette } from './composables/use-editor-command-palette'
import { useEditorContextualSurfaces } from './composables/use-editor-contextual-surfaces'
import { useEditorEmbeds } from './composables/use-editor-embeds'
import { useEditorMediaProperties } from './composables/use-editor-media-properties'
import { useEditorPasteSurface } from './composables/use-editor-paste-surface'
import { useEditorSearchHighlights } from './composables/use-editor-search-highlights'
import { useEditorTableController } from './composables/use-editor-table-controller'
import MarkdownEditorContextualPopover from './surfaces/markdown-editor-contextual-popover.vue'
import MarkdownEditorEmbedCard from './surfaces/markdown-editor-embed-card.vue'
import MarkdownEditorMediaPanel from './surfaces/markdown-editor-media-panel.vue'
import MarkdownEditorOverlays from './surfaces/markdown-editor-overlays.vue'
import MarkdownEditorSearchBar from './surfaces/markdown-editor-search-bar.vue'

defineOptions({
  name: 'ElMarkdownEditor',
  inheritAttrs: false,
})

const props = defineProps(markdownEditorProps)
const emit = defineEmits(markdownEditorEmits)
const ns = useNamespace('markdown-editor')
const attrs = useAttrs()
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
const commandTrayRef = ref<HTMLElement | null>(null)
const textareaRef = ref<HTMLTextAreaElement | null>(null)
const commandOverflowRef = ref<HTMLButtonElement | null>(null)
const paletteListId = `${useId()}-command-palette-list`
const slashMenuId = `${useId()}-slash-menu`
const searchBarRef = ref<InstanceType<typeof MarkdownEditorSearchBar> | null>(
  null,
)
const contextualPopoverRef = ref<InstanceType<
  typeof MarkdownEditorContextualPopover
> | null>(null)
const editorOverlaysRef = ref<InstanceType<
  typeof MarkdownEditorOverlays
> | null>(null)

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
const pasteAsMarkdownDescriptionId = `${useId()}-paste-as-markdown-description`
const pasteAsMarkdownTitleId = `${useId()}-paste-as-markdown-title`
const pasteAsMarkdownHelpId = `${useId()}-paste-as-markdown-help`
const tableMenuId = `${useId()}-table-menu`
const commandsExpanded = ref(false)
const retainedPreviewScrollLeft = ref(0)
const visualViewportHeight = ref(0)
const visualViewportOffsetTop = ref(0)
const commandGroupRef = ref<HTMLElement | null>(null)
const commandsRef = ref<HTMLElement | null>(null)
const commandMeasureRef = ref<HTMLElement | null>(null)
const toolbarRef = ref<HTMLElement | null>(null)
const previewRendererRef = ref<HTMLElement | { $el?: HTMLElement } | null>(null)

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
const { locale } = useLocale()
const providerLocaleText = computed(() =>
  resolveMarkdownEditorLocaleFromLanguage(locale.value),
)
const localeText = computed(() =>
  resolveMarkdownEditorLocaleText(props.localeText, providerLocaleText.value),
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
const textareaAriaLabel = computed(() =>
  currentMode.value === 'live'
    ? localeText.value.textarea.live
    : localeText.value.textarea.source,
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
provideMarkdownHeavyFeatureDocumentContext({
  documentEpoch: () => transactionStore.documentIdentity.epoch,
  documentKey: () => transactionStore.documentIdentity.id,
  revision: () => transactionStore.revision,
})
const editorRevision = ref(transactionStore.revision)
const editorSelection = ref(transactionStore.selection)
const editorValue = ref(transactionStore.value)
const nativeCompositionValue = ref(transactionStore.value)
const isComposing = ref(false)
const selectionTick = ref(0)

const writingAidsController: MarkdownEditorWritingAidsController =
  createWritingAidsController({
    writingAids: props.writingAids,
    editorProfile: props.editorProfile,
    readonly: props.readonly,
    disabled: props.disabled,
    source: transactionStore.value,
    selection: transactionStore.selection,
  })
const resolvedWritingAids = ref(writingAidsController.options)
const writingAidsState = ref(writingAidsController.state)
const writingAidsFocusState = ref(writingAidsController.focusState!)
const writingAidsDataAttrs = computed(() => ({
  'data-markdown-focus-active-block':
    writingAidsFocusState.value.activeBlockId || undefined,
  'data-markdown-focus-enabled': writingAidsFocusState.value.enabled
    ? 'true'
    : 'false',
  'data-markdown-writing-aids-state': writingAidsState.value,
}))
const rootAttrs = computed(() => ({ ...attrs, ...writingAidsDataAttrs.value }))
const focusLayerRef = ref<HTMLElement | null>(null)
const liveLayerRef = ref<HTMLElement | null>(null)
const syncMirrorLayerScroll = (scrollTop: number, scrollLeft = 0) => {
  if (focusLayerRef.value) {
    focusLayerRef.value.scrollTop = scrollTop
    focusLayerRef.value.scrollLeft = scrollLeft
  }
  if (liveLayerRef.value) {
    liveLayerRef.value.scrollTop = scrollTop
    liveLayerRef.value.scrollLeft = scrollLeft
  }
}
const focusSegments = computed(() =>
  createMarkdownFocusSegments(editorValue.value, writingAidsFocusState.value),
)

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

const refreshWritingAidsDocument = () => {
  let projection: MarkdownStableProjection | undefined
  const focusNeedsProjection =
    props.writingAids?.focus === true &&
    props.editorProfile === 'prose' &&
    !props.readonly &&
    !props.disabled &&
    currentMode.value !== 'preview'
  if (focusNeedsProjection) {
    try {
      projection = editorProjection.value
    } catch {
      projection = undefined
    }
  }
  const selection = transactionStore.selection
  const caret =
    selection.direction === 'backward' ? selection.start : selection.end
  const currentBlock = projection?.nodes.find(
    (node) => node.rawRange.start <= caret && caret <= node.rawRange.end,
  )
  writingAidsController.updateDocument({
    currentBlock,
    caretAnchor: currentBlock
      ? Object.freeze({ blockId: currentBlock.id, sourceOffset: caret })
      : null,
    disabled: props.disabled,
    documentEpoch: documentIdentity.epoch,
    documentIdentity,
    editorProfile: props.editorProfile,
    focusExemptions: props.focusExemptions,
    mode: currentMode.value,
    projection,
    readonly: props.readonly,
    revision: transactionStore.revision,
    selection,
    source: transactionStore.value,
    writingAids: props.writingAids,
  })
  resolvedWritingAids.value = writingAidsController.options
  writingAidsFocusState.value = writingAidsController.focusState!
  writingAidsState.value = writingAidsController.state
  writingAidsController.handleProjectionChange()
}

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
        name: item?.name ?? localeText.value.attachments.unnamed,
        kind: item?.kind,
        status: job.phase === 'idle' ? 'pending' : job.phase,
        progress: job.progress,
        copy: localeText.value.attachments,
      })
    }),
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
const commandRevisionMaps = new Map<number, MarkdownEditorPositionMap>()
const refreshEditorProjection = (previousValue: string, nextValue: string) => {
  const change = deriveMarkdownEditorChange(previousValue, nextValue)
  previousEditorProjection = editorProjection.value
  previousEditorProjectionSource = previousValue
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
    projection: editorProjection.value,
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
  selectionTick.value += 1
  return selection
}

const setStoreSelection = (
  selection: MarkdownEditorSelection,
  breakMerge = false,
) => {
  transactionStore.setSelection(selection, breakMerge)
  editorSelection.value = transactionStore.selection
}

const contextualRevisionBridge: { notify?: (revision: number) => void } = {}

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
let restoringTypewriter = false
let typewriterScrollTarget: number | null = null
let typewriterScrollSmooth = false
let typewriterLayoutAdjustment = false
let typewriterLayoutFrame: number | undefined
let textareaLayoutHeight = 0
let textareaLayoutWidth = 0
let viewportRestoreCurrentScrollTop = 0
let viewportRestoreCurrentScrollLeft = 0
let viewportRestoreNextScrollTop: number | null = null

const liveDecorations = computed(() => {
  const decorations = liveSurface.value.decorations
  if (currentMode.value !== 'live' || !liveWindow.value) return decorations
  const mounted = new Set(liveWindow.value.mountedNodeIds)
  return decorations.filter((decoration) => mounted.has(decoration.nodeId))
})
const liveVisualActive = computed(
  () =>
    currentMode.value === 'live' &&
    liveSurface.value.fallbackMode === 'live' &&
    liveSurface.value.inputVisible &&
    !isComposing.value,
)
const liveVisualSegments = computed(() => {
  if (!liveVisualActive.value) return []
  return createMarkdownLiveVisualSegments({
    activeNodeIds: liveWindow.value?.mountedNodeIds,
    focusState: writingAidsFocusState.value.enabled
      ? writingAidsFocusState.value
      : null,
    projection: editorProjection.value,
    reveal: liveReveal.value,
    source: editorValue.value,
  })
})
watch(liveVisualActive, (active) => {
  if (!active) return
  void nextTick(() => {
    const textarea = textareaRef.value
    if (textarea) {
      syncMirrorLayerScroll(textarea.scrollTop, textarea.scrollLeft)
    }
  })
})

const restoreTextareaViewport = (plan: MarkdownLiveLayoutPlan) => {
  const textarea = textareaRef.value
  if (!textarea || plan.action !== 'restore' || !plan.anchor) return
  const anchor = plan.anchor
  const line =
    transactionStore.value.slice(0, anchor.sourceOffset).split('\n').length - 1
  frameScheduler.schedule({
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
      viewportRestoreCurrentScrollLeft = target.scrollLeft
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
      const nextScrollTop = viewportRestoreNextScrollTop
      target.scrollTop = nextScrollTop
      syncMirrorLayerScroll(nextScrollTop, viewportRestoreCurrentScrollLeft)
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
const suspendTypewriterForUserScroll = () => {
  typewriterScrollTarget = null
  writingAidsController.handleUserScroll()
  writingAidsState.value = writingAidsController.state
}
const reducedMotionRequested = () =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true

const cssLength = (element: HTMLElement, property: string) => {
  const value = Number.parseFloat(
    window.getComputedStyle(element).getPropertyValue(property),
  )
  return Number.isFinite(value) ? value : 0
}
let typewriterTextContext:
  | OffscreenCanvasRenderingContext2D
  | null
  | undefined
const sourceAnchorY = (textarea: HTMLTextAreaElement, lineHeight: number) => {
  if (typeof OffscreenCanvas === 'undefined') return undefined
  if (typewriterTextContext === undefined) {
    typewriterTextContext = new OffscreenCanvas(1, 1).getContext('2d')
  }
  if (!typewriterTextContext) return undefined
  const style = window.getComputedStyle(textarea)
  typewriterTextContext.font = style.font
  const inlineSize =
    textarea.clientWidth -
    cssLength(textarea, 'padding-inline-start') -
    cssLength(textarea, 'padding-inline-end')
  return calculateMarkdownSourceAnchorY({
    caretSourceOffset: transactionStore.selection.end,
    inlineSize,
    lineHeight,
    measureTextWidth: (text) =>
      typewriterTextContext?.measureText(text).width ?? 0,
    paddingBlockStart: cssLength(textarea, 'padding-block-start'),
    source: transactionStore.value,
  })
}
const applyTypewriterScroll = (
  trigger: 'input' | 'explicit-navigation' | 'async-layout' = 'input',
) => {
  if (!resolvedWritingAids.value.typewriter || isComposing.value) return
  const textarea = textareaRef.value
  if (!textarea) return
  const response =
    trigger === 'explicit-navigation'
      ? writingAidsController.handleExplicitNavigation()
      : trigger === 'async-layout'
        ? writingAidsController.handleAsyncLayoutChange()
        : writingAidsController.handleInput()
  writingAidsState.value = writingAidsController.state
  if (response.scroll !== true) return
  const lineHeight =
    Number.parseFloat(window.getComputedStyle(textarea).lineHeight) || 20
  const target = writingAidsController.calculateScroll({
    caretSourceOffset: transactionStore.selection.end,
    lineHeight,
    source: transactionStore.value,
    stickyToolbarHeight: toolbarRef.value?.getBoundingClientRect().height,
    safeAreaInsetBottom: cssLength(
      textarea,
      '--el-markdown-editor-safe-area-inset-bottom',
    ),
    safeAreaInsetTop: cssLength(
      textarea,
      '--el-markdown-editor-safe-area-inset-top',
    ),
    sourceAnchorY: sourceAnchorY(textarea, lineHeight),
    reducedMotion: reducedMotionRequested(),
    viewportHeight: textarea.clientHeight,
    visualViewportHeight: visualViewportHeight.value || undefined,
    visualViewportOffsetTop: visualViewportOffsetTop.value || undefined,
  })
  restoringTypewriter = true
  if (typeof textarea.scrollTo === 'function') {
    const scrollTop = Math.min(
      target.scrollTop,
      Math.max(0, textarea.scrollHeight - textarea.clientHeight),
    )
    typewriterScrollTarget = scrollTop
    typewriterScrollSmooth = trigger !== 'async-layout' && target.smooth
    textarea.scrollTo({
      behavior:
        trigger === 'async-layout' ? 'auto' : target.smooth ? 'smooth' : 'auto',
      top: scrollTop,
    })
    requestAnimationFrame(() => {
      syncMirrorLayerScroll(textarea.scrollTop, textarea.scrollLeft)
    })
  } else {
    typewriterScrollTarget = target.scrollTop
    typewriterScrollSmooth = false
    textarea.scrollTop = target.scrollTop
    syncMirrorLayerScroll(target.scrollTop, textarea.scrollLeft)
  }
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      restoringTypewriter = false
    })
  })
}
const settleTypewriterLayout = () => {
  if (typewriterLayoutFrame !== undefined) {
    cancelAnimationFrame(typewriterLayoutFrame)
  }
  typewriterLayoutAdjustment = true
  let remainingFrames = 3
  const settle = () => {
    const textarea = textareaRef.value
    if (!textarea || !resolvedWritingAids.value.typewriter) {
      typewriterLayoutAdjustment = false
      typewriterLayoutFrame = undefined
      return
    }
    textareaLayoutHeight = textarea.clientHeight
    textareaLayoutWidth = textarea.clientWidth
    applyTypewriterScroll('async-layout')
    remainingFrames -= 1
    if (remainingFrames > 0) {
      typewriterLayoutFrame = requestAnimationFrame(settle)
      return
    }
    typewriterLayoutAdjustment = false
    typewriterLayoutFrame = undefined
  }
  typewriterLayoutFrame = requestAnimationFrame(settle)
}
const handleLayoutWheel = () => {
  suspendTypewriterForUserScroll()
  markLayoutGesture('wheel')
}
const handleLayoutTouch = () => {
  suspendTypewriterForUserScroll()
  markLayoutGesture('touch')
}
const handleLayoutScroll = () => {
  const textarea = textareaRef.value
  if (textarea) syncMirrorLayerScroll(textarea.scrollTop, textarea.scrollLeft)
  if (restoringSelection || restoringViewport || restoringTypewriter) return
  if (textarea && typewriterScrollTarget !== null) {
    const reachedTarget =
      Math.abs(textarea.scrollTop - typewriterScrollTarget) <= 1
    if (reachedTarget) typewriterScrollTarget = null
    if (reachedTarget || typewriterScrollSmooth) return
    typewriterScrollTarget = null
  }
  if (
    textarea &&
    (textarea.clientHeight !== textareaLayoutHeight ||
      textarea.clientWidth !== textareaLayoutWidth)
  ) {
    textareaLayoutHeight = textarea.clientHeight
    textareaLayoutWidth = textarea.clientWidth
    settleTypewriterLayout()
    return
  }
  if (typewriterLayoutAdjustment) return
  suspendTypewriterForUserScroll()
  markLayoutGesture('scrollbar')
}
const previewElement = () => {
  const current = previewRendererRef.value
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
    projection: editorProjection.value,
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

let pendingMetricsChange: MarkdownEditorMetricsChange | undefined

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
    pendingMetricsChange =
      operation.kind === 'transaction' &&
      operation.transaction.changes.length === 1
        ? operation.transaction.changes[0]
        : deriveMarkdownEditorChange(previousValue, result.value)
  }

  if (result.accepted && result.value !== previousValue) {
    const change = deriveMarkdownEditorChange(previousValue, result.value)
    if (change) {
      commandRevisionMaps.set(
        previousRevision,
        previousProjection
          ? createMarkdownEditorPositionMap([change], {
              documentIdentity,
              projection: previousProjection,
              source: previousValue,
            })
          : createMarkdownEditorPositionMap([change], {
              documentIdentity,
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
  contextualRevisionBridge.notify?.(result.revision)
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
      rebaseMarkdownAttachmentJob(job, appliedChanges, previousValue)
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
  if (result.accepted) {
    refreshWritingAidsDocument()
    if (currentMode.value === 'live') refreshLiveReveal()
    if (result.value !== previousValue) applyTypewriterScroll()
    syncLanguageToolsState()
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
  if (result.accepted && operation.restoreSelection !== false) {
    void restoreTextareaSelection(result.selection)
  }
  return result
}

const dispatchTransaction = (transaction: MarkdownEditorTransaction) => {
  const result = dispatchEditorOperation({
    kind: 'transaction',
    transaction,
  })
  selectionTick.value += 1
  return result
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
  refreshWritingAidsDocument()
  emit('mode-change', nextMode)
  void restoreTextareaSelection(retained.selection, false)
  applyLiveLayout('mode-switch')
  refreshLiveWindow('mode-switch')
  refreshLiveReveal()
  restorePreviewScroll()
  if (nextMode === 'live') {
    void nextTick(() => {
      const textarea = textareaRef.value
      if (textarea) {
        syncMirrorLayerScroll(textarea.scrollTop, textarea.scrollLeft)
      }
    })
  }
}

const {
  activeImage,
  activeImageOpenAllowed,
  applyImageProperties,
  copyActiveFigure,
  imageAltDraft,
  imageCaptionDraft,
  imageDestinationDraft,
  imagePropertyError,
  imageTitleDraft,
  openActiveImage,
  openActiveImageReplacement,
  removeActiveCaption,
  removeActiveImage,
  revealActiveImageSource,
} = useEditorMediaProperties({
  attachmentInputRef,
  attachmentReplaceRange,
  currentMode,
  dispatchTransaction,
  documentIdentity,
  editingBlocked,
  editorValue,
  getRevision: () => transactionStore.revision,
  getSelection: () => transactionStore.selection,
  getSource: () => transactionStore.value,
  isComposing,
  localeText,
  restoreTextareaSelection,
  selectionTick,
  setMode,
  setSelection: setStoreSelection,
})

const {
  activeAnchor,
  activeAnchorNodeId,
  activeLink,
  activeLinkNodeId,
  anchorIdDraft,
  applyAnchorProperties,
  applyLinkProperties,
  closeContextualSurface,
  contextualError,
  contextualSurface,
  copyActiveAnchor,
  copyActiveLink,
  invalidateContextualOnRevision,
  linkDestinationDraft,
  linkLabelDraft,
  linkTitleDraft,
  openActiveLink,
  openContextualSurface,
  removeActiveAnchor,
  removeActiveLink,
  resetContextualSurface,
  revealActiveLink,
} = useEditorContextualSurfaces({
  dispatchTransaction,
  documentIdentity,
  editorAnchorMap,
  editorProjection,
  editorRevision,
  editorSelection,
  editorValue,
  focusSurfaceInput: () => contextualPopoverRef.value?.focusFirstInput(),
  localeText,
  restoreTextareaSelection,
})
contextualRevisionBridge.notify = invalidateContextualOnRevision

const {
  currentTableCell,
  handleTableContextMenu,
  handleTableMenuKeydown,
  refreshCurrentTableCell,
  resetTableState,
  runTableContextAction,
  tableAnnouncement,
  tableContextActions,
  tableMenuOpen,
  tableMenuRef,
  tableMenuTriggerRef,
  toggleTableMenu,
  tryHandleTableClipboardPaste,
  tryHandleTableKeydown,
} = useEditorTableController({
  captureSelection,
  currentMode,
  dispatchTransaction,
  documentIdentity,
  editingBlocked,
  getRevision: () => transactionStore.revision,
  getSelection: () => transactionStore.selection,
  getSource: () => transactionStore.value,
  isComposing,
  localeText,
  recordPasteIdentity: (identity) => {
    pendingClipboardIdentity = identity
    pendingInputOrigin = 'paste'
    nativeMachine.apply({
      clipboardIdentity: identity,
      documentIdentity,
      kind: 'paste',
      origin: 'paste',
      revision: transactionStore.revision,
    })
  },
  restoreTextareaSelection,
  setSelection: setStoreSelection,
})

const {
  cancelPasteAsMarkdownSurface,
  confirmPasteAsMarkdownChoice,
  handlePasteAsMarkdownDialogKeydown,
  openPasteAsMarkdownSurface,
  pasteAsMarkdownBusy,
  pasteAsMarkdownError,
  pasteAsMarkdownGate,
  pasteAsMarkdownGateDescription,
  pasteAsMarkdownSession,
  resetPasteSurface,
} = useEditorPasteSurface({
  captureSelection,
  currentMode,
  disabled: () => props.disabled,
  dispatchTransaction,
  documentIdentity,
  focusPastePrimaryAction: () =>
    editorOverlaysRef.value?.focusPastePrimaryAction(),
  getDialogElement: () =>
    editorOverlaysRef.value?.getPasteDialogElement() ?? null,
  getRevision: () => transactionStore.revision,
  getSource: () => transactionStore.value,
  isComposing,
  loading: () => props.loading,
  localeText,
  onAttachmentBatch: (batch) => emit('upload-image', batch),
  readonly: () => props.readonly,
  restoreTextareaSelection,
})

const {
  disposeEmbeds,
  embedPresentationSegments,
  embedRenderSegments,
  handleEmbedAction,
} = useEditorEmbeds({
  captureSelection,
  currentMode,
  dispatchTransaction,
  documentIdentity,
  editingBlocked,
  editorRevision,
  editorValue,
  embedProvider: () => props.embedProvider,
  getRevision: () => transactionStore.revision,
  getSource: () => transactionStore.value,
  localeText,
  onOpenSource: (target, mode) => emit('embed-open-source', target, mode),
  onRetry: (target, mode) => emit('embed-retry', target, mode),
  restoreTextareaSelection,
  setMode,
  setSelection: setStoreSelection,
})

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
    localeText.value.attachments.uploading,
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
    const change =
      pendingMetricsChange ??
      deriveMarkdownEditorChange(metricsSource, value) ?? {
        from: 0,
        insert: '',
        to: 0,
      }
    pendingMetricsChange = undefined
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
    localeText.value,
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

const characterCount = computed(() => editorMetrics.value.graphemeCount)
const wordCount = computed(() => editorMetrics.value.wordCount)
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
  ...(editorProjection.value
    ? {
        positionMap: createMarkdownEditorPositionMap([], {
          documentIdentity,
          projection: editorProjection.value,
          source: editorValue.value,
        }),
        projection: editorProjection.value,
      }
    : {}),
  readonly: editingBlocked.value,
  revision: editorRevision.value,
  selection: editorSelection.value,
  signal: commandContextSignal,
  syntax: editorProjection.value
    ? resolveMarkdownEditorSyntaxContext(
        editorProjection.value,
        editorSelection.value,
      )
    : undefined,
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
const selectionToolbarAnchorId = computed(
  () => selectionToolbarPlacement.value.visual?.anchor.anchorId ?? '',
)
const closeSelectionToolbar = () => {
  dismissedSelectionRevision.value = editorRevision.value
  textareaRef.value?.focus()
}

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
const commandCopy = (command: MarkdownEditorCommand) =>
  resolveMarkdownEditorCommandCopy(command, localeText.value)
const commandName = (command: MarkdownEditorCommand) =>
  commandCopy(command).name
const commandGroupName = (group: string) =>
  localeText.value.commandGroups[group] ?? group

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
  const projection = editorProjection.value
  const initialContext = {
    ...commandContext.value,
    selection,
    syntax: projection
      ? resolveMarkdownEditorSyntaxContext(projection, selection)
      : undefined,
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

const {
  activePaletteCommand,
  activePaletteIndex,
  activeSlashIndex,
  activeSlashTrigger,
  closeCommandPalette,
  closeSlashMenu,
  commandPaletteDirection,
  commandPaletteOpen,
  executeActivePaletteItem,
  executePaletteCommand,
  executeSlashCommand,
  handleCommandPaletteKeydown,
  moveSlashIndex,
  openCommandPalette,
  paletteCommandGroups,
  paletteCommands,
  paletteItemId,
  paletteItemIndex,
  paletteQuery,
  resetPaletteAndSlash,
  selectNextPaletteItem,
  selectPreviousPaletteItem,
  slashCommands,
  slashItemId,
} = useEditorCommandPalette({
  activateCommand,
  captureSelection,
  commandSnapshot,
  documentIdentity,
  editingBlocked,
  editorProjection,
  editorRevision,
  editorSelection,
  editorValue,
  focusPaletteInput: () => editorOverlaysRef.value?.focusPaletteInput(),
  focusTextarea: () => textareaRef.value?.focus(),
  getPaletteInputElement: () =>
    editorOverlaysRef.value?.getPaletteInputElement() ?? null,
  isCommandDisabled,
  isComposing,
  paletteListId,
  restoreTextareaSelection,
  rootElementRef,
  runSlashCommand: (command, slashRange) => runCommand(command, slashRange),
  slashMenuId,
  surfaceOptions,
})

const configuredPrimaryCommands = computed(() =>
  resolveMarkdownEditorPrimaryCommands(
    toolbarCommands.value,
    effectiveToolbarDensity.value,
    props.primaryCommandKeys,
  ),
)
const configuredOverflowCommands = computed(() =>
  resolveMarkdownEditorOverflowCommands(
    toolbarCommands.value,
    effectiveToolbarDensity.value,
    props.primaryCommandKeys,
  ),
)
const responsivePrimaryLimit = ref<number | null>(null)
const primaryCommands = computed(() => {
  const configured = configuredPrimaryCommands.value
  const limit = responsivePrimaryLimit.value
  if (limit === null || limit >= configured.length) return configured
  return configured.slice(0, Math.max(0, limit))
})
const overflowCommands = computed(() => {
  const configuredPrimary = configuredPrimaryCommands.value
  const configuredOverflow = configuredOverflowCommands.value
  const limit = responsivePrimaryLimit.value
  if (limit === null || limit >= configuredPrimary.length) {
    return configuredOverflow
  }
  return [
    ...configuredPrimary.slice(Math.max(0, limit)),
    ...configuredOverflow,
  ]
})
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
const worstCaseOverflowCount = computed(() =>
  Math.max(
    1,
    configuredPrimaryCommands.value.length +
      configuredOverflowCommands.value.length +
      overflowActions.value.length,
  ),
)

watch(
  [() => props.mode, () => props.defaultMode, () => props.mobileLayout],
  ([mode, defaultMode]) => {
    transactionStore.breakMergeGroup()
    currentMode.value = normalizeModeForLayout(mode ?? defaultMode)
    refreshWritingAidsDocument()
    refreshLiveReveal()
    syncLanguageToolsState()
    if (currentMode.value === 'live') {
      void nextTick(() => {
        const textarea = textareaRef.value
        if (textarea) {
          syncMirrorLayerScroll(textarea.scrollTop, textarea.scrollLeft)
        }
      })
    }
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
    frameScheduler.cancelAll()
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
      resetTableState()
    }
  },
)

watch(
  [
    () => props.writingAids,
    () => props.editorProfile,
    () => props.focusExemptions,
    () => props.readonly,
    () => props.disabled,
  ],
  () => refreshWritingAidsDocument(),
  { deep: true },
)

watch([editingBlocked, overflowItemCount], ([blocked, itemCount]) => {
  if (blocked || !itemCount) {
    const activeElement =
      typeof document !== 'undefined' ? document.activeElement : null
    const hadOverflowFocus =
      !blocked &&
      !itemCount &&
      Boolean(
        activeElement &&
          ((commandsExpanded.value &&
            commandTrayRef.value?.contains(activeElement)) ||
            activeElement === commandOverflowRef.value),
      )
    commandsExpanded.value = false
    if (hadOverflowFocus) {
      void nextTick(() => {
        const firstVisibleCommand =
          commandsRef.value?.querySelector<HTMLButtonElement>(
            'button:not(:disabled)',
          )
        if (firstVisibleCommand) {
          firstVisibleCommand.focus()
        } else {
          textareaRef.value?.focus()
        }
      })
    }
  }
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
    resetPaletteAndSlash()
    resetContextualSurface()
    resetPasteSurface()
    resetTableState()
    commandsExpanded.value = false
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
    previousEditorProjection = undefined
    previousEditorProjectionSource = ''
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
const toolbarMeasureSignature = computed(() =>
  [
    effectiveToolbarDensity.value,
    props.interactionProfile,
    props.mobileLayout,
    props.editorProfile,
    resolvedCommandOverflowLabel.value,
    overflowActions.value.length,
    configuredOverflowCommands.value.length,
    gatedPasteAsMarkdownCommand.value
      ? commandName(gatedPasteAsMarkdownCommand.value)
      : '',
    configuredPrimaryCommands.value
      .map((command) => `${command.key}:${commandName(command)}`)
      .join('|'),
  ].join('\u0000'),
)
let toolbarResizeObserver: ResizeObserver | undefined
let pendingToolbarPrimaryLimit: number | null | undefined
let lastCommandGroupWidth = -1
let editorUnmounted = false

const measureToolbarOverflow = () => {
  const group = commandGroupRef.value
  const probe = commandMeasureRef.value
  if (!group || !probe || typeof window === 'undefined') {
    pendingToolbarPrimaryLimit = null
    return
  }
  const availableWidth = group.clientWidth
  const commandsElement = commandsRef.value
  const groupStyle = window.getComputedStyle(group)
  const groupGap = Number.parseFloat(groupStyle.columnGap || groupStyle.gap) || 0
  const commandsStyle = commandsElement
    ? window.getComputedStyle(commandsElement)
    : groupStyle
  const commandsGap =
    Number.parseFloat(commandsStyle.columnGap || commandsStyle.gap) || 0

  const commandWidths = Array.from(
    probe.querySelectorAll<HTMLElement>('[data-measure-role="command"]'),
    (node) => node.getBoundingClientRect().width,
  )
  const reservedEndNode = probe.querySelector<HTMLElement>(
    '[data-measure-role="reserved-end"]',
  )
  const reservedEndWidth = reservedEndNode
    ? reservedEndNode.getBoundingClientRect().width
    : 0
  const moreNode = probe.querySelector<HTMLElement>(
    '[data-measure-role="more"]',
  )
  const overflowTriggerWidth = moreNode
    ? moreNode.getBoundingClientRect().width
    : 0

  pendingToolbarPrimaryLimit = resolveMarkdownEditorFittingCommandCount({
    availableWidth,
    commandWidths,
    commandsGap,
    groupGap,
    hasBaseOverflow:
      configuredOverflowCommands.value.length + overflowActions.value.length > 0,
    overflowTriggerWidth,
    reservedEndWidth,
  })
}

const mutateToolbarOverflow = () => {
  if (pendingToolbarPrimaryLimit === undefined) return
  const nextLimit = pendingToolbarPrimaryLimit
  pendingToolbarPrimaryLimit = undefined
  if (responsivePrimaryLimit.value !== nextLimit) {
    responsivePrimaryLimit.value = nextLimit
  }
}

const scheduleToolbarOverflowMeasure = () => {
  if (editorUnmounted || typeof window === 'undefined') return
  if (!commandGroupRef.value || !commandMeasureRef.value) return
  frameScheduler.schedule({
    guard: () =>
      !editorUnmounted &&
      Boolean(commandGroupRef.value && commandMeasureRef.value),
    key: 'toolbar-overflow',
    measure: measureToolbarOverflow,
    mutate: mutateToolbarOverflow,
  })
}

const disconnectToolbarResizeObserver = () => {
  toolbarResizeObserver?.disconnect()
  toolbarResizeObserver = undefined
  lastCommandGroupWidth = -1
}

const attachToolbarResizeObserver = (element: HTMLElement | null) => {
  disconnectToolbarResizeObserver()
  if (!element) {
    responsivePrimaryLimit.value = null
    return
  }
  if (typeof ResizeObserver !== 'undefined') {
    toolbarResizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0]
      const nextWidth = entry ? entry.contentRect.width : element.clientWidth
      if (
        lastCommandGroupWidth >= 0 &&
        Math.abs(nextWidth - lastCommandGroupWidth) <= 0.5
      ) {
        return
      }
      lastCommandGroupWidth = nextWidth
      scheduleToolbarOverflowMeasure()
    })
    toolbarResizeObserver.observe(element)
  }
  scheduleToolbarOverflowMeasure()
}

watch(commandGroupRef, (element) => {
  attachToolbarResizeObserver(element)
})

watch(toolbarMeasureSignature, () => {
  void nextTick(() => {
    scheduleToolbarOverflowMeasure()
  })
})
const visibleModes = computed(() =>
  compactMode.value
    ? modes.filter((mode) => mode !== 'split' && mode !== 'live')
    : modes,
)

let viewportHeightNext: number | null = null
let viewportTrigger: MarkdownLiveLayoutTrigger | null = null
const updateVisualViewportHeight = () => {
  if (typeof window === 'undefined') return

  const previous = visualViewportHeight.value
  visualViewportHeight.value =
    window.visualViewport?.height || window.innerHeight || 0
  visualViewportOffsetTop.value = window.visualViewport?.offsetTop || 0
  const trigger =
    previous > 0 && visualViewportHeight.value + 80 < previous
      ? 'soft-keyboard'
      : 'visual-viewport'
  applyLiveLayout(trigger)
  applyTypewriterScroll('async-layout')
}

let typewriterResizeObserver: ResizeObserver | undefined
const refreshTypewriterResizeObserver = () => {
  typewriterResizeObserver?.disconnect()
  typewriterResizeObserver = undefined
  const textarea = textareaRef.value
  if (
    props.writingAids?.typewriter !== true ||
    !textarea ||
    typeof ResizeObserver === 'undefined'
  )
    return
  textareaLayoutHeight = textarea.clientHeight
  textareaLayoutWidth = textarea.clientWidth
  typewriterResizeObserver = new ResizeObserver(() => {
    textareaLayoutHeight = textarea.clientHeight
    textareaLayoutWidth = textarea.clientWidth
    applyTypewriterScroll('async-layout')
    settleTypewriterLayout()
  })
  typewriterResizeObserver.observe(textarea)

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
      applyLiveLayout(trigger)
    },
  })
}

watch(
  () => props.writingAids?.typewriter,
  () => refreshTypewriterResizeObserver(),
)

const searchUiState = ref<MarkdownSearchUiState>(
  resolveMarkdownSearchUi(false, '', 0),
)
const searchQuery = ref('')
const searchReplaceText = ref('')
const searchMatches = ref<readonly MarkdownSearchMatch[]>([])
const searchCurrentIndex = ref<number | null>(null)
const searchMode = ref<MarkdownSearchMode>('plain')
const searchTask = ref<MarkdownSearchTask | null>(null)
const inputVisible = computed(() => liveSurface.value.inputVisible)

const {
  clearRenderedSearchHighlights,
  searchHighlightStyle,
  syncRenderedSearchHighlights,
  visibleSearchHighlights,
} = useEditorSearchHighlights({
  currentMode,
  editorValue,
  inputVisible,
  previewRendererRef,
  searchCurrentIndex,
  searchMatches,
  searchUiState,
})

const updateSearchState = () => {
  searchUiState.value = resolveMarkdownSearchUi(
    searchUiState.value.open,
    searchQuery.value,
    searchMatches.value.length,
    {
      currentIndex: searchCurrentIndex.value,
      mode: searchMode.value,
      replaceOpen: searchUiState.value.replaceOpen,
      replaceText: searchReplaceText.value,
      copy: localeText.value.search,
    },
  )
}

const runSearch = () => {
  if (!searchQuery.value) {
    searchMatches.value = []
    searchCurrentIndex.value = null
    updateSearchState()
    return
  }
  const session = executeMarkdownSearchSession({
    documentEpoch: documentIdentity.epoch,
    documentId: documentIdentity.id,
    mode: searchMode.value,
    previousTask: searchTask.value ?? undefined,
    queryText: searchQuery.value,
    revision: transactionStore.revision,
    source: transactionStore.value,
  })
  searchTask.value = session.task
  searchMatches.value = session.execution.matches
  searchCurrentIndex.value = session.execution.matches.length > 0 ? 0 : null
  updateSearchState()
}

const openSearch = (replace = false) => {
  searchUiState.value = resolveMarkdownSearchUi(
    true,
    searchQuery.value,
    searchMatches.value.length,
    {
      currentIndex: searchCurrentIndex.value,
      mode: searchMode.value,
      replaceOpen: replace,
      replaceText: searchReplaceText.value,
      copy: localeText.value.search,
    },
  )
  if (searchQuery.value) {
    runSearch()
  }
  void nextTick(() => {
    searchBarRef.value?.focusInput(replace)
  })
}

const closeSearch = () => {
  searchUiState.value = resolveMarkdownSearchUi(
    false,
    searchQuery.value,
    searchMatches.value.length,
    {
      currentIndex: searchCurrentIndex.value,
      mode: searchMode.value,
      replaceOpen: false,
      replaceText: searchReplaceText.value,
      copy: localeText.value.search,
    },
  )
  if (currentMode.value === 'preview') {
    rootElementRef.value?.focus()
  } else if (textareaRef.value) {
    textareaRef.value.focus()
  }
}

const toggleSearchMode = (mode: MarkdownSearchMode) => {
  searchMode.value = searchMode.value === mode ? 'plain' : mode
  runSearch()
}

const toggleSearchReplace = () => {
  searchUiState.value = resolveMarkdownSearchUi(
    searchUiState.value.open,
    searchQuery.value,
    searchMatches.value.length,
    {
      currentIndex: searchCurrentIndex.value,
      mode: searchMode.value,
      replaceOpen: !searchUiState.value.replaceOpen,
      replaceText: searchReplaceText.value,
      copy: localeText.value.search,
    },
  )
}

const searchNavigate = (direction: 'next' | 'previous') => {
  const result = resolveMarkdownSearchNavigation(
    searchMatches.value,
    searchCurrentIndex.value,
    direction,
  )
  if (result.match) {
    const reveal = revealMarkdownSearchMatch({
      currentMode: currentMode.value,
      documentIdentity,
      match: result.match,
      revision: transactionStore.revision,
      source: transactionStore.value,
    })
    if (reveal.status === 'stale' || reveal.status === 'deleted') {
      runSearch()
      return reveal.status
    }
    if (reveal.status !== 'success') return reveal.status
    searchCurrentIndex.value = result.nextIndex
    updateSearchState()
    if (!reveal.suspended && currentMode.value !== 'preview') {
      void restoreTextareaSelection({
        direction: 'none',
        end: result.match.range.end,
        start: result.match.range.start,
      })
    }
    void nextTick(syncRenderedSearchHighlights)
    return reveal.status
  }
  return 'not-found' as const
}

const handleSearchQueryInput = () => {
  runSearch()
}

const handleSearchInputKeydown = (event: KeyboardEvent) => {
  const action = dispatchMarkdownSearchKeydown({
    altKey: event.altKey,
    ctrlKey: event.ctrlKey,
    key: event.key,
    metaKey: event.metaKey,
    shiftKey: event.shiftKey,
    targetIsInput: true,
  })
  if (action === 'next-match') {
    event.preventDefault()
    searchNavigate('next')
  } else if (action === 'prev-match') {
    event.preventDefault()
    searchNavigate('previous')
  } else if (action === 'close') {
    event.preventDefault()
    closeSearch()
  }
}

const handleSearchReplaceKeydown = (event: KeyboardEvent) => {
  const action = dispatchMarkdownSearchKeydown({
    altKey: event.altKey,
    ctrlKey: event.ctrlKey,
    key: event.key,
    metaKey: event.metaKey,
    shiftKey: event.shiftKey,
    targetIsReplaceInput: true,
  })
  if (action === 'replace-current') {
    event.preventDefault()
    searchReplaceCurrent()
  } else if (action === 'replace-all') {
    event.preventDefault()
    searchReplaceAll()
  } else if (action === 'close') {
    event.preventDefault()
    closeSearch()
  }
}

const searchReplaceCurrent = () => {
  if (searchCurrentIndex.value === null || !searchMatches.value.length) return
  const plan = planMarkdownReplaceCurrentInSet(
    {
      documentEpoch: documentIdentity.epoch,
      documentId: documentIdentity.id,
      query: {
        mode: searchMode.value,
        queryVersion: 1,
        text: searchQuery.value,
      },
      revision: transactionStore.revision,
      source: transactionStore.value,
    },
    searchMatches.value,
    searchCurrentIndex.value,
    searchReplaceText.value,
  )
  if ('changes' in plan) {
    dispatchTransaction({
      changes: [...plan.changes],
      expectedRevision: transactionStore.revision,
      history: 'separate',
      origin: 'command',
      selection: plan.selection,
    })
    runSearch()
  }
}

const searchReplaceAll = () => {
  if (!searchMatches.value.length) return
  const plan = planMarkdownReplaceAll(
    {
      documentEpoch: documentIdentity.epoch,
      documentId: documentIdentity.id,
      query: {
        mode: searchMode.value,
        queryVersion: 1,
        text: searchQuery.value,
      },
      revision: transactionStore.revision,
      source: transactionStore.value,
    },
    searchMatches.value,
    searchReplaceText.value,
  )
  if ('changes' in plan) {
    dispatchTransaction({
      changes: [...plan.changes],
      expectedRevision: transactionStore.revision,
      history: 'separate',
      origin: 'command',
      selection: plan.selection,
    })
    runSearch()
  }
}

watch([editorValue, editorRevision, currentMode], () => {
  if (searchUiState.value.open && searchQuery.value) runSearch()
})

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
  refreshWritingAidsDocument()
  updateVisualViewportHeight()
  refreshTypewriterResizeObserver()
  attachToolbarResizeObserver(commandGroupRef.value)
  if (typeof document !== 'undefined' && document.fonts?.ready) {
    void document.fonts.ready.then(() => {
      if (!editorUnmounted && commandGroupRef.value && commandMeasureRef.value) {
        scheduleToolbarOverflowMeasure()
      }
    })
  }
  window.visualViewport?.addEventListener('resize', updateVisualViewportHeight)
  window.visualViewport?.addEventListener('scroll', updateVisualViewportHeight)
  window.addEventListener('resize', updateVisualViewportHeight)
})

onBeforeUnmount(() => {
  editorUnmounted = true
  disconnectToolbarResizeObserver()
  languageToolsController = null
  abortPendingCommands()
  attachmentCaptureSession.clear()
  attachmentBatches.clear()
  attachmentItems.clear()
  if (layoutGestureTimer) clearTimeout(layoutGestureTimer)
  if (typewriterLayoutFrame !== undefined) {
    cancelAnimationFrame(typewriterLayoutFrame)
  }
  typewriterResizeObserver?.disconnect()
  clearRenderedSearchHighlights()
  disposeEmbeds()
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
  if (nativeMachine.composing || inputEvent?.isComposing) {
    nativeCompositionValue.value = target.value
  }
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

const handleCompositionStart = (event: CompositionEvent) => {
  const target = event.target
  nativeCompositionValue.value =
    target instanceof HTMLTextAreaElement ? target.value : transactionStore.value
  nativeMachine.apply({
    disabled: editingBlocked.value,
    documentIdentity,
    kind: 'compositionstart',
    revision: transactionStore.revision,
  })
  syncNativeComposing()
  if (editingBlocked.value || !nativeMachine.composing) return
  writingAidsController.handleCompositionStart()
  writingAidsState.value = writingAidsController.state
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
  writingAidsController.handleCompositionEnd()
  writingAidsState.value = writingAidsController.state
  beforeInputSnapshot = undefined
  pendingClipboardIdentity = undefined
  pendingInputOrigin = undefined
  if (plan.action !== 'commit') {
    if (plan.restoreDisplay) triggerRef(editorValue)
    refreshLiveReveal()
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
  if (tryHandleTableClipboardPaste(event)) return
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
  refreshCurrentTableCell()
  refreshWritingAidsDocument()
  writingAidsController.handleSelectionChange()
  writingAidsState.value = writingAidsController.state
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

const handleSelectionKeyup = (event: KeyboardEvent) => {
  if (
    currentMode.value !== 'live' ||
    isComposing.value ||
    restoringSelection
  ) {
    return
  }
  if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return
  const textarea = textareaRef.value
  if (!textarea) return
  if (
    textarea.selectionStart !== transactionStore.selection.start ||
    textarea.selectionEnd !== transactionStore.selection.end
  ) {
    handleSelectionMove()
  }
}

const handleSelectionDragStart = () => {
  if (isComposing.value) return
  typewriterScrollTarget = null
  writingAidsController.handleSelectionDragStart()
  writingAidsState.value = writingAidsController.state
}

const handleSelectionDragEnd = () => {
  writingAidsController.handleSelectionDragEnd()
  writingAidsState.value = writingAidsController.state
}

const handlePointerReveal = () => {
  if (restoringSelection || isComposing.value) return
  captureSelection()
  refreshCurrentTableCell()
  refreshWritingAidsDocument()
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
    applyTypewriterScroll('async-layout')
    return
  }
  if (event === 'render-complete') {
    emit('render-complete', payload)
    applyTypewriterScroll('async-layout')
    return
  }
  emit('render-error', payload)
}

const handlePreviewRenderComplete = (payload: unknown) => {
  emitRenderEvent('render-complete', payload)
  restorePreviewScroll()
  void nextTick(syncRenderedSearchHighlights)
}

const handleRendererComplete = (payload: unknown) => {
  emitRenderEvent('render-complete', payload)
  void nextTick(syncRenderedSearchHighlights)
}

const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape' && searchUiState.value.open) {
    event.preventDefault()
    closeSearch()
    return
  }
  const searchAction = dispatchMarkdownSearchKeydown({
    ctrlKey: event.ctrlKey,
    key: event.key,
    metaKey: event.metaKey,
    shiftKey: event.shiftKey,
  })
  if (searchAction === 'open-find' || searchAction === 'open-replace') {
    event.preventDefault()
    openSearch(searchAction === 'open-replace')
    return
  }
  if (
    event.key === 'PageUp' ||
    event.key === 'PageDown' ||
    ((event.ctrlKey || event.metaKey) &&
      (event.key === 'Home' || event.key === 'End'))
  ) {
    suspendTypewriterForUserScroll()
  }

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

  if (tryHandleTableKeydown(event)) return

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
    void runCommand(command)
  }
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

const commitRevealSelection = async (
  range: { start: number; end: number },
  smooth: boolean,
) => {
  const selection = Object.freeze({
    direction: 'none' as const,
    end: range.start,
    start: range.start,
  })
  transactionStore.setSelection(selection, true)
  refreshLiveWindow('feature')
  refreshWritingAidsDocument()
  await restoreTextareaSelection(selection)
  const textarea = textareaRef.value
  if (!textarea) return
  textarea.focus()
  if (resolvedWritingAids.value.typewriter) {
    applyTypewriterScroll('explicit-navigation')
    return
  }
  const lineHeight =
    Number.parseFloat(window.getComputedStyle(textarea).lineHeight) || 20
  const line =
    transactionStore.value.slice(0, range.start).split('\n').length - 1
  const top = Math.max(0, line * lineHeight - textarea.clientHeight / 3)
  if (typeof textarea.scrollTo === 'function') {
    const scrollTop = Math.min(
      top,
      Math.max(0, textarea.scrollHeight - textarea.clientHeight),
    )
    textarea.scrollTo({ behavior: smooth ? 'smooth' : 'auto', top: scrollTop })
    requestAnimationFrame(() => {
      syncMirrorLayerScroll(textarea.scrollTop, textarea.scrollLeft)
    })
  } else {
    textarea.scrollTop = top
    syncMirrorLayerScroll(top, textarea.scrollLeft)
  }
}

const currentOutlineContext = () => {
  const projection = editorProjection.value
  return {
    anchorMap: createMarkdownAnchorMap({
      identity: documentIdentity,
      projection,
      source: transactionStore.value,
    }),
    model: projection
      ? createMarkdownOutlineModelFromProjection(
          transactionStore.value,
          projection,
        )
      : { items: [], projection: undefined },
  }
}

const revealHeading = (
  nodeId: string,
  options?: Parameters<typeof revealHeadingOutline>[4],
) => {
  const { anchorMap, model } = currentOutlineContext()
  const actual = {
    documentIdentity,
    revision: transactionStore.revision,
  }
  const expected = options?.expected ?? actual
  const status = revealHeadingOutline(model.items, nodeId, expected, actual, {
    ...options,
    anchorMap,
    projection: model.projection,
  })
  if (status !== 'success') return status
  const plan = planMarkdownOutlineReveal(model.items, nodeId, {
    ...options,
    actual,
    anchorMap,
    expected,
    mode: currentMode.value,
    reducedMotion: options?.reducedMotion ?? reducedMotionRequested(),
  })
  if (plan.status !== 'success' || !plan.range) return plan.status
  void commitRevealSelection(plan.range, plan.smooth)
  return 'success'
}

const revealSourceRange = (
  range: { start: number; end: number },
  options?: Parameters<typeof revealSourceRangeOutline>[2],
) => {
  if (
    range.start < 0 ||
    range.end < range.start ||
    range.end > transactionStore.value.length
  ) {
    return 'not-found'
  }
  const { anchorMap, model } = currentOutlineContext()
  const actual = {
    documentIdentity,
    revision: transactionStore.revision,
  }
  const guarded = revealSourceRangeOutline(model.items, range, {
    ...options,
    actual,
    anchorMap,
    expected: options?.expected ?? actual,
    mode: options?.mode ?? currentMode.value,
    sourceLength: transactionStore.value.length,
  })
  if (guarded !== 'success') return guarded
  const smooth = !(options?.reducedMotion ?? reducedMotionRequested())
  void commitRevealSelection(range, smooth)
  return 'success'
}

defineExpose({
  closeSearch,
  closeCommandPalette,
  applyAttachmentResult,
  dispatchTransaction,
  insertMarkdownAtCursor,
  openSearch,
  openCommandPalette,
  redo,
  searchNavigate,
  searchReplaceAll,
  searchReplaceCurrent,
  searchUi: searchUiState,
  undo,
  revealHeading,
  revealSourceRange,
  writingAidsController,
})
</script>
