import { onBeforeUnmount, unref } from 'vue'
import type { MaybeRef } from 'vue'
import { defaultRenderPipelineConfig } from './config'
import { isRenderPipelineLowPower } from './hardware-profile'
import type {
  FsusRenderSchedulerPriority,
  FsusRenderSchedulerTaskOptions,
  FsusScheduledWork,
} from './types'

export const useFsusRenderScheduler = (
  budget: MaybeRef<{ frameMs?: number } | undefined> = undefined,
) => {
  type SchedulerEntry = {
    cleanup: (() => void) | null
    key?: string
    priority: FsusRenderSchedulerPriority
    task: () => void | FsusScheduledWork
  }

  const queues: Record<FsusRenderSchedulerPriority, Set<SchedulerEntry>> = {
    background: new Set(),
    'user-blocking': new Set(),
    visible: new Set(),
  }
  let cancelFlush: (() => void) | null = null
  let scheduledFlushPriority: FsusRenderSchedulerPriority | null = null
  const keyedEntries = new Map<string, SchedulerEntry>()

  const priorities: FsusRenderSchedulerPriority[] = [
    'user-blocking',
    'visible',
    'background',
  ]
  const priorityRank: Record<FsusRenderSchedulerPriority, number> = {
    background: 0,
    visible: 1,
    'user-blocking': 2,
  }
  const postTaskPriorityMap: Record<FsusRenderSchedulerPriority, string> = {
    background: 'background',
    visible: 'user-visible',
    'user-blocking': 'user-blocking',
  }

  const hasPending = () =>
    priorities.some((priority) => queues[priority].size > 0)

  const getNextEntry = () => {
    for (const priority of priorities) {
      const entry = queues[priority].values().next().value
      if (entry) return entry
    }
    return null
  }

  const getHighestPendingPriority = () =>
    priorities.find((priority) => queues[priority].size > 0) ?? 'background'

  const removeEntry = (entry: SchedulerEntry) => {
    queues[entry.priority].delete(entry)
    if (entry.key && keyedEntries.get(entry.key) === entry) {
      keyedEntries.delete(entry.key)
    }
    entry.cleanup?.()
    entry.cleanup = null
  }

  const flush = () => {
    cancelFlush = null
    scheduledFlushPriority = null
    const startedAt =
      typeof performance !== 'undefined' ? performance.now() : Date.now()
    const frameMs =
      unref(budget)?.frameMs ?? defaultRenderPipelineConfig.budget.frameMs
    const effectiveFrameMs =
      typeof document !== 'undefined' && document.visibilityState === 'hidden'
        ? Math.min(2, frameMs)
        : isRenderPipelineLowPower()
          ? Math.min(3, frameMs)
          : frameMs

    let entry = getNextEntry()
    let ranBackgroundChunk = false
    while (entry) {
      queues[entry.priority].delete(entry)
      const result = entry.task()
      const continuation =
        result && typeof result === 'object' && result.done === false
          ? result.continuation
          : null
      if (continuation) {
        entry.task = continuation
        queues[entry.priority].add(entry)
      } else {
        removeEntry(entry)
      }

      if (entry.priority === 'background') ranBackgroundChunk = true

      const now =
        typeof performance !== 'undefined' ? performance.now() : Date.now()
      if (
        hasPending() &&
        (now - startedAt >= effectiveFrameMs || ranBackgroundChunk)
      ) {
        requestFlush()
        return
      }
      entry = getNextEntry()
    }
  }

  const requestFlush = () => {
    const flushPriority = getHighestPendingPriority()
    if (cancelFlush) {
      if (
        scheduledFlushPriority &&
        priorityRank[flushPriority] <= priorityRank[scheduledFlushPriority]
      ) {
        return
      }
      cancelFlush()
      cancelFlush = null
    }
    scheduledFlushPriority = flushPriority

    const scheduler = (
      globalThis as {
        scheduler?: {
          postTask?: (
            callback: () => void,
            options?: { priority?: string; signal?: AbortSignal },
          ) => Promise<unknown>
        }
      }
    ).scheduler

    if (typeof scheduler?.postTask === 'function') {
      const flushController = new AbortController()
      cancelFlush = () => {
        flushController.abort()
        scheduledFlushPriority = null
      }
      void scheduler
        .postTask(
          () => {
            if (!flushController.signal.aborted) flush()
          },
          {
            priority: postTaskPriorityMap[flushPriority],
            signal: flushController.signal,
          },
        )
        .catch(() => {
          if (!flushController.signal.aborted) flush()
        })
      return
    }

    if (
      queues.background.size > 0 &&
      queues['user-blocking'].size === 0 &&
      queues.visible.size === 0 &&
      typeof requestIdleCallback === 'function'
    ) {
      const idle = requestIdleCallback(() => flush())
      cancelFlush = () => {
        scheduledFlushPriority = null
        cancelIdleCallback(idle)
      }
      return
    }

    if (typeof requestAnimationFrame === 'function') {
      const frame = requestAnimationFrame(flush)
      cancelFlush = () => {
        scheduledFlushPriority = null
        cancelAnimationFrame(frame)
      }
      return
    }

    const timeout = setTimeout(flush, 0)
    cancelFlush = () => {
      scheduledFlushPriority = null
      clearTimeout(timeout)
    }
  }

  const schedule = (
    task: () => void | FsusScheduledWork,
    options: FsusRenderSchedulerTaskOptions = {},
  ) => {
    const priority = options.priority ?? 'visible'
    if (options.signal?.aborted) return () => undefined

    const entry: SchedulerEntry = {
      cleanup: null,
      key: options.key,
      priority,
      task,
    }

    const cancel = () => removeEntry(entry)
    if (options.signal) {
      options.signal.addEventListener('abort', cancel, { once: true })
      entry.cleanup = () => options.signal?.removeEventListener('abort', cancel)
    }

    if (entry.key) {
      const previous = keyedEntries.get(entry.key)
      if (previous) removeEntry(previous)
      keyedEntries.set(entry.key, entry)
    }
    queues[priority].add(entry)
    requestFlush()
    return cancel
  }

  const cancel = () => {
    cancelFlush?.()
    cancelFlush = null
    for (const priority of priorities) {
      for (const entry of queues[priority]) {
        removeEntry(entry)
      }
    }
  }

  onBeforeUnmount(cancel)

  return {
    cancel,
    schedule,
  }
}
