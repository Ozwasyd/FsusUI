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
          <FsusMarkdownRenderer
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

      <FsusMarkdownRenderer
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
import { FsusMarkdownRenderer } from '../../markdown-renderer'
import { CHANGE_EVENT, UPDATE_MODEL_EVENT } from '../../internal/bridge'
import {
  provideMarkdownEditorFrameScheduler,
  useLocale,
  useMarkdownEditorFrameScheduler,
  useNamespace,
} from '../../internal/bridge'
import { provideMarkdownHeavyFeatureDocumentContext } from '../../hooks/use-markdown-heavy-feature-lifecycle'
import {
  createMarkdownAnchorMap,
  createMarkdownEditorProjection,
  type MarkdownStableProjection,
  stabilizeMarkdownEditorProjection,
} from '@fsusui/wasm/markdown-runtime'
import {
  createMarkdownEditorMetricsSession,
  markdownEditorEmits,
  markdownEditorProps,
  resolveMarkdownEditorLocaleFromLanguage,
  resolveMarkdownEditorLocaleText,
  type MarkdownEditorActionItem,
  type MarkdownEditorInsertOptions,
  type MarkdownEditorMetricsChange,
  type MarkdownEditorMode,
  type MarkdownEditorSurfaceOptions,
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
import { resolveMarkdownEditorChromeRegions } from './markdown-editor-chrome'
import {
  deriveMarkdownEditorChange,
  type MarkdownEditorInputMergeDirection,
  type MarkdownEditorSelection,
  type MarkdownEditorTransaction,
} from './markdown-editor-transaction'
import { resolveMarkdownEditorStatus } from './markdown-editor-status'
import { resolveMarkdownLanguageToolCapability } from './markdown-editor-language-tools'
import {
  bindMarkdownWebLanguageTools,
  type MarkdownWebLanguageController,
} from './markdown-editor-language-web'
import { createMarkdownEditorNativeEventMachine } from './markdown-editor-native-event'
import { resolveMarkdownLiveSurface } from './markdown-editor-live-surface'
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
  createMarkdownFocusSegments,
  createWritingAidsController,
  type MarkdownEditorWritingAidsController,
} from './markdown-editor-writing-aids'
import {
  MarkdownEditorKernel,
  type MarkdownEditorKernelOperation,
} from './kernel/editor-kernel'
import { useEditorCommandPalette } from './composables/use-editor-command-palette'
import { useEditorContextualSurfaces } from './composables/use-editor-contextual-surfaces'
import { useEditorEmbeds } from './composables/use-editor-embeds'
import { useEditorInputPipeline } from './composables/use-editor-input-pipeline'
import {
  reducedMotionRequested,
  useEditorLiveViewport,
} from './composables/use-editor-live-viewport'
import { useEditorMediaProperties } from './composables/use-editor-media-properties'
import { useEditorOutlineReveal } from './composables/use-editor-outline-reveal'
import { useEditorPasteSurface } from './composables/use-editor-paste-surface'
import { useEditorSearchController } from './composables/use-editor-search-controller'
import { useEditorTableController } from './composables/use-editor-table-controller'
import { useEditorToolbarCommands } from './composables/use-editor-toolbar-commands'
import MarkdownEditorContextualPopover from './surfaces/markdown-editor-contextual-popover.vue'
import MarkdownEditorEmbedCard from './surfaces/markdown-editor-embed-card.vue'
import MarkdownEditorMediaPanel from './surfaces/markdown-editor-media-panel.vue'
import MarkdownEditorOverlays from './surfaces/markdown-editor-overlays.vue'
import MarkdownEditorSearchBar from './surfaces/markdown-editor-search-bar.vue'

defineOptions({
  name: 'FsusMarkdownEditor',
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
const commandGroupRef = ref<HTMLElement | null>(null)
const commandsRef = ref<HTMLElement | null>(null)
const commandMeasureRef = ref<HTMLElement | null>(null)
const toolbarRef = ref<HTMLElement | null>(null)
const previewRendererRef = ref<HTMLElement | { $el?: HTMLElement } | null>(null)
const focusLayerRef = ref<HTMLElement | null>(null)
const liveLayerRef = ref<HTMLElement | null>(null)

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
const visibleModes = computed(() =>
  compactMode.value
    ? modes.filter((mode) => mode !== 'split' && mode !== 'live')
    : modes,
)
const textareaAriaLabel = computed(() =>
  currentMode.value === 'live'
    ? localeText.value.textarea.live
    : localeText.value.textarea.source,
)

const documentIdentity = reactive({
  epoch: props.documentIdentity?.epoch ?? 0,
  id: props.documentIdentity?.id ?? commandTrayId,
})
const kernel = new MarkdownEditorKernel({
  documentIdentity,
  initialValue: props.modelValue,
})
const commandRuntimeVersion = ref(0)
kernel.onCommandStateChange(() => {
  commandRuntimeVersion.value += 1
})

provideMarkdownHeavyFeatureDocumentContext({
  documentEpoch: () => kernel.store.documentIdentity.epoch,
  documentKey: () => kernel.store.documentIdentity.id,
  revision: () => kernel.revision,
})

const editorRevision = ref(kernel.revision)
const editorSelection = ref(kernel.selection)
const editorValue = ref(kernel.value)
const nativeCompositionValue = ref(kernel.value)
const isComposing = ref(false)
const selectionTick = ref(0)

const writingAidsController: MarkdownEditorWritingAidsController =
  createWritingAidsController({
    writingAids: props.writingAids,
    editorProfile: props.editorProfile,
    readonly: props.readonly,
    disabled: props.disabled,
    source: kernel.value,
    selection: kernel.selection,
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
  const selection = kernel.selection
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
    revision: kernel.revision,
    selection,
    source: kernel.value,
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
    revision: kernel.revision,
    source: editorValue.value,
  }),
)
const inputVisible = computed(() => liveSurface.value.inputVisible)
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
    languageToolsRevision !== kernel.revision ||
    languageToolsSource !== kernel.value ||
    languageToolsConfigKey !== configKey
  ) {
    controller.updateState({
      anchorMap: editorAnchorMap.value,
      config,
      projection: editorProjection.value,
      projectionRevision: kernel.revision,
      revision: kernel.revision,
      source: kernel.value,
    })
    languageToolsRevision = kernel.revision
    languageToolsSource = kernel.value
    languageToolsConfigKey = configKey
  }
  controller.switchMode(currentMode.value)
  return controller.updateContext({
    disabled: inputDisabled.value,
    isComposing: nativeMachine.composing,
    mode: currentMode.value,
    readonly: props.readonly,
    selection: kernel.selection,
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
  if (!textarea) return kernel.selection
  return {
    direction: textarea.selectionDirection,
    end: textarea.selectionEnd,
    start: textarea.selectionStart,
  }
}

const captureSelection = (breakMerge = true) => {
  const previous = kernel.selection
  kernel.store.setSelection(readSelectionFrom(textareaRef.value), breakMerge)
  const selection = kernel.selection
  editorSelection.value = selection
  if (
    selection.start !== previous.start ||
    selection.end !== previous.end ||
    selection.direction !== previous.direction
  ) {
    emit(
      'selection-change',
      Object.freeze({
        revision: kernel.revision,
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
  kernel.store.setSelection(selection, breakMerge)
  editorSelection.value = kernel.selection
}

const contextualRevisionBridge: { notify?: (revision: number) => void } = {}
const pasteIdentityBridge: { record?: (identity: string) => void } = {}

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
      revision: kernel.revision,
      selection: kernel.selection,
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

const {
  applyLiveLayout,
  applyTypewriterScroll,
  capturePreviewScrollLeft,
  clearTypewriterScrollTarget,
  disposeViewport,
  editorStyle,
  handleLayoutScroll,
  handleLayoutTouch,
  handleLayoutWheel,
  handlePreviewScroll,
  liveDecorations,
  liveLayout,
  liveReveal,
  liveVisualActive,
  liveVisualSegments,
  markLayoutGesture,
  mountViewportListeners,
  refreshLiveReveal,
  refreshLiveWindow,
  restorePreviewScroll,
  suspendTypewriterForUserScroll,
  syncMirrorLayerScroll,
} = useEditorLiveViewport({
  currentMode,
  documentIdentity,
  editorProjection,
  editorValue,
  focusLayerRef,
  frameScheduler,
  getRevision: () => kernel.revision,
  getSelection: () => kernel.selection,
  getSource: () => kernel.value,
  isComposing,
  isRestoringSelection: () => restoringSelection,
  liveLayerRef,
  liveSurface,
  previewRendererRef,
  resolvedWritingAids,
  textareaRef,
  toolbarRef,
  writingAidsController,
  writingAidsFocusState,
  writingAidsState,
})

let pendingMetricsChange: MarkdownEditorMetricsChange | undefined

const dispatchEditorOperation = (operation: MarkdownEditorKernelOperation) => {
  const outcome = kernel.dispatchOperation(operation, {
    blocked: editingBlocked.value,
    composing: isComposing.value,
    currentProjection: editorProjection.value,
  })
  const { result } = outcome
  if (outcome.valueChanged) {
    pendingMetricsChange = outcome.metricsChange
    previousEditorProjection = editorProjection.value
    previousEditorProjectionSource = outcome.previousValue
  }
  editorValue.value = result.value
  editorRevision.value = result.revision
  editorSelection.value = result.selection
  contextualRevisionBridge.notify?.(result.revision)
  emit('transaction', outcome.event)

  if (outcome.valueChanged) {
    for (const job of attachmentJobs.value) {
      if (job.itemId === outcome.ownedAttachmentItemId || job.phase === 'deleted') {
        continue
      }
      rebaseMarkdownAttachmentJob(
        job,
        outcome.appliedChanges,
        outcome.previousValue,
      )
    }
    triggerRef(attachmentJobs)
  }

  if (outcome.emitValue) {
    emit(UPDATE_MODEL_EVENT, result.value)
    emit(CHANGE_EVENT, result.value)
    refreshLiveWindow('input')
  }
  if (result.accepted) {
    refreshWritingAidsDocument()
    if (currentMode.value === 'live') refreshLiveReveal()
    if (outcome.valueChanged) applyTypewriterScroll()
    syncLanguageToolsState()
  }
  if (outcome.selectionChanged) {
    emit(
      'selection-change',
      Object.freeze({
        revision: result.revision,
        selection: result.selection,
      }),
    )
  }
  if (outcome.historyChanged) {
    emit('history-change', result.history)
  }
  if (outcome.restoreSelection) {
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

const dispatchReplacement = (
  nextValue: string,
  selection: MarkdownEditorSelection,
  options: Omit<MarkdownEditorTransaction, 'changes' | 'selection'>,
  mergeDirection: MarkdownEditorInputMergeDirection = 'none',
) => {
  const change = deriveMarkdownEditorChange(kernel.value, nextValue)
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

const setMode = (mode: MarkdownEditorMode) => {
  if (editingBlocked.value || isComposing.value) return
  capturePreviewScrollLeft()
  kernel.store.breakMergeGroup()
  const nextMode = normalizeModeForLayout(mode)
  const retained = retainMarkdownLiveSelection({
    documentIdentity,
    mode: nextMode,
    selection: captureSelection(false),
    source: kernel.value,
  })
  kernel.store.setSelection(retained.selection, false)
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
  getRevision: () => kernel.revision,
  getSelection: () => kernel.selection,
  getSource: () => kernel.value,
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
  getRevision: () => kernel.revision,
  getSelection: () => kernel.selection,
  getSource: () => kernel.value,
  isComposing,
  localeText,
  recordPasteIdentity: (identity) => {
    pasteIdentityBridge.record?.(identity)
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
  getRevision: () => kernel.revision,
  getSource: () => kernel.value,
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
  getRevision: () => kernel.revision,
  getSource: () => kernel.value,
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
    revision: kernel.revision,
    selection: captureSelection(false),
    session: atomicSession.value,
    shift: extras.shift,
    source: kernel.value,
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
    revision: kernel.revision,
    selection: captureSelection(),
    session: atomicSession.value,
    source: kernel.value,
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
    revision: kernel.revision,
    selection: captureSelection(),
    source: kernel.value,
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
    revision: kernel.revision,
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
      currentRevision: kernel.revision,
    },
    eventFingerprint,
    session: attachmentCaptureSession,
  })
  if (!captured.ok) return captured

  const planned = planMarkdownAttachmentInsert(
    kernel.value,
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

const {
  activateCommand,
  activateOverflowCommand,
  closeCommandOverflow,
  closeSelectionToolbar,
  commandDescriptionId,
  commandGroupName,
  commandName,
  commandOverflowAriaLabel,
  commandSnapshot,
  commandStateId,
  commandStateText,
  configuredPrimaryCommands,
  disposeToolbarOverflow,
  gatedPasteAsMarkdownCommand,
  isCommandDisabled,
  mountToolbarOverflow,
  overflowActions,
  overflowCommands,
  overflowItemCount,
  primaryActions,
  primaryCommands,
  resolvedCommandOverflowLabel,
  runCommand,
  selectionToolbarAnchorId,
  selectionToolbarCommands,
  selectionToolbarPlacement,
  selectionToolbarVisible,
  toggleCommands,
  worstCaseOverflowCount,
} = useEditorToolbarCommands({
  captureSelection,
  commandGroupRef,
  commandMeasureRef,
  commandOverflowRef,
  commandRuntimeVersion,
  commandsExpanded,
  commandsRef,
  commandTrayId,
  commandTrayRef,
  currentMode,
  dispatchTransaction,
  documentIdentity,
  editingBlocked,
  editorAnchorMap,
  editorProjection,
  editorRevision,
  editorSelection,
  editorValue,
  effectiveToolbarDensity,
  frameScheduler,
  isComposing,
  isFreezeSmartInput: () => nativeMachine.freezeSmartInput,
  kernel,
  localeText,
  onCommandExecuted: (command) => emit('command', command),
  openContextualSurface,
  openPasteAsMarkdownSurface,
  pasteAsMarkdownBusy,
  pasteAsMarkdownDescriptionId,
  pasteAsMarkdownGate,
  props,
  restoreTextareaSelection,
  textareaRef,
})

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

const {
  clearRenderedSearchHighlights,
  closeSearch,
  handleSearchInputKeydown,
  handleSearchQueryInput,
  handleSearchReplaceKeydown,
  openSearch,
  searchHighlightStyle,
  searchMatches,
  searchMode,
  searchNavigate,
  searchQuery,
  searchReplaceAll,
  searchReplaceCurrent,
  searchReplaceText,
  searchUiState,
  syncRenderedSearchHighlights,
  toggleSearchMode,
  toggleSearchReplace,
  visibleSearchHighlights,
} = useEditorSearchController({
  currentMode,
  dispatchTransaction,
  documentIdentity,
  editorRevision,
  editorValue,
  focusSearchInput: (replace) => searchBarRef.value?.focusInput(replace),
  getRevision: () => kernel.revision,
  getSource: () => kernel.value,
  inputVisible,
  localeText,
  previewRendererRef,
  restoreTextareaSelection,
  rootElementRef,
  textareaRef,
})

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
  return dispatchEditorOperation({
    kind: 'transaction',
    transaction: kernel.createInsertTransaction(markdown, selection, options),
  }).accepted
}

const {
  handleBeforeInput,
  handleBlur,
  handleCompositionEnd,
  handleCompositionStart,
  handleCopy,
  handleCut,
  handleDrop,
  handleInput,
  handleKeydown,
  handlePaste,
  handlePointerReveal,
  handleSelectionDragEnd,
  handleSelectionDragStart,
  handleSelectionKeyup,
  handleSelectionMove,
  recordPasteIdentity,
  resetPendingInputState,
} = useEditorInputPipeline({
  activeSlashIndex,
  activeSlashTrigger,
  applyAtomicIntent,
  applyLiveSelectionMotion,
  atomicSession,
  captureAttachmentFiles,
  captureSelection,
  clearTypewriterScrollTarget,
  closeSearch,
  closeSlashMenu,
  commands: computed(() => props.commands),
  currentMode,
  disabled: computed(() => props.disabled),
  dispatchReplacement,
  dispatchTransaction,
  documentIdentity,
  editingBlocked,
  editorValue,
  emitSave,
  emitSubmit,
  executeSlashCommand,
  getLanguageToolsController: () => languageToolsController,
  isComposing,
  isRestoringSelection: () => restoringSelection,
  isSearchOpen: () => searchUiState.value.open,
  kernel,
  liveRevealState: () => liveReveal.value.state,
  markLayoutGesture,
  moveSlashIndex,
  nativeCompositionValue,
  nativeMachine,
  openSearch,
  readSelectionFrom,
  redo,
  refreshCurrentTableCell,
  refreshLiveReveal,
  refreshWritingAidsDocument,
  restoreTextareaSelection,
  runCommand,
  slashCommands,
  suspendTypewriterForUserScroll,
  syncLanguageToolsState,
  syncNativeComposing,
  textareaRef,
  tryHandleTableClipboardPaste,
  tryHandleTableKeydown,
  undo,
  writingAidsController,
  writingAidsState,
})
pasteIdentityBridge.record = recordPasteIdentity

const { revealHeading, revealSourceRange } = useEditorOutlineReveal({
  applyTypewriterScroll,
  currentMode,
  documentIdentity,
  editorProjection,
  getRevision: () => kernel.revision,
  getSource: () => kernel.value,
  reducedMotionRequested,
  refreshLiveWindow,
  refreshWritingAidsDocument,
  resolvedWritingAids,
  restoreTextareaSelection,
  setStoreSelection,
  syncMirrorLayerScroll,
  textareaRef,
})

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
  const planned = planMarkdownAttachmentResolve(kernel.value, job, result)
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
    const planned = planMarkdownAttachmentRemove(kernel.value, job)
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

watch(
  [() => props.mode, () => props.defaultMode, () => props.mobileLayout],
  ([mode, defaultMode]) => {
    kernel.store.breakMergeGroup()
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
    if (value === kernel.value) return
    kernel.abortPendingCommands()
    frameScheduler.cancelAll()
    frameScheduler.schedulePostPaint('frame-metrics-settle', () => undefined)
    nativeMachine.apply({
      documentIdentity,
      kind: 'external-reset',
      revision: kernel.revision,
      value,
    })
    syncNativeComposing()
    resetPendingInputState()
    const result = dispatchEditorOperation({
      allowBlocked: true,
      emitValue: false,
      internalPropReset: true,
      kind: 'transaction',
      restoreSelection: false,
      transaction: {
        changes: [{ from: 0, insert: value, to: kernel.value.length }],
        externalUpdate: 'reset',
        history: 'skip',
        metadata: Object.freeze({ kind: 'external-reset' }),
        origin: 'external',
        selection: {
          direction: kernel.selection.direction,
          end: value.length,
          start: value.length,
        },
      },
    })
    if (result.accepted) resetTableState()
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

  kernel.store.breakMergeGroup()
  if (isComposing.value) {
    nativeMachine.apply({
      documentIdentity,
      kind: 'external-reset',
      revision: kernel.revision,
    })
    syncNativeComposing()
    resetPendingInputState()
    triggerRef(editorValue)
  }
})

watch(
  [() => props.documentIdentity?.id, () => props.documentIdentity?.epoch],
  ([id, epoch], [previousId, previousEpoch]) => {
    const nextId = id ?? commandTrayId
    const nextEpoch = epoch ?? 0
    if (nextId === previousId && nextEpoch === previousEpoch) return

    resetPaletteAndSlash()
    resetContextualSurface()
    resetPasteSurface()
    resetTableState()
    commandsExpanded.value = false
    resetPendingInputState()
    atomicSession.value = null
    liveAtomic.value = null

    documentIdentity.id = nextId
    documentIdentity.epoch = nextEpoch
    nativeMachine.apply({
      documentIdentity,
      kind: 'external-reset',
      revision: kernel.revision,
      value: props.modelValue,
    })
    syncNativeComposing()

    const switched = kernel.switchDocument(documentIdentity, props.modelValue)
    previousEditorProjection = undefined
    previousEditorProjectionSource = ''
    editorValue.value = switched.value
    editorRevision.value = switched.revision
    editorSelection.value = switched.selection
    refreshLiveWindow('input')
    refreshLiveReveal()
    void restoreTextareaSelection(switched.selection)
    if (switched.historyChanged) {
      emit('history-change', switched.history)
    }
  },
)

onMounted(() => {
  const textarea = textareaRef.value
  if (textarea) {
    languageToolsController = bindMarkdownWebLanguageTools(textarea, {
      anchorMap: editorAnchorMap.value,
      config: languageToolsConfig(),
      documentIdentity,
      mode: currentMode.value,
      projection: editorProjection.value,
      projectionRevision: kernel.revision,
      revision: kernel.revision,
      source: kernel.value,
    })
    languageToolsRevision = kernel.revision
    languageToolsSource = kernel.value
    languageToolsConfigKey = JSON.stringify(languageToolsConfig())
    syncLanguageToolsState()
  }
  mountViewportListeners()
  refreshWritingAidsDocument()
  mountToolbarOverflow()
})

onBeforeUnmount(() => {
  disposeToolbarOverflow()
  languageToolsController = null
  kernel.abortPendingCommands()
  attachmentCaptureSession.clear()
  attachmentBatches.clear()
  attachmentItems.clear()
  disposeViewport()
  clearRenderedSearchHighlights()
  disposeEmbeds()
})

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
