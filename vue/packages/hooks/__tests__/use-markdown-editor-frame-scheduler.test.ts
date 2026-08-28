import { describe, expect, it } from 'vitest'

import {
  createMarkdownEditorFrameScheduler,
  evaluateMarkdownEditorFrameSchedulerMutations,
} from '../use-markdown-editor-frame-scheduler'

const createManualFrames = () => {
  const queue: Array<{ callback: () => void; handle: number }> = []
  let seed = 0
  return {
    cancelFrame: (handle: number) => {
      const index = queue.findIndex((item) => item.handle === handle)
      if (index >= 0) queue.splice(index, 1)
    },
    pendingFrames: () => queue.length,
    requestFrame: (callback: () => void) => {
      seed += 1
      queue.push({ callback, handle: seed })
      return seed
    },
    runFrame: () => {
      const item = queue.shift()
      item?.callback()
    },
  }
}

describe('createMarkdownEditorFrameScheduler', () => {
  it('runs measure before mutate before post-paint inside one frame', () => {
    const frames = createManualFrames()
    const order: string[] = []
    const scheduler = createMarkdownEditorFrameScheduler({
      cancelFrame: frames.cancelFrame,
      requestFrame: frames.requestFrame,
    })

    scheduler.schedule({
      key: 'order',
      measure: () => order.push('measure'),
      mutate: () => order.push('mutate'),
      postPaint: () => order.push('post-paint'),
    })
    frames.runFrame()

    expect(order).toEqual(['measure', 'mutate', 'post-paint'])
    expect(scheduler.metrics().idle).toBe(true)
  })

  it('coalesces repeated keys into a single frame task', () => {
    const frames = createManualFrames()
    const scheduler = createMarkdownEditorFrameScheduler({
      cancelFrame: frames.cancelFrame,
      requestFrame: frames.requestFrame,
    })
    let runs = 0

    for (let index = 0; index < 16; index += 1) {
      scheduler.schedule({
        key: 'rapid-input',
        measure: () => {
          runs += 1
        },
      })
    }
    frames.runFrame()

    const metrics = scheduler.metrics()
    expect(runs).toBe(1)
    expect(metrics.coalescedTasks).toBe(15)
    expect(metrics.pendingTasks).toBe(0)
  })

  it('defers a measure requested during the mutate phase to the next frame', () => {
    const frames = createManualFrames()
    const scheduler = createMarkdownEditorFrameScheduler({
      cancelFrame: frames.cancelFrame,
      requestFrame: frames.requestFrame,
    })
    const order: string[] = []

    scheduler.schedule({
      key: 'writer',
      mutate: () => {
        order.push('mutate')
        scheduler.scheduleMeasure('late-read', () => order.push('measure'))
      },
    })
    frames.runFrame()

    expect(order).toEqual(['mutate'])
    expect(frames.pendingFrames()).toBe(1)
    const afterWrite = scheduler.metrics()
    expect(afterWrite.readAfterWriteViolations).toBe(1)

    frames.runFrame()
    expect(order).toEqual(['mutate', 'measure'])
    expect(scheduler.metrics().readAfterWriteViolations).toBe(1)
  })

  it('cancels guarded tasks before commit and counts them stale', () => {
    const frames = createManualFrames()
    const scheduler = createMarkdownEditorFrameScheduler({
      cancelFrame: frames.cancelFrame,
      requestFrame: frames.requestFrame,
    })
    let revision = 1
    let committed = 0

    scheduler.schedule({
      guard: () => revision === 1,
      key: 'anchor-restore',
      mutate: () => {
        committed += 1
      },
    })
    revision = 2
    frames.runFrame()

    expect(committed).toBe(0)
    expect(scheduler.metrics().staleTasks).toBe(1)
    expect(frames.pendingFrames()).toBe(0)
  })

  it('keeps no resident frame loop once the queue is empty', () => {
    const frames = createManualFrames()
    const scheduler = createMarkdownEditorFrameScheduler({
      cancelFrame: frames.cancelFrame,
      requestFrame: frames.requestFrame,
    })
    let framesRequested = 0

    scheduler.schedule({ key: 'one', mutate: () => undefined })
    framesRequested = frames.pendingFrames()
    frames.runFrame()

    expect(framesRequested).toBe(1)
    expect(frames.pendingFrames()).toBe(0)
    expect(scheduler.metrics().idle).toBe(true)
  })

  it('drops new keys beyond the queue budget instead of growing a backlog', () => {
    const frames = createManualFrames()
    const scheduler = createMarkdownEditorFrameScheduler({
      cancelFrame: frames.cancelFrame,
      maxQueuedTasks: 8,
      requestFrame: frames.requestFrame,
    })

    for (let index = 0; index < 20; index += 1) {
      scheduler.scheduleMutate(`task-${index}`, () => undefined)
    }

    const metrics = scheduler.metrics()
    expect(metrics.pendingTasks).toBe(8)
    expect(metrics.overflowDroppedTasks).toBe(12)
    frames.runFrame()
  })

  it('dispose cancels the pending frame and drops every task', () => {
    const frames = createManualFrames()
    const scheduler = createMarkdownEditorFrameScheduler({
      cancelFrame: frames.cancelFrame,
      requestFrame: frames.requestFrame,
    })
    let ran = 0

    scheduler.schedule({ key: 'pending', mutate: () => (ran += 1) })
    scheduler.dispose()
    frames.runFrame()

    expect(ran).toBe(0)
    expect(frames.pendingFrames()).toBe(0)
    expect(scheduler.metrics().pendingTasks).toBe(0)
  })

  it('reports frame metrics through onFrameEnd evidence sampling', () => {
    const frames = createManualFrames()
    const samples: number[] = []
    const scheduler = createMarkdownEditorFrameScheduler({
      cancelFrame: frames.cancelFrame,
      onFrameEnd: (metrics) => samples.push(metrics.frameId),
      requestFrame: frames.requestFrame,
    })

    scheduler.schedule({
      key: 'sampled',
      measure: () => undefined,
      mutate: () => undefined,
    })
    frames.runFrame()

    expect(samples).toEqual([1])
    const metrics = scheduler.metrics()
    expect(metrics.executed.measure).toBe(1)
    expect(metrics.executed.mutate).toBe(1)
    expect(metrics.durationMs.measure).toBeGreaterThanOrEqual(0)
    expect(metrics.durationMs.mutate).toBeGreaterThanOrEqual(0)
  })

  it('kills every frame-scheduler mutation fixture', () => {
    const evaluation = evaluateMarkdownEditorFrameSchedulerMutations()

    for (const mutation of evaluation.mutations) {
      expect(mutation).toMatchObject({
        accepted: false,
        kind: expect.any(String),
      })
    }
    expect(evaluation.mutations.map((item) => item.kind)).toEqual([
      'mutate-phase-measurement',
      'unbounded-input-backlog',
      'stale-commit',
      'unmount-residue',
      'permanent-frame-loop',
    ])
  })
})
