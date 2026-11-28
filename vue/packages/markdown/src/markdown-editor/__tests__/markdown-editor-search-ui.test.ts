import { nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import MarkdownEditor from '../src/markdown-editor.vue'


import {
  dispatchMarkdownSearchKeydown,
  evaluateMarkdownSearchUiMutations,
  executeMarkdownSearchSession,
  resolveMarkdownSearchHighlights,
  resolveMarkdownSearchNavigation,
  resolveMarkdownSearchUi,
  revealMarkdownSearchMatch,
} from '../src/markdown-editor-search-ui'
import type { MarkdownSearchMatch } from '../../../wasm/markdown-search-model'

const identity = Object.freeze({ epoch: 1, id: 'search-doc' })
const englishSearchCopy = Object.freeze({
  findAndReplaceAria: 'Find and replace in document',
  findAria: 'Find in document',
  noMatches: 'No matches',
  replaceWithAria: 'Replace with',
  results: (current: number, total: number) => `${current} of ${total}`,
  truncatedResults: (count: number) => `${count.toLocaleString()}+ matches`,
})

describe('markdown search UI and cross-mode highlight/reveal', () => {
  it('resolves compact search UI state and handles screen reader accessibility', () => {
    const closed = resolveMarkdownSearchUi(false, '', 0, {
      copy: englishSearchCopy,
    })
    expect(closed.open).toBe(false)
    expect(closed.compact).toBe(true)
    expect(closed.card).toBe(false)
    expect(closed.statusText).toBe('0 of 0')
    expect(closed.editorHeightUnchanged).toBe(true)
    expect(closed.contentWidthUnchanged).toBe(true)
    expect(closed.scrollContainerIdentity).toBe('body')

    const open = resolveMarkdownSearchUi(true, 'hello', 5, {
      currentIndex: 1,
      mode: 'plain-case',
      replaceOpen: true,
      replaceText: 'world',
      copy: englishSearchCopy,
    })
    expect(open.open).toBe(true)
    expect(open.query).toBe('hello')
    expect(open.hitCount).toBe(5)
    expect(open.currentIndex).toBe(1)
    expect(open.statusText).toBe('2 of 5')
    expect(open.matchCase).toBe(true)
    expect(open.replaceOpen).toBe(true)
    expect(open.replaceText).toBe('world')
    expect(open.aria.role).toBe('search')
    expect(open.aria.statusAriaLive).toBe('polite')

    const truncated = resolveMarkdownSearchUi(true, 'a', 10_000, {
      truncated: true,
      copy: englishSearchCopy,
    })
    expect(truncated.truncated).toBe(true)
    expect(truncated.statusText).toContain('10,000+ matches')

    const empty = resolveMarkdownSearchUi(true, 'nonexistent', 0, {
      copy: englishSearchCopy,
    })
    expect(empty.statusText).toBe('No matches')
  })

  it('dispatches keyboard shortcuts for search and replace', () => {
    expect(dispatchMarkdownSearchKeydown({ ctrlKey: true, key: 'f' })).toBe('open-find')
    expect(dispatchMarkdownSearchKeydown({ metaKey: true, key: 'f' })).toBe('open-find')
    expect(dispatchMarkdownSearchKeydown({ ctrlKey: true, key: 'h' })).toBe('open-replace')
    expect(dispatchMarkdownSearchKeydown({ metaKey: true, key: 'h' })).toBe('open-replace')
    expect(dispatchMarkdownSearchKeydown({ key: 'Escape' })).toBe('close')
    expect(dispatchMarkdownSearchKeydown({ key: 'Enter' })).toBe('next-match')
    expect(dispatchMarkdownSearchKeydown({ key: 'Enter', shiftKey: true })).toBe('prev-match')
    expect(
      dispatchMarkdownSearchKeydown({ key: 'Enter', targetIsReplaceInput: true }),
    ).toBe('replace-current')
    expect(dispatchMarkdownSearchKeydown({ altKey: true, key: 'r' })).toBe('replace-current')
    expect(dispatchMarkdownSearchKeydown({ altKey: true, key: 'a' })).toBe('replace-all')
    expect(dispatchMarkdownSearchKeydown({ key: 'x' })).toBeNull()
  })

  it('navigates matches cyclically forward and backward', () => {
    const matches: MarkdownSearchMatch[] = [
      { documentEpoch: 1, documentId: 'search-doc', queryVersion: 1, range: { start: 0, end: 3 }, revision: 1 },
      { documentEpoch: 1, documentId: 'search-doc', queryVersion: 1, range: { start: 10, end: 13 }, revision: 1 },
      { documentEpoch: 1, documentId: 'search-doc', queryVersion: 1, range: { start: 20, end: 23 }, revision: 1 },
    ]

    expect(resolveMarkdownSearchNavigation([], null, 'next')).toEqual({
      match: null,
      nextIndex: -1,
    })

    const first = resolveMarkdownSearchNavigation(matches, null, 'next')
    expect(first.nextIndex).toBe(0)
    expect(first.match?.range.start).toBe(0)

    const second = resolveMarkdownSearchNavigation(matches, 0, 'next')
    expect(second.nextIndex).toBe(1)

    const third = resolveMarkdownSearchNavigation(matches, 1, 'next')
    expect(third.nextIndex).toBe(2)

    // Wrap around to start
    const wrapStart = resolveMarkdownSearchNavigation(matches, 2, 'next')
    expect(wrapStart.nextIndex).toBe(0)

    // Previous from start wraps to end
    const wrapEnd = resolveMarkdownSearchNavigation(matches, 0, 'previous')
    expect(wrapEnd.nextIndex).toBe(2)

    const backOne = resolveMarkdownSearchNavigation(matches, 2, 'previous')
    expect(backOne.nextIndex).toBe(1)
  })

  it('reveals matches across modes and respects scroll ownership', () => {
    const source = 'Heading 1\nSome match text here.\nAnother line.\n'
    const match: MarkdownSearchMatch = {
      documentEpoch: 1,
      documentId: 'search-doc',
      queryVersion: 1,
      range: { start: 15, end: 20 },
      revision: 1,
    }

    // Normal reveal succeeds
    const revealed = revealMarkdownSearchMatch({
      currentMode: 'live',
      documentIdentity: identity,
      match,
      revision: 1,
      source,
    })
    expect(revealed.status).toBe('success')
    expect(revealed.targetOffset).toBe(15)
    expect(revealed.scrollTarget).toEqual({ start: 15, end: 20 })
    expect(revealed.suspended).toBe(false)
    expect(revealed.scrollStealing).toBe(false)

    // Manual scroll suspends viewport stealing
    const manualScroll = revealMarkdownSearchMatch({
      currentMode: 'source',
      documentIdentity: identity,
      match,
      navigationOwner: 'manual-scroll',
      revision: 1,
      source,
    })
    expect(manualScroll.status).toBe('success')
    expect(manualScroll.suspended).toBe(true)
    expect(manualScroll.scrollStealing).toBe(false)

    // Selection drag suspends viewport stealing
    const dragScroll = revealMarkdownSearchMatch({
      currentMode: 'split',
      documentIdentity: identity,
      match,
      navigationOwner: 'selection-drag',
      revision: 1,
      source,
    })
    expect(dragScroll.suspended).toBe(true)

    // Stale match rejects
    const staleRevision = revealMarkdownSearchMatch({
      documentIdentity: identity,
      match: { ...match, revision: 2 },
      revision: 1,
      source,
    })
    expect(staleRevision.status).toBe('stale')

    const staleDoc = revealMarkdownSearchMatch({
      documentIdentity: { epoch: 1, id: 'other-doc' },
      match,
      revision: 1,
      source,
    })
    expect(staleDoc.status).toBe('stale')

    // Deleted / out of bounds match
    const deleted = revealMarkdownSearchMatch({
      documentIdentity: identity,
      match: { ...match, range: { start: 999, end: 1005 } },
      revision: 1,
      source,
    })
    expect(deleted.status).toBe('deleted')

    // Zero-length match
    const notFound = revealMarkdownSearchMatch({
      documentIdentity: identity,
      match: { ...match, range: { start: 5, end: 5 } },
      revision: 1,
      source,
    })
    expect(notFound.status).toBe('not-found')
  })

  it('computes cross-mode highlights without DOM mutation', () => {
    const source = 'abc def abc ghi'
    const matches: MarkdownSearchMatch[] = [
      { documentEpoch: 1, documentId: 'search-doc', queryVersion: 1, range: { start: 0, end: 3 }, revision: 1 },
      { documentEpoch: 1, documentId: 'search-doc', queryVersion: 1, range: { start: 8, end: 11 }, revision: 1 },
    ]

    const highlights = resolveMarkdownSearchHighlights({
      currentIndex: 1,
      matches,
      mode: 'live',
      source,
    })

    expect(highlights.domHighlight).toBe(false)
    expect(highlights.sourceUnchanged).toBe(true)
    expect(highlights.lineWrapUnchanged).toBe(true)
    expect(highlights.layoutWidthUnchanged).toBe(true)
    expect(highlights.readingOrderUnchanged).toBe(true)
    expect(highlights.items).toHaveLength(2)
    expect(highlights.items[0]?.current).toBe(false)
    expect(highlights.items[1]?.current).toBe(true)
    expect(highlights.items[1]?.mode).toBe('live')
  })

  it('executes search matrix: Unicode, regex, rapid query, cancellation, 10000 matches', () => {
    // Unicode: accents, emoji, RTL
    const unicodeSource = 'café ☕ שלום café'
    const unicodeResult = executeMarkdownSearchSession({
      documentEpoch: 1,
      documentId: 'search-doc',
      queryText: 'café',
      revision: 1,
      source: unicodeSource,
    })
    expect(unicodeResult.execution.status).toBe('complete')
    expect(unicodeResult.execution.matches).toHaveLength(2)

    // Emoji search
    const emojiResult = executeMarkdownSearchSession({
      documentEpoch: 1,
      documentId: 'search-doc',
      queryText: '☕',
      revision: 1,
      source: unicodeSource,
    })
    expect(emojiResult.execution.matches).toHaveLength(1)
    expect(emojiResult.execution.matches[0]?.range.start).toBe(5)

    // Regex search
    const regexResult = executeMarkdownSearchSession({
      documentEpoch: 1,
      documentId: 'search-doc',
      mode: 'regex',
      queryText: 'c[a-z]+é',
      revision: 1,
      source: unicodeSource,
    })
    expect(regexResult.execution.matches).toHaveLength(2)

    // Rapid query cancellation
    const firstSession = executeMarkdownSearchSession({
      documentEpoch: 1,
      documentId: 'search-doc',
      queryText: 'café',
      revision: 1,
      source: unicodeSource,
    })
    const secondSession = executeMarkdownSearchSession({
      documentEpoch: 1,
      documentId: 'search-doc',
      previousTask: firstSession.task,
      queryText: '☕',
      revision: 1,
      source: unicodeSource,
    })
    expect(firstSession.task.cancelled).toBe(true)
    expect(secondSession.task.cancelled).toBe(false)

    // 10,000 matches with truncation
    const largeSource = 'hit '.repeat(10_500)
    const largeResult = executeMarkdownSearchSession({
      budget: {
        maxConcurrent: 1,
        maxMatches: 10_000,
        maxMs: 500,
        maxRegexLength: 256,
        maxSourceBytes: 500_000,
      },
      documentEpoch: 1,
      documentId: 'search-doc',
      queryText: 'hit',
      revision: 1,
      source: largeSource,
    })
    expect(largeResult.execution.truncated).toBe(true)
    expect(largeResult.execution.total).toBeNull()
    expect(largeResult.execution.matches.length).toBeLessThanOrEqual(10_000)
  })


  it('mounts search bar in MarkdownEditor component and runs find/replace workflow', async () => {
    const wrapper = mount(MarkdownEditor, {
      props: {
        localeText: { search: englishSearchCopy },
        modelValue: 'apple banana apple cherry apple',
      },
    })

    const vm = wrapper.vm as any
    expect(wrapper.find('[role="search"]').exists()).toBe(false)

    // Open search
    vm.openSearch(false)
    await nextTick()
    expect(wrapper.find('[role="search"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="markdown-search-replace"]').exists()).toBe(false)

    // Input query
    const queryInput = wrapper.find<HTMLInputElement>('[data-testid="markdown-search-query"]')
    await queryInput.setValue('apple')
    expect(vm.searchUi.hitCount).toBe(3)
    expect(wrapper.find('[data-testid="markdown-search-count"]').text()).toBe('1 of 3')

    // Navigate next
    vm.searchNavigate('next')
    await nextTick()
    expect(vm.searchUi.currentIndex).toBe(1)
    expect(wrapper.find('[data-testid="markdown-search-count"]').text()).toBe('2 of 3')

    // Open replace
    vm.openSearch(true)
    await nextTick()
    expect(wrapper.find('[data-testid="markdown-search-replace"]').exists()).toBe(true)

    // Set replace text and replace current
    const replaceInput = wrapper.find<HTMLInputElement>('[data-testid="markdown-search-replace"]')
    await replaceInput.setValue('orange')
    vm.searchReplaceCurrent()
    await nextTick()

    // Value should have updated
    expect(wrapper.emitted('update:modelValue')).toBeTruthy()

    // Close search
    vm.closeSearch()
    await nextTick()
    expect(wrapper.find('[role="search"]').exists()).toBe(false)
  })

  it('keeps find available while readonly and keeps replacement blocked', async () => {
    const wrapper = mount(MarkdownEditor, {
      props: {
        modelValue: 'readonly alpha',
        readonly: true,
      },
    })
    await wrapper.find('textarea').trigger('keydown', {
      ctrlKey: true,
      key: 'f',
    })
    await nextTick()
    expect(wrapper.find('[role="search"]').exists()).toBe(true)

    const vm = wrapper.vm as any
    vm.openSearch(true)
    await nextTick()
    await wrapper
      .find<HTMLInputElement>('[data-testid="markdown-search-query"]')
      .setValue('alpha')
    expect(
      wrapper
        .find<HTMLButtonElement>(
          '[data-testid="markdown-search-replace-current"]',
        )
        .element.disabled,
    ).toBe(true)
  })

  it('refreshes production highlights when the document changes', async () => {
    const wrapper = mount(MarkdownEditor, {
      props: { modelValue: 'alpha beta alpha' },
    })
    const vm = wrapper.vm as any
    vm.openSearch()
    await nextTick()
    await wrapper
      .find<HTMLInputElement>('[data-testid="markdown-search-query"]')
      .setValue('alpha')
    await nextTick()

    expect(wrapper.findAll('.el-markdown-editor__search-highlight')).toHaveLength(2)
    expect(vm.searchUi.hitCount).toBe(2)

    await wrapper.setProps({ modelValue: 'beta alpha' })
    await nextTick()
    expect(wrapper.findAll('.el-markdown-editor__search-highlight')).toHaveLength(1)
    expect(vm.searchUi.hitCount).toBe(1)
    expect(vm.searchNavigate('next')).toBe('success')
  })

  it('kills DOM highlight, layout shift, scroll stealing, and stale result mutations', () => {
    const report = evaluateMarkdownSearchUiMutations()
    expect(report.mutations.length).toBe(4)
    for (const mutation of report.mutations) {
      expect(mutation.accepted).toBe(false)
      expect(mutation.equivalent).toBe(false)
    }
  })
})
