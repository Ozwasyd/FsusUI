import { computed, nextTick, watch } from 'vue'
import type { ComputedRef, Ref } from 'vue'
import {
  resolveMarkdownSearchHighlights,
  type MarkdownSearchUiState,
} from '../markdown-editor-search-ui'
import type { MarkdownSearchMatch } from '@fsusui/wasm/markdown-search-model'
import type { MarkdownEditorMode } from '../markdown-editor'

type CssHighlightRegistry = {
  delete(name: string): boolean
  set(name: string, value: unknown): unknown
}

const MAX_RENDERED_SEARCH_HIGHLIGHTS = 256

const cssHighlightRegistry = () =>
  (
    globalThis.CSS as
      | (typeof CSS & { highlights?: CssHighlightRegistry })
      | undefined
  )?.highlights

const renderedSearchRanges = (
  root: HTMLElement,
  needles: readonly string[],
) => {
  const owner = root.ownerDocument
  const walker = owner.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  const textNodes: Text[] = []
  let node = walker.nextNode()
  while (node) {
    if (node instanceof Text && node.data) textNodes.push(node)
    node = walker.nextNode()
  }
  const nextOffsets = new Map<Text, number>()
  const ranges: Array<Range | null> = []
  for (const needle of needles) {
    if (!needle || needle.includes('\n')) {
      ranges.push(null)
      continue
    }
    let matched: Range | null = null
    for (const textNode of textNodes) {
      const index = textNode.data.indexOf(
        needle,
        nextOffsets.get(textNode) ?? 0,
      )
      if (index < 0) continue
      const range = owner.createRange()
      range.setStart(textNode, index)
      range.setEnd(textNode, index + needle.length)
      nextOffsets.set(textNode, index + needle.length)
      matched = range
      break
    }
    ranges.push(matched)
  }
  return ranges
}

export const useEditorSearchHighlights = (options: {
  currentMode: Ref<MarkdownEditorMode>
  editorValue: Ref<string>
  inputVisible: ComputedRef<boolean>
  previewRendererRef: Ref<HTMLElement | { $el?: HTMLElement } | null>
  searchCurrentIndex: Ref<number | null>
  searchMatches: Ref<readonly MarkdownSearchMatch[]>
  searchUiState: Ref<MarkdownSearchUiState>
}) => {
  const searchHighlights = computed(() =>
    resolveMarkdownSearchHighlights({
      currentIndex: options.searchCurrentIndex.value,
      matches: options.searchMatches.value,
      mode: options.currentMode.value,
      source: options.editorValue.value,
    }),
  )

  const renderedSearchHighlights = computed(() => {
    const items = searchHighlights.value.items
    if (items.length <= MAX_RENDERED_SEARCH_HIGHLIGHTS) return items
    const current = Math.max(0, options.searchCurrentIndex.value ?? 0)
    const half = Math.floor(MAX_RENDERED_SEARCH_HIGHLIGHTS / 2)
    const start = Math.min(
      Math.max(0, current - half),
      items.length - MAX_RENDERED_SEARCH_HIGHLIGHTS,
    )
    return items.slice(start, start + MAX_RENDERED_SEARCH_HIGHLIGHTS)
  })

  const visibleSearchHighlights = computed(() =>
    options.searchUiState.value.open && options.inputVisible.value
      ? renderedSearchHighlights.value
      : [],
  )

  const searchHighlightStyle = (range: {
    readonly start: number
    readonly end: number
  }) => {
    const source = options.editorValue.value
    const lineStart = source.lastIndexOf('\n', Math.max(0, range.start - 1)) + 1
    const line = source.slice(0, lineStart).split('\n').length - 1
    const column = range.start - lineStart
    const lineEnd = source.indexOf('\n', range.start)
    const visibleEnd = lineEnd < 0 ? range.end : Math.min(range.end, lineEnd)
    return {
      '--markdown-search-column': String(column),
      '--markdown-search-length': String(Math.max(1, visibleEnd - range.start)),
      '--markdown-search-line': String(line),
    }
  }

  const syncRenderedSearchHighlights = () => {
    const registry = cssHighlightRegistry()
    if (!registry) return
    registry.delete('markdown-search-match')
    registry.delete('markdown-search-current')
    if (!options.searchUiState.value.open || !options.searchMatches.value.length)
      return
    const candidate = options.previewRendererRef.value
    const root = candidate instanceof HTMLElement ? candidate : candidate?.$el
    if (!(root instanceof HTMLElement)) return
    const renderedItems = renderedSearchHighlights.value
    const needles = renderedItems.map(({ match }) =>
      options.editorValue.value.slice(match.range.start, match.range.end),
    )
    const ranges = renderedSearchRanges(root, needles)
    const HighlightCtor = (
      globalThis as typeof globalThis & {
        Highlight?: new (...ranges: Range[]) => unknown
      }
    ).Highlight
    const visibleRanges = ranges.filter((range): range is Range =>
      Boolean(range),
    )
    if (!HighlightCtor || !visibleRanges.length) return
    registry.set('markdown-search-match', new HighlightCtor(...visibleRanges))
    const current = renderedItems.findIndex(({ current }) => current)
    if (current >= 0 && ranges[current]) {
      registry.set(
        'markdown-search-current',
        new HighlightCtor(ranges[current]),
      )
    }
  }

  const clearRenderedSearchHighlights = () => {
    cssHighlightRegistry()?.delete('markdown-search-match')
    cssHighlightRegistry()?.delete('markdown-search-current')
  }

  watch(
    [
      options.searchMatches,
      options.searchCurrentIndex,
      () => options.searchUiState.value.open,
      options.currentMode,
    ],
    () => void nextTick(syncRenderedSearchHighlights),
    { flush: 'post' },
  )

  return {
    clearRenderedSearchHighlights,
    searchHighlightStyle,
    syncRenderedSearchHighlights,
    visibleSearchHighlights,
  }
}
