import { nextTick, ref, watch, type ComputedRef, type Ref } from 'vue'
import {
  planMarkdownReplaceAll,
  planMarkdownReplaceCurrentInSet,
  type MarkdownDocumentIdentity,
  type MarkdownSearchMatch,
  type MarkdownSearchMode,
  type MarkdownSearchTask,
} from '@fsusui/wasm/markdown-runtime'
import type {
  MarkdownEditorLocaleText,
  MarkdownEditorMode,
} from '../markdown-editor'
import {
  dispatchMarkdownSearchKeydown,
  executeMarkdownSearchSession,
  resolveMarkdownSearchNavigation,
  resolveMarkdownSearchUi,
  revealMarkdownSearchMatch,
} from '../markdown-editor-search-ui'
import type {
  MarkdownEditorDispatchResult,
  MarkdownEditorSelection,
  MarkdownEditorTransaction,
} from '../markdown-editor-transaction'
import { useEditorSearchHighlights } from './use-editor-search-highlights'

export interface UseEditorSearchControllerOptions {
  readonly currentMode: Ref<MarkdownEditorMode>
  readonly dispatchTransaction: (
    transaction: MarkdownEditorTransaction,
  ) => MarkdownEditorDispatchResult
  readonly documentIdentity: MarkdownDocumentIdentity
  readonly editorRevision: Ref<number>
  readonly editorValue: Ref<string>
  readonly focusSearchInput: (replace: boolean) => void
  readonly getRevision: () => number
  readonly getSource: () => string
  readonly inputVisible: ComputedRef<boolean>
  readonly localeText: ComputedRef<MarkdownEditorLocaleText>
  readonly previewRendererRef: Ref<HTMLElement | { $el?: HTMLElement } | null>
  readonly restoreTextareaSelection: (
    selection: MarkdownEditorSelection,
    focus?: boolean,
  ) => Promise<void>
  readonly rootElementRef: Ref<HTMLElement | null>
  readonly textareaRef: Ref<HTMLTextAreaElement | null>
}

export function useEditorSearchController(
  options: UseEditorSearchControllerOptions,
) {
  const {
    currentMode,
    dispatchTransaction,
    documentIdentity,
    editorRevision,
    editorValue,
    focusSearchInput,
    getRevision,
    getSource,
    inputVisible,
    localeText,
    previewRendererRef,
    restoreTextareaSelection,
    rootElementRef,
    textareaRef,
  } = options

  const searchUiState = ref(
    resolveMarkdownSearchUi(false, '', 0, { copy: localeText.value.search }),
  )
  const searchQuery = ref('')
  const searchReplaceText = ref('')
  const searchMatches = ref<readonly MarkdownSearchMatch[]>([])
  const searchCurrentIndex = ref<number | null>(null)
  const searchMode = ref<MarkdownSearchMode>('plain')
  const searchTask = ref<MarkdownSearchTask | null>(null)

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

  const buildSearchUi = (open: boolean, replaceOpen: boolean) =>
    resolveMarkdownSearchUi(open, searchQuery.value, searchMatches.value.length, {
      copy: localeText.value.search,
      currentIndex: searchCurrentIndex.value,
      mode: searchMode.value,
      replaceOpen,
      replaceText: searchReplaceText.value,
    })

  const updateSearchState = () => {
    searchUiState.value = buildSearchUi(
      searchUiState.value.open,
      searchUiState.value.replaceOpen,
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
      revision: getRevision(),
      source: getSource(),
    })
    searchTask.value = session.task
    searchMatches.value = session.execution.matches
    searchCurrentIndex.value = session.execution.matches.length > 0 ? 0 : null
    updateSearchState()
  }

  const openSearch = (replace = false) => {
    searchUiState.value = buildSearchUi(true, replace)
    if (searchQuery.value) {
      runSearch()
    }
    void nextTick(() => {
      focusSearchInput(replace)
    })
  }

  const closeSearch = () => {
    searchUiState.value = buildSearchUi(false, false)
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
    searchUiState.value = buildSearchUi(
      searchUiState.value.open,
      !searchUiState.value.replaceOpen,
    )
  }

  const searchNavigate = (direction: 'next' | 'previous') => {
    const result = resolveMarkdownSearchNavigation(
      searchMatches.value,
      searchCurrentIndex.value,
      direction,
    )
    if (!result.match) return 'not-found' as const

    const reveal = revealMarkdownSearchMatch({
      currentMode: currentMode.value,
      documentIdentity,
      match: result.match,
      revision: getRevision(),
      source: getSource(),
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

  const buildReplaceDocument = () => ({
    documentEpoch: documentIdentity.epoch,
    documentId: documentIdentity.id,
    query: {
      mode: searchMode.value,
      queryVersion: 1,
      text: searchQuery.value,
    },
    revision: getRevision(),
    source: getSource(),
  })

  const searchReplaceCurrent = () => {
    if (searchCurrentIndex.value === null || !searchMatches.value.length) return
    const plan = planMarkdownReplaceCurrentInSet(
      buildReplaceDocument(),
      searchMatches.value,
      searchCurrentIndex.value,
      searchReplaceText.value,
    )
    if ('changes' in plan) {
      dispatchTransaction({
        changes: [...plan.changes],
        expectedRevision: getRevision(),
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
      buildReplaceDocument(),
      searchMatches.value,
      searchReplaceText.value,
    )
    if ('changes' in plan) {
      dispatchTransaction({
        changes: [...plan.changes],
        expectedRevision: getRevision(),
        history: 'separate',
        origin: 'command',
        selection: plan.selection,
      })
      runSearch()
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

  watch([editorValue, editorRevision, currentMode], () => {
    if (searchUiState.value.open && searchQuery.value) runSearch()
  })

  return {
    clearRenderedSearchHighlights,
    closeSearch,
    handleSearchInputKeydown,
    handleSearchQueryInput,
    handleSearchReplaceKeydown,
    openSearch,
    runSearch,
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
  }
}
