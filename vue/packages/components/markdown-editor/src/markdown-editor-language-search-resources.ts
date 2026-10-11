import {
  cancelMarkdownSearchTask,
  type MarkdownSearchTask,
} from '../../../wasm/markdown-search-worker'
import { executeMarkdownSearchSession } from './markdown-editor-search-ui'
import type {
  MarkdownEditorSessionResourceInspection,
  MarkdownEditorSessionResourceParticipant,
} from './markdown-editor-session-resources'

type SearchInput = Omit<
  Parameters<typeof executeMarkdownSearchSession>[0],
  'previousTask' | 'onTaskCreated'
>
type SearchResult = ReturnType<typeof executeMarkdownSearchSession>

/** Private resource custody for the existing Web language controller. No scheduler. */
export const createMarkdownLanguageSearchResources = (language: {
  readonly invalidateLanguageSession: () => void
  readonly isComposing: () => boolean
  readonly languageMemoryUnits: () => number
  readonly setPausedAttributes: () => void
}) => {
  let ownsSearch = false
  let paused = false
  let epoch = 0
  let sequence = 0
  let running = false
  let task: MarkdownSearchTask | null = null
  let result: SearchResult | null = null

  const requireOwnership = () => {
    if (!ownsSearch)
      throw new Error('editor-session-language-search-owner-unbound')
  }
  const cancelSearch = () => {
    epoch += 1
    if (task) cancelMarkdownSearchTask(task)
    task = null
    result = null
  }
  const inspect = (): MarkdownEditorSessionResourceInspection => {
    requireOwnership()
    return Object.freeze({
      ownerRef: 'language-search',
      paused,
      // Browser native state and cross-instance controller hydration have no
      // checkpoint/restore owner. A quiescent search is not recovery evidence.
      recoverable: false,
      retainedListeners: 0,
      usage: Object.freeze({
        editorInstances: 0,
        renderers: 0,
        observers: 0,
        timers: 0,
        backgroundTasks: Number(running),
        networkRequests: 0,
        // Logical retained records plus 64 KiB source/query payload units.
        // Projection/map references count once; their contents belong elsewhere.
        memoryUnits:
          language.languageMemoryUnits() +
          Number(task !== null) +
          (task ? Math.ceil((task.query.length * 2) / 65_536) : 0) +
          (result ? 1 + result.execution.matches.length : 0),
      }),
    })
  }
  const participant: MarkdownEditorSessionResourceParticipant = Object.freeze({
    ownerRef: 'language-search',
    inspect,
    pause() {
      requireOwnership()
      if (running || language.isComposing()) {
        throw new Error('editor-session-language-search-running')
      }
      cancelSearch()
      language.invalidateLanguageSession()
      paused = true
      language.setPausedAttributes()
      return inspect()
    },
    resume() {
      requireOwnership()
      if (language.isComposing())
        throw new Error('editor-session-language-search-running')
      // No cancelled result/session is replayed. The caller may issue a fresh
      // current-document search and explicitly re-arm a native replacement.
      paused = false
      language.setPausedAttributes()
      return inspect()
    },
    dispose(_snapshotRef: string) {
      throw new Error(
        'editor-session-language-search-checkpoint-not-recoverable',
      )
    },
  })

  return Object.freeze({
    get paused() {
      return paused
    },
    adoptSearchTask(previousTask: MarkdownSearchTask | null) {
      if (ownsSearch)
        throw new Error('editor-session-language-search-owner-already-bound')
      if (previousTask) cancelMarkdownSearchTask(previousTask)
      ownsSearch = true
      return participant
    },
    cancelSearch,
    executeSearch(input: SearchInput): SearchResult {
      requireOwnership()
      if (paused) throw new Error('editor-session-language-search-paused')
      if (running) throw new Error('editor-session-language-search-reentrant')
      cancelSearch()
      const requestEpoch = epoch
      running = true
      try {
        const next = executeMarkdownSearchSession({
          ...input,
          onTaskCreated(created) {
            task = created
            if (paused || epoch !== requestEpoch)
              cancelMarkdownSearchTask(created)
          },
          requestId:
            input.requestId ?? `language-search:${requestEpoch}:${++sequence}`,
        })
        if (paused || epoch !== requestEpoch || next.task.cancelled) {
          cancelMarkdownSearchTask(next.task)
          throw new Error('editor-session-language-search-stale-request')
        }
        task = next.task
        result = next
        return next
      } catch (error) {
        cancelSearch()
        throw error
      } finally {
        running = false
      }
    },
  })
}
