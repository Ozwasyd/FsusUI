<template>
    <section
      v-if="markdownProjectionFixture"
      data-testid="markdown-projection-production-fixture"
    >
      <el-markdown-editor
        v-model="markdownProjectionSource"
        default-mode="live"
        :min-rows="4"
        :show-actions="false"
        :show-mode-switcher="false"
      />
      <output data-testid="markdown-projection-main">
        {{ JSON.stringify(markdownProjectionMainSummary) }}
      </output>
      <output data-testid="markdown-projection-worker">
        {{ JSON.stringify(markdownProjectionWorkerSummary) }}
      </output>
    </section>

    <section
      v-if="markdownEditorTransactionFixture && markdownEditorMountReady"
      data-testid="markdown-editor-transaction-fixture"
      :data-markdown-editor-probe-id="markdownEditorProbeId"
      :dir="markdownCommandDirection"
    >
      <el-markdown-editor
        ref="markdownTransactionEditor"
        v-model="markdownTransactionValue"
        :commands="markdownPaletteImeCommands"
        v-bind="markdownPasteGateAttributes"
        :document-identity="{
          epoch: 1,
          id: `markdown-command-${markdownContextualSurface ?? 'default'}`,
        }"
        :default-mode="markdownEditorDefaultMode"
        :disabled="markdownPasteGate === 'disabled'"
        :locale-text="markdownCommandLocaleText"
        :interaction-profile="markdownEditorInteractionProfile"
        :min-rows="6"
        :mobile-layout="markdownCommandMobileLayout"
        :show-actions="false"
        :show-mode-switcher="
          markdownLanguageToolsFixture || markdownEditorModeMatrixFixture
        "
        :status-density="markdownCommandStatusDensity"
        :surfaces="
          markdownCommandSurfacesFixture
            ? {
                commandPalette: true,
                selectionToolbar: true,
                slashMenu: true,
              }
            : undefined
        "
        data-markdown-input-authority="transaction-store"
        @history-change="markdownTransactionHistory = $event"
        @selection-change="markdownTransactionSelection = $event"
        @transaction="recordMarkdownTransaction"
        @upload-image="recordMarkdownAttachmentBatch"
      />
      <div
        v-if="!markdownEditorTableEvidenceFixture"
        aria-label="Markdown transaction controls"
      >
        <button
          v-if="markdownCommandSurfacesFixture"
          type="button"
          data-testid="markdown-open-command-palette"
          @click="markdownTransactionEditor?.openCommandPalette()"
        >
          Open command palette
        </button>
        <output
          v-if="markdownPaletteImeFixture"
          aria-label="Command runs"
          data-testid="markdown-palette-command-runs"
        >
          {{ markdownPaletteCommandRuns }}
        </output>
        <button
          type="button"
          data-testid="markdown-programmatic"
          @click="insertMarkdownFixture"
        >
          Programmatic insert
        </button>
        <button
          type="button"
          data-testid="markdown-placeholder"
          @click="insertMarkdownPlaceholder"
        >
          Insert placeholder
        </button>
        <button
          type="button"
          data-testid="markdown-replace-placeholder"
          @click="replaceMarkdownPlaceholder"
        >
          Replace placeholder
        </button>
        <button
          type="button"
          data-testid="markdown-stale-replacement"
          @click="dispatchStaleMarkdownReplacement"
        >
          Dispatch stale replacement
        </button>
        <button
          type="button"
          data-testid="markdown-undo"
          @click="markdownTransactionEditor?.undo()"
        >
          Undo
        </button>
        <button
          type="button"
          data-testid="markdown-redo"
          @click="markdownTransactionEditor?.redo()"
        >
          Redo
        </button>
        <button
          type="button"
          data-testid="markdown-external-reset"
          @click="markdownTransactionValue = '外部重置😀éאב'"
        >
          External reset
        </button>
        <button
          type="button"
          data-testid="markdown-large-document"
          @click="loadLargeMarkdownDocument"
        >
          Load 100k document
        </button>
        <button
          type="button"
          data-testid="markdown-attachment-progress"
          :disabled="!markdownAttachmentBatch"
          @click="progressMarkdownAttachmentFixture"
        >
          Attachment progress
        </button>
        <button
          type="button"
          data-testid="markdown-attachment-resolve"
          :disabled="!markdownAttachmentBatch"
          @click="resolveMarkdownAttachmentFixture"
        >
          Resolve attachment
        </button>
        <button
          type="button"
          data-testid="markdown-load-figure"
          @click="loadMarkdownFigureFixture"
        >
          Load image figure
        </button>
      </div>
      <output
        v-if="!markdownEditorTableEvidenceFixture"
        data-testid="markdown-editor-value"
      >
        {{ markdownTransactionValue.length }}
      </output>
      <output
        v-if="!markdownEditorTableEvidenceFixture"
        data-testid="markdown-editor-revision"
      >
        {{ markdownTransactionRevision }}
      </output>
      <output
        v-if="!markdownEditorTableEvidenceFixture"
        data-testid="markdown-editor-history"
      >
        {{ JSON.stringify(markdownTransactionHistory) }}
      </output>
      <output
        v-if="!markdownEditorTableEvidenceFixture"
        data-testid="markdown-editor-last-transaction"
      >
        {{ JSON.stringify(markdownLastTransaction) }}
      </output>
      <output
        v-if="!markdownEditorTableEvidenceFixture"
        data-testid="markdown-editor-selection"
      >
        {{ JSON.stringify(markdownTransactionSelection) }}
      </output>
      <output
        v-if="!markdownEditorTableEvidenceFixture"
        data-testid="markdown-attachment-batch"
      >
        {{ JSON.stringify(markdownAttachmentBatchSnapshot) }}
      </output>
    </section>

    <section
      v-if="markdownSearchEmbedFixture"
      data-testid="markdown-search-embed-fixture"
      v-bind="{
        'data-document-epoch': String(markdownSearchEmbedEpoch),
      }"
    >
      <div aria-label="Markdown search and embed fixture controls">
        <button
          v-for="mode in markdownSearchEmbedModes"
          :key="mode"
          type="button"
          :data-testid="`markdown-search-embed-mode-${mode}`"
          @click="markdownSearchEmbedMode = mode"
        >
          {{ mode }}
        </button>
        <button
          type="button"
          data-testid="markdown-search-embed-open-find"
          @click="markdownSearchEmbedEditor?.openSearch(false)"
        >
          Open find
        </button>
        <button
          type="button"
          data-testid="markdown-search-embed-open-replace"
          @click="markdownSearchEmbedEditor?.openSearch(true)"
        >
          Open replace
        </button>
        <button
          type="button"
          data-testid="markdown-search-embed-switch-document"
          @click="switchMarkdownSearchEmbedDocument"
        >
          Switch document
        </button>
        <button
          type="button"
          data-testid="markdown-search-embed-resolve-failure"
          @click="markdownSearchEmbedResolveFailure = true"
        >
          Resolve failed embed on retry
        </button>
        <button
          type="button"
          data-testid="markdown-search-embed-load-performance"
          @click="loadMarkdownSearchPerformanceFixture"
        >
          Load 100k / 10000 matches
        </button>
        <button
          type="button"
          data-testid="markdown-search-embed-reset"
          @click="resetMarkdownSearchEmbedFixture"
        >
          Reset fixture
        </button>
      </div>
      <el-markdown-editor
        :key="`markdown-search-embed-${markdownSearchEmbedEpoch}`"
        ref="markdownSearchEmbedEditor"
        v-model="markdownSearchEmbedValue"
        :embed-provider="markdownSearchEmbedProvider"
        :interaction-profile="
          markdownSearchEmbedTouch ? 'touch' : 'keyboard'
        "
        :min-rows="10"
        :mode="markdownSearchEmbedMode"
        :show-actions="false"
        v-bind="{ 'data-testid': 'markdown-search-embed-editor' }"
        @embed-open-source="
          (target, mode) =>
            (markdownSearchEmbedLastOpen = `${target}:${mode}`)
        "
        @embed-retry="
          (target, mode) =>
            (markdownSearchEmbedLastRetry = `${target}:${mode}`)
        "
        @history-change="markdownSearchEmbedHistory = $event"
        @selection-change="markdownSearchEmbedSelection = $event"
      />
      <output data-testid="markdown-search-embed-value">
        {{ markdownSearchEmbedValue }}
      </output>
      <output data-testid="markdown-search-embed-mode">
        {{ markdownSearchEmbedMode }}
      </output>
      <output data-testid="markdown-search-embed-request">
        {{ JSON.stringify(markdownSearchEmbedLastRequest) }}
      </output>
      <output data-testid="markdown-search-embed-open">
        {{ markdownSearchEmbedLastOpen }}
      </output>
      <output data-testid="markdown-search-embed-retry">
        {{ markdownSearchEmbedLastRetry }}
      </output>
      <output data-testid="markdown-search-embed-history">
        {{ JSON.stringify(markdownSearchEmbedHistory) }}
      </output>
      <output data-testid="markdown-search-embed-selection">
        {{ JSON.stringify(markdownSearchEmbedSelection) }}
      </output>
    </section>

    <section
      v-if="markdownWritingAidsFixture"
      :dir="markdownWritingAidsDirection"
      data-testid="markdown-writing-aids-fixture"
    >
      <div
        data-testid="markdown-writing-aids-nested-scroll"
        style="max-height: 38rem; overflow: auto"
      >
        <el-markdown-editor
          ref="markdownWritingAidsEditor"
          v-model="markdownWritingAidsValue"
          :chrome="markdownWritingAidsChrome"
          editor-profile="prose"
          :mode="markdownWritingAidsMode"
          :min-rows="12"
          :show-actions="false"
          :show-mode-switcher="false"
          :writing-aids="markdownWritingAidsOptions"
        />
      </div>
      <button
        type="button"
        data-testid="markdown-reveal-details"
        @click="revealMarkdownDetails"
      >
        Reveal details
      </button>
      <button
        type="button"
        data-testid="markdown-reveal-virtual"
        @click="revealVirtualMarkdownDetails"
      >
        Reveal virtual details
      </button>
      <button
        type="button"
        data-testid="markdown-reveal-missing"
        @click="revealMissingMarkdownHeading"
      >
        Reveal missing heading
      </button>
      <button
        v-for="mode in markdownWritingAidsModes"
        :key="mode"
        type="button"
        :data-testid="`markdown-mode-${mode}`"
        @click="markdownWritingAidsMode = mode"
      >
        {{ mode }}
      </button>
      <output data-testid="markdown-reveal-status">{{
        markdownRevealStatus
      }}</output>
    </section>
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue'
import {
  MARKDOWN_PROJECTION_WORKER_REQUEST,
  createMarkdownEditorProjection,
  isMarkdownProjectionWorkerResult,
  markdownEditorProjectionsEquivalent,
  type MarkdownEditorProjectionResult,
  type MarkdownProjectionWorkerRequest,
} from '../../../wasm/markdown-runtime'
import type {
  MarkdownAttachmentBatchIntent,
  MarkdownEditorCommand,
  MarkdownEditorDispatchResult,
  MarkdownEditorHistoryState,
  MarkdownEditorInstance,
  MarkdownEditorLocaleTextOverride,
  MarkdownEditorMode,
  MarkdownEditorSelectionEvent,
  MarkdownEditorTransactionEvent,
  MarkdownEmbedProvider,
  MarkdownEmbedRequest,
} from '../../../element-plus'

const markdownProjectionSource = ref(
  '![初始 alt](/old.png "old title")\n::caption[说明 😀 RTL אב]',
)
const markdownProjectionFixture =
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).get('markdownProjection') === '1'
const summarizeMarkdownProjection = (
  projection: MarkdownEditorProjectionResult,
) =>
  Object.freeze({
    identity: projection.identity,
    kinds: projection.nodes.map((node) => node.kind),
    nodes: projection.nodes
      .filter((node) => node.kind === 'image' || node.kind === 'caption')
      .map((node) => ({
        blockIdentity: node.blockIdentity,
        kind: node.kind,
        normalizedContentRanges: node.normalizedContentRanges,
        normalizedMarkerRanges: node.normalizedMarkerRanges,
        normalizedRange: node.normalizedRange,
        presentation: node.presentation,
        rawContentRanges: node.rawContentRanges,
        rawMarkerRanges: node.rawMarkerRanges,
        rawRange: node.rawRange,
        status: node.status,
      })),
  })
const markdownProjectionMain = markdownProjectionFixture
  ? createMarkdownEditorProjection(markdownProjectionSource.value)
  : null
const markdownProjectionMainSummary = markdownProjectionMain
  ? summarizeMarkdownProjection(markdownProjectionMain)
  : null
const markdownProjectionWorkerSummary = ref<
  | (ReturnType<typeof summarizeMarkdownProjection> & {
      readonly equivalent: boolean
    })
  | { readonly error: string }
  | { readonly status: 'pending' }
>({ status: 'pending' })
let markdownProjectionWorker: Worker | null = null

if (markdownProjectionFixture && markdownProjectionMain) {
  const documentIdentity = Object.freeze({
    epoch: 1,
    id: 'built-demo-projection',
  })
  const request: MarkdownProjectionWorkerRequest = {
    type: MARKDOWN_PROJECTION_WORKER_REQUEST,
    taskId: 'built-demo-projection:1',
    revision: 1,
    documentIdentity,
    source: markdownProjectionSource.value,
    plan: {
      taskId: 'built-demo-projection:1',
      revision: 1,
      documentIdentity,
      expanded: true,
      reason: 'expanded-unsafe',
      invalidatedRanges: [],
      invalidatedNodeIds: [],
      retainedNodeIds: [],
    },
    previous: {
      documentIdentity,
      normalizedSource: '',
      nodes: [],
    },
  }
  markdownProjectionWorker = new Worker(
    new URL('../../../wasm/markdown-projection.worker.ts', import.meta.url),
    { type: 'module' },
  )
  markdownProjectionWorker.addEventListener('message', ({ data }) => {
    if (!isMarkdownProjectionWorkerResult(data)) {
      markdownProjectionWorkerSummary.value = {
        error: 'invalid projection worker result',
      }
      return
    }
    markdownProjectionWorkerSummary.value = {
      ...summarizeMarkdownProjection(data.projection),
      equivalent: markdownEditorProjectionsEquivalent(
        markdownProjectionMain,
        data.projection,
      ),
    }
  })
  markdownProjectionWorker.addEventListener('error', ({ message }) => {
    markdownProjectionWorkerSummary.value = {
      error: message || 'projection worker failed',
    }
  })
  markdownProjectionWorker.postMessage(request)
}

onUnmounted(() => {
  markdownProjectionWorker?.terminate()
})

const markdownEditorTransactionFixture =
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).get(
    'markdownEditorTransaction',
  ) === '1'
const markdownLanguageToolsFixture =
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).get('markdownLanguageTools') ===
    '1'
const markdownWritingAidsFixture =
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).get('markdownWritingAids') === '1'
const markdownWritingAidsCombo =
  typeof window === 'undefined'
    ? 'both'
    : new URLSearchParams(window.location.search).get(
        'markdownWritingAidsCombo',
      ) ?? 'both'
const markdownWritingAidsChromeParam =
  typeof window === 'undefined'
    ? null
    : new URLSearchParams(window.location.search).get(
        'markdownWritingAidsChrome',
      )
const markdownWritingAidsChrome: 'framed' | 'embedded' | 'minimal' =
  markdownWritingAidsChromeParam === 'embedded' ||
  markdownWritingAidsChromeParam === 'minimal'
    ? markdownWritingAidsChromeParam
    : 'framed'
const markdownWritingAidsOptions = {
  focus:
    markdownWritingAidsCombo === 'focus' || markdownWritingAidsCombo === 'both',
  typewriter:
    markdownWritingAidsCombo === 'typewriter' ||
    markdownWritingAidsCombo === 'both',
}
const markdownEditorImeFixture =
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).get('markdownEditorIme') === '1'
const markdownEditorTableFixture =
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).get('markdownEditorTable') === '1'
const markdownEditorTableEvidenceFixture =
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).get(
    'markdownEditorTableEvidence',
  ) === '1'
const markdownEditorTableMatrixFixture =
  typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search).get(
        'markdownEditorTableMatrix',
      )
    : null
const markdownEditorModeMatrixFixture =
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).get('markdownEditorModeMatrix') ===
    '1'
const markdownEditorRequestedMode =
  typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search).get('markdownEditorMode')
    : null
const markdownTableMatrix = (rows: number, columns: number) => {
  const header = Array.from(
    { length: columns },
    (_, column) => `Column ${column + 1}`,
  )
  const separator = Array.from({ length: columns }, () => '---')
  const body = Array.from({ length: rows }, (_, row) =>
    Array.from(
      { length: columns },
      (_, column) => `r${row + 1}c${column + 1}`,
    ),
  )
  return [header, separator, ...body]
    .map((cells) => `| ${cells.join(' | ')} |`)
    .join('\n')
}
const defaultMarkdownTable = [
  '| Project | Owner | Status |',
  '| --- | --- | --- |',
  '| Documentation migration | Editorial systems | In review |',
  '| Runtime projection | Platform team | Ready |',
].join('\n')
const markdownEditorTableValue =
  markdownEditorTableMatrixFixture === '20x50'
    ? markdownTableMatrix(50, 20)
    : markdownEditorTableMatrixFixture === '1x1'
      ? markdownTableMatrix(1, 1)
      : markdownEditorTableMatrixFixture === 'large'
        ? [
            ...Array.from(
              { length: 500 },
              (_, index) => `Paragraph before table ${index + 1}.`,
            ),
            '',
            defaultMarkdownTable,
            '',
            ...Array.from(
              { length: 500 },
              (_, index) => `Paragraph after table ${index + 1}.`,
            ),
          ].join('\n')
        : defaultMarkdownTable
const markdownSearchEmbedFixture =
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).get('markdownSearchEmbed') ===
    '1'
const markdownSearchEmbedTouch =
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).get(
    'markdownSearchEmbedTouch',
  ) === '1'
const markdownCommandSurfacesFixture =
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).get('markdownCommandSurfaces') ===
    '1'
const markdownPaletteImeFixture =
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).get('markdownPaletteIme') === '1'
const markdownPaletteCommandRuns = ref(0)
const markdownPaletteImeCommands: readonly MarkdownEditorCommand[] | undefined =
  markdownPaletteImeFixture
    ? [
        {
          key: 'ime-confirm-witness',
          label: 'Confirm command 确认',
          group: 'custom',
          presentation: ['palette'],
          run: () => {
            markdownPaletteCommandRuns.value += 1
            return { focus: 'none' }
          },
        },
      ]
    : undefined
const markdownContextualSurface =
  typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search).get('markdownContextual')
    : null
const markdownCommandLocale =
  typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search).get('markdownLocale')
    : null
const markdownCommandDirection =
  markdownCommandLocale === 'ar' || markdownCommandLocale === 'he'
    ? 'rtl'
    : 'ltr'
const markdownCommandStatusDensity =
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).get('markdownStatus') ===
    'detailed'
    ? 'detailed'
    : typeof window !== 'undefined' &&
        new URLSearchParams(window.location.search).get('markdownStatus') ===
          'none'
      ? 'none'
      : 'minimal'
const markdownCommandMobileLayout =
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).get('markdownMobile') ===
    'compact'
    ? 'compact'
    : 'standard'
const markdownCommandLocaleText = computed<
  MarkdownEditorLocaleTextOverride | undefined
>(() => {
  if (!markdownCommandLocale) return undefined
  const prefix =
    markdownCommandLocale === 'long'
      ? 'A deliberately extended localization fixture that preserves every semantic label'
      : markdownCommandLocale.toUpperCase()
  const label = (value: string) => `${prefix} ${value}`
  return {
    search: {
      close: label('close search'),
      find: label('find'),
      findAndReplaceAria: label('find and replace'),
      findAria: label('find in document'),
      matchCase: label('match case'),
      nextMatch: label('next match'),
      noMatches: label('no matches'),
      previousMatch: label('previous match'),
      replace: label('replace'),
      replaceAll: label('replace all'),
      replaceWithAria: label('replace with'),
      results: (current: number, total: number) =>
        label(`${current} of ${total}`),
      toggleReplace: label('toggle replace'),
      truncatedResults: (count: number) => label(`${count}+ matches`),
      useRegex: label('use regular expression'),
      wholeWord: label('whole word'),
    },
    attachments: {
      actions: {
        cancel: label('cancel upload'),
        remove: label('remove attachment'),
        retry: label('retry upload'),
      },
      region: label('attachments'),
      unnamed: label('attachment'),
      uploading: (name: string) => label(`uploading ${name}`),
      status: (name: string, status: string, percent: number) =>
        label(`${name} ${status} ${percent}`),
    },
    imageProperties: {
      alt: label('alternative text'),
      apply: label('apply image properties'),
      caption: label('caption'),
      copySource: label('copy source'),
      copyVisible: label('copy visible'),
      destination: label('destination'),
      destinationRejected: (code: string) => label(`destination ${code}`),
      open: label('open image'),
      region: label('image properties'),
      removeCaption: label('remove caption'),
      removeImage: label('remove image'),
      replace: label('replace image'),
      source: label('image source'),
      title: label('image title'),
      updateRejected: (code: string) => label(`image update ${code}`),
    },
    embeds: {
      actions: {
        'source-reveal': label('reveal embed source'),
        'open-source': label('open embed source'),
        retry: label('retry embed'),
        copy: label('copy embed'),
        'caret-before': label('caret before embed'),
        'caret-after': label('caret after embed'),
        'select-node': label('select embed'),
        delete: label('delete embed'),
      },
      modes: {
        article: label('article'),
        heading: label('heading'),
        block: label('block'),
      },
      name: (target: string, mode: string) => label(`${target} ${mode}`),
      region: label('embedded content'),
      statuses: {
        idle: label('idle'),
        pending: label('pending'),
        resolved: label('resolved'),
        rejected: label('rejected'),
        error: label('error'),
        missing: label('missing'),
        forbidden: label('forbidden'),
        cycle: label('cycle'),
        stale: label('stale'),
        'depth-exceeded': label('depth exceeded'),
        'size-exceeded': label('size exceeded'),
        'time-exceeded': label('time exceeded'),
        'mode-mismatch': label('mode mismatch'),
      },
    },
    atomic: {
      actionsRegion: (kind: string) => label(`${kind} actions`),
      editSource: (kind: string) => label(`edit ${kind} source`),
      enterAfter: (kind: string) => label(`enter after ${kind}`),
      enterBefore: (kind: string) => label(`enter before ${kind}`),
    },
    commandGroups: {
      block: label('block'),
      format: label('format'),
      insert: label('insert'),
    },
    commandPalette: {
      empty: label('empty'),
      results: (count: number) => label(`${count} results`),
      searchPlaceholder: label('search commands'),
      title: label('command palette'),
    },
    commands: {
      bold: label('bold'),
      code: label('code'),
      heading: label('heading'),
      image: label('image'),
      italic: label('italic'),
      link: label('link'),
      quote: label('quote'),
    },
    contextual: {
      anchorId: label('anchor ID'),
      apply: label('apply'),
      cancel: label('cancel'),
      copy: label('copy'),
      destination: label('destination'),
      editAnchor: label('edit anchor'),
      editLink: label('edit link'),
      invalidAnchor: label('invalid anchor'),
      insertAnchor: label('insert anchor'),
      label: label('label'),
      open: label('open'),
      removeAnchor: label('remove anchor'),
      removeLink: label('remove link'),
      sourceReveal: label('reveal source'),
      title: label('title'),
      unsafeUrl: label('unsafe URL'),
    },
    editorAria: label('Markdown editor'),
    metrics: {
      bytes: label('bytes'),
      characters: label('characters'),
      column: label('column'),
      line: label('line'),
      lines: label('lines'),
      selected: label('selected'),
      words: label('words'),
    },
    states: {
      disabled: label('disabled'),
      empty: label('empty'),
      loading: label('loading'),
      readonly: label('readonly'),
    },
    overflow: label('format tools'),
    overflowAria: (count: number) => label(`${count} format tools`),
    pasteAsMarkdown: {
      title: label('paste as Markdown'),
    },
    surfaces: {
      commandPending: label('command pending'),
      commandRejected: label('command rejected'),
      selectionToolbar: label('selection toolbar'),
      slashMenu: label('slash menu'),
    },
    textarea: {
      live: label('live editor'),
      source: label('source editor'),
    },
  }
})
const markdownEditorInteractionProfile =
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).get(
    'markdownEditorInteractionProfile',
  ) === 'keyboard'
    ? ('keyboard' as const)
    : undefined
const markdownPasteGate =
  typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search).get('markdownPasteGate')
    : null
const markdownEditorDefaultMode =
  markdownPasteGate === 'preview-only'
    ? 'preview'
    : markdownEditorRequestedMode === 'live' ||
        markdownEditorRequestedMode === 'split' ||
        markdownEditorRequestedMode === 'preview'
      ? markdownEditorRequestedMode
      : 'source'
const markdownPasteGateAttributes = computed(() =>
  markdownPasteGate === 'readonly' ? { readonly: true } : {},
)
const markdownEditorDelayMount =
  typeof window !== 'undefined'
    ? Number(
        new URLSearchParams(window.location.search).get(
          'markdownEditorDelayMount',
        ) ?? 0,
      )
    : 0
const markdownEditorMountReady = ref(markdownEditorDelayMount === 0)
const markdownEditorProbeKey = 'fsus-markdown-editor-probe-id'
const createMarkdownEditorProbeId = () =>
  typeof globalThis.crypto?.randomUUID === 'function'
    ? globalThis.crypto.randomUUID()
    : `markdown-editor-probe-${Math.random().toString(36).slice(2)}`
const markdownEditorProbeId = (() => {
  try {
    const existing = window.sessionStorage.getItem(markdownEditorProbeKey)
    if (existing) return existing
    const created = createMarkdownEditorProbeId()
    window.sessionStorage.setItem(markdownEditorProbeKey, created)
    return created
  } catch {
    return createMarkdownEditorProbeId()
  }
})()
if (markdownEditorDelayMount > 0) {
  window.setTimeout(() => {
    markdownEditorMountReady.value = true
  }, markdownEditorDelayMount)
}
const markdownTransactionEditor = ref<MarkdownEditorInstance>()
const markdownWritingAidsEditor = ref<MarkdownEditorInstance>()
const markdownWritingAidsModes = ['source', 'live', 'split', 'preview'] as const
const markdownWritingAidsMode = ref<'source' | 'live' | 'split' | 'preview'>(
  'source',
)
const markdownWritingAidsDirection =
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).get('markdownDirection') === 'rtl'
    ? 'rtl'
    : 'ltr'
const markdownWritingAidsHeadingCount =
  typeof window === 'undefined'
    ? 0
    : Math.min(
        10_000,
        Math.max(
          0,
          Number(
            new URLSearchParams(window.location.search).get(
              'markdownHeadingCount',
            ) ?? 0,
          ),
        ),
      )
const markdownWritingAidsValue = ref(
  [
    '# Writing session',
    ...Array.from(
      { length: markdownWritingAidsHeadingCount },
      (_, index) => `## Section ${index + 1}`,
    ),
    ...Array.from(
      { length: 18 },
      (_, index) =>
        `Paragraph ${index + 1} keeps the document realistic and scrollable.`,
    ),
    '::embed[target="details" mode="block"]',
    'The selected section remains readable while surrounding blocks stay present.',
  ].join('\n\n'),
)
const markdownRevealStatus = ref('idle')
const markdownWritingAidsMarker = '::embed[target="details" mode="block"]'
const revealMarkdownDetails = () => {
  const start = markdownWritingAidsValue.value.indexOf(
    markdownWritingAidsMarker,
  )
  const status =
    markdownWritingAidsEditor.value?.revealSourceRange({
      start,
      end: start + markdownWritingAidsMarker.length,
    }) ?? 'missing-method'
  markdownRevealStatus.value = `${start}:${status}`
}
const revealVirtualMarkdownDetails = () => {
  const start = markdownWritingAidsValue.value.indexOf(
    markdownWritingAidsMarker,
  )
  const documentId =
    document
      .querySelector(
        '[data-testid="markdown-writing-aids-fixture"] [data-markdown-instance]',
      )
      ?.getAttribute('data-markdown-instance') ?? 'missing-document'
  const nodeId = 'fixture:virtual:details'
  const status =
    markdownWritingAidsEditor.value?.revealHeading(nodeId, {
      virtualTarget: {
        anchorId: nodeId,
        documentIdentity: { id: documentId, epoch: 0 },
        identity: documentId,
        range: {
          start,
          end: start + markdownWritingAidsMarker.length,
        },
        virtual: true,
      },
    }) ?? 'missing-method'
  markdownRevealStatus.value = `virtual:${status}`
}
const revealMissingMarkdownHeading = () => {
  const status =
    markdownWritingAidsEditor.value?.revealHeading('fixture:missing:heading') ??
    'missing-method'
  markdownRevealStatus.value = `missing:${status}`
}
const markdownTransactionValue = ref(
  markdownEditorImeFixture
    ? ''
    : markdownEditorTableFixture
      ? markdownEditorTableValue
      : markdownContextualSurface === 'link'
        ? '[Docs](https://old.test "Title")'
        : markdownContextualSurface === 'anchor'
          ? 'Paragraph ^intro'
          : markdownCommandSurfacesFixture
            ? '/bol'
            : 'A😀éאב\n- 列表',
)
const markdownTransactionHistory = ref<MarkdownEditorHistoryState>({
  canRedo: false,
  canUndo: false,
  redoDepth: 0,
  retainedUnits: 0,
  undoDepth: 0,
})
const markdownLastTransaction = ref<MarkdownEditorTransactionEvent | null>(null)
const markdownTransactionSelection = ref<MarkdownEditorSelectionEvent | null>(
  null,
)
const markdownAttachmentBatch = ref<MarkdownAttachmentBatchIntent | null>(null)
const markdownAttachmentBatchSnapshot = computed(() => {
  const batch = markdownAttachmentBatch.value
  if (!batch) return null
  return {
    anchor: batch.anchor,
    batchId: batch.batchId,
    items: batch.items.map(
      ({ byteLength, itemId, kind, mimeType, name, order }) => ({
        byteLength,
        itemId,
        kind,
        mimeType,
        name,
        order,
      }),
    ),
    revision: batch.revision,
    sourceKind: batch.sourceKind,
  }
})
const markdownTransactionRevision = computed(
  () => markdownLastTransaction.value?.revision ?? 0,
)
let markdownPlaceholderRevision: number | undefined

const recordMarkdownTransaction = (event: MarkdownEditorTransactionEvent) => {
  markdownLastTransaction.value = event
}

const recordMarkdownAttachmentBatch = (
  batch: MarkdownAttachmentBatchIntent,
) => {
  markdownAttachmentBatch.value = batch
}

const progressMarkdownAttachmentFixture = () => {
  const batch = markdownAttachmentBatch.value
  const item = batch?.items[0]
  if (!batch || !item) return
  markdownTransactionEditor.value?.applyAttachmentResult({
    batchId: batch.batchId,
    itemId: item.itemId,
    ratio: 0.5,
    status: 'progress',
  })
}

const resolveMarkdownAttachmentFixture = () => {
  const batch = markdownAttachmentBatch.value
  const item = batch?.items[0]
  if (!batch || !item) return
  markdownTransactionEditor.value?.applyAttachmentResult({
    batchId: batch.batchId,
    documentIdentity: batch.documentIdentity,
    itemId: item.itemId,
    payload: {
      alt: 'Resolved attachment',
      href: '/fixtures/resolved-attachment.png',
      markdownKind: 'image',
      mimeType: item.mimeType,
      name: item.name,
    },
    revision: batch.revision,
    status: 'resolved',
  })
}

const loadMarkdownFigureFixture = () => {
  markdownTransactionValue.value =
    '![初始 alt](/old.png "old title")\n::caption[说明 😀 RTL אב]'
}

const insertMarkdownFixture = () => {
  markdownTransactionEditor.value?.insertMarkdownAtCursor('【程序插入】', {
    metadata: { fixture: 'programmatic' },
  })
}

const insertMarkdownPlaceholder = () => {
  const from = markdownTransactionValue.value.length
  const result = markdownTransactionEditor.value?.dispatchTransaction({
    changes: [{ from, insert: '![uploading]', to: from }],
    history: 'separate',
    metadata: { fixture: 'placeholder' },
    origin: 'programmatic',
    selection: { end: from + 12, start: from + 12 },
  }) as MarkdownEditorDispatchResult | undefined
  if (result?.accepted) markdownPlaceholderRevision = result.revision
}

const replaceMarkdownPlaceholder = () => {
  const index = markdownTransactionValue.value.indexOf('![uploading]')
  if (index < 0 || markdownPlaceholderRevision === undefined) return
  const replacement = '![完成](asset.png)'
  markdownTransactionEditor.value?.dispatchTransaction({
    changes: [
      {
        from: index,
        insert: replacement,
        to: index + '![uploading]'.length,
      },
    ],
    expectedRevision: markdownPlaceholderRevision,
    history: 'separate',
    metadata: { fixture: 'async-replacement' },
    origin: 'programmatic',
    selection: {
      direction: 'none',
      end: index + replacement.length,
      start: index + replacement.length,
    },
  })
}

const dispatchStaleMarkdownReplacement = () => {
  markdownTransactionEditor.value?.dispatchTransaction({
    changes: [{ from: 0, insert: 'STALE', to: 0 }],
    expectedRevision: markdownPlaceholderRevision ?? 0,
    history: 'separate',
    metadata: { fixture: 'stale-replacement' },
    origin: 'programmatic',
    selection: { direction: 'none', end: 5, start: 5 },
  })
}

const loadLargeMarkdownDocument = () => {
  markdownTransactionValue.value = '界'.repeat(100_000)
}

const markdownSearchEmbedModes = [
  'source',
  'live',
  'split',
  'preview',
] as const satisfies readonly MarkdownEditorMode[]
const markdownSearchEmbedInitialValue = [
  '# Search and embed review',
  '',
  'alpha café 😀 אב alpha',
  '',
  '::embed[target="safe-doc" mode="article"]',
  '',
  '::embed[target="missing-doc" mode="heading"]',
  '',
  '::embed[target="forbidden-doc" mode="block"]',
  '',
  '::embed[target="cycle-doc" mode="article"]',
  '',
  '::embed[target="depth-doc" mode="heading"]',
  '',
  '::embed[target="mismatch-doc" mode="block"]',
  '',
  '::embed[target="pending-doc" mode="block"]',
  '',
  '::embed[target="stale-doc" mode="article"]',
  '',
  'Trailing alpha content.',
].join('\n')
const markdownSearchEmbedEditor = ref<MarkdownEditorInstance>()
const markdownSearchEmbedValue = ref(markdownSearchEmbedInitialValue)
const markdownSearchEmbedMode = ref<MarkdownEditorMode>('source')
const markdownSearchEmbedEpoch = ref(1)
const markdownSearchEmbedResolveFailure = ref(false)
const markdownSearchEmbedLastRequest = ref<MarkdownEmbedRequest | null>(null)
const markdownSearchEmbedLastOpen = ref('')
const markdownSearchEmbedLastRetry = ref('')
const markdownSearchEmbedHistory = ref<MarkdownEditorHistoryState>({
  canRedo: false,
  canUndo: false,
  redoDepth: 0,
  retainedUnits: 0,
  undoDepth: 0,
})
const markdownSearchEmbedSelection = ref<MarkdownEditorSelectionEvent | null>(
  null,
)
const markdownSearchEmbedProvider: MarkdownEmbedProvider = async (request) => {
  markdownSearchEmbedLastRequest.value = request
  const localFailureStatus = {
    'cycle-doc': 'cycle',
    'depth-doc': 'depth-exceeded',
    'forbidden-doc': 'forbidden',
    'mismatch-doc': 'mode-mismatch',
  } as const
  const failureStatus =
    localFailureStatus[request.target as keyof typeof localFailureStatus]
  if (failureStatus) {
    return Object.freeze({
      ...request,
      status: failureStatus,
    })
  }
  if (request.target === 'pending-doc') {
    return Object.freeze({
      ...request,
      status: 'pending' as const,
    })
  }
  if (request.target === 'stale-doc') {
    return Object.freeze({
      ...request,
      excerpt: 'This stale payload must not render.',
      revision: request.revision + 1,
      status: 'resolved' as const,
      title: 'Stale payload',
    })
  }
  if (
    request.target === 'missing-doc' &&
    !markdownSearchEmbedResolveFailure.value
  ) {
    return Object.freeze({
      ...request,
      status: 'missing' as const,
    })
  }
  return Object.freeze({
    ...request,
    excerpt:
      request.target === 'missing-doc'
        ? 'Recovered heading after an explicit retry.'
        : 'Resolved excerpt with <strong>literal provider markup</strong> and a long line that verifies wrapping without a nested scroll surface.',
    status: 'resolved' as const,
    title:
      request.target === 'missing-doc'
        ? 'Recovered heading'
        : 'Safe consumer document',
  })
}
const switchMarkdownSearchEmbedDocument = () => {
  markdownSearchEmbedEpoch.value += 1
  markdownSearchEmbedLastRequest.value = null
  markdownSearchEmbedLastOpen.value = ''
  markdownSearchEmbedLastRetry.value = ''
}
const loadMarkdownSearchPerformanceFixture = () => {
  const exactMatches = 'hit '.repeat(10_000)
  markdownSearchEmbedValue.value = `${exactMatches}${'界'.repeat(
    Math.max(0, 100_000 - exactMatches.length),
  )}`
}
const resetMarkdownSearchEmbedFixture = () => {
  markdownSearchEmbedValue.value = markdownSearchEmbedInitialValue
  markdownSearchEmbedMode.value = 'source'
  markdownSearchEmbedResolveFailure.value = false
  markdownSearchEmbedLastOpen.value = ''
  markdownSearchEmbedLastRetry.value = ''
  markdownSearchEmbedEpoch.value += 1
}
</script>
