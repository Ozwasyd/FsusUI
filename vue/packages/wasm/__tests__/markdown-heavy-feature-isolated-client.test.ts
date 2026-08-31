import { describe, expect, it, vi } from 'vitest'
import {
  createMarkdownHeavyFeatureIsolatedRender,
  scheduleMarkdownHeavyFeatureFrameContinue,
} from '../markdown-heavy-feature-isolated-client'
import {
  MARKDOWN_HEAVY_FEATURE_FRAME_SCOPE,
  validateMarkdownHeavyFeatureFrameContinueMessage,
  validateMarkdownHeavyFeatureIsolatedRenderOutput,
  validateMarkdownHeavyFeatureIsolatedRenderRequest,
} from '../markdown-heavy-feature-resource'

const validRequest = Object.freeze({
  kind: 'code-highlight' as const,
  language: 'typescript',
  lifecycleKey: 'document:1:node:code-highlight',
  source: 'const value: number = 1',
  theme: 'light' as const,
  tokens: Object.freeze({ background: '#fff' }),
})

describe('markdown heavy feature isolated client', () => {
  it('resolves only after the shared scheduler continues a started frame', async () => {
    class TestMessagePort {
      closed = false
      onmessage: ((event: MessageEvent) => void) | null = null
      peer: TestMessagePort | null = null

      close() {
        this.closed = true
      }

      postMessage(data: unknown) {
        if (this.closed || !this.peer || this.peer.closed) return
        queueMicrotask(() =>
          this.peer?.onmessage?.(new MessageEvent('message', { data })),
        )
      }
    }

    class TestMessageChannel {
      port1 = new TestMessagePort()
      port2 = new TestMessagePort()

      constructor() {
        this.port1.peer = this.port2
        this.port2.peer = this.port1
      }
    }

    vi.stubGlobal('MessageChannel', TestMessageChannel)
    const scheduled = new Map<
      string,
      { key: string; mutate?: () => void; postPaint?: () => void }
    >()
    const scheduler = {
      cancel: vi.fn((key: string) => {
        scheduled.delete(key)
      }),
      schedule: vi.fn(
        (task: {
          key: string
          mutate?: () => void
          postPaint?: () => void
        }) => {
          scheduled.set(task.key, task)
          return true
        },
      ),
    }
    const scheduleContinue = vi.fn(
      (key: string, run: () => void, drop: () => void) => {
        expect(key).toBe(
          'markdown-heavy-frame-continue:document:1:node:code-highlight',
        )
        return scheduleMarkdownHeavyFeatureFrameContinue(
          scheduler,
          key,
          run,
          drop,
        )
      },
    )
    const handle = createMarkdownHeavyFeatureIsolatedRender(
      validRequest,
      (moduleUrl) => moduleUrl.toString(),
      scheduleContinue,
    )
    let settled = false
    void handle.promise.then(
      () => {
        settled = true
      },
      () => {
        settled = true
      },
    )
    const frame = document.querySelector('iframe')!
    expect(frame.dataset.fsusMarkdownHeavyPending).toBe('code-highlight')
    expect(frame.dataset.fsusMarkdownHeavyNode).toBe(validRequest.lifecycleKey)
    expect(frame.dataset.fsusMarkdownHeavyWork).toBeUndefined()
    const capability =
      frame.contentDocument!.documentElement.dataset
        .fsusMarkdownFrameCapability!
    const framePostMessage = vi
      .spyOn(frame.contentWindow!, 'postMessage')
      .mockImplementation((message, targetOrigin, transfer?) => {
        expect(targetOrigin).toBe(window.location.origin)
        expect(message).toMatchObject({
          capability,
          request: validRequest,
          scope: MARKDOWN_HEAVY_FEATURE_FRAME_SCOPE,
          type: 'render',
        })
        const framePort = transfer?.[0] as unknown as TestMessagePort
        framePort.onmessage = (event) => {
          expect(
            validateMarkdownHeavyFeatureFrameContinueMessage(
              event.data,
              capability,
            ),
          ).toBe(true)
          framePort.postMessage({
            capability,
            output: {
              kind: 'code-highlight',
              payload: '<pre><code>resolved</code></pre>',
            },
            scope: MARKDOWN_HEAVY_FEATURE_FRAME_SCOPE,
            type: 'resolve',
          })
        }
        framePort.postMessage({
          capability,
          scope: MARKDOWN_HEAVY_FEATURE_FRAME_SCOPE,
          type: 'started',
        })
      })

    window.dispatchEvent(
      new MessageEvent('message', {
        data: {
          capability,
          scope: MARKDOWN_HEAVY_FEATURE_FRAME_SCOPE,
          type: 'ready',
        },
        origin: window.location.origin,
        source: frame.contentWindow,
      }),
    )
    await vi.waitFor(() => expect(scheduleContinue).toHaveBeenCalledOnce())
    expect(frame.dataset.fsusMarkdownHeavyWork).toBe('code-highlight')
    expect(settled).toBe(false)

    const gate = scheduled.get(
      'markdown-heavy-frame-continue:document:1:node:code-highlight:gate',
    )
    expect(gate?.postPaint).toBeTypeOf('function')
    gate?.postPaint?.()
    expect(settled).toBe(false)
    const dispatch = scheduled.get(
      'markdown-heavy-frame-continue:document:1:node:code-highlight:dispatch',
    )
    expect(dispatch?.mutate).toBeTypeOf('function')
    dispatch?.mutate?.()
    await expect(handle.promise).resolves.toEqual({
      kind: 'code-highlight',
      payload: '<pre><code>resolved</code></pre>',
    })
    expect(frame.isConnected).toBe(false)
    expect(handle.resources()).toEqual({
      listeners: 0,
      observers: 0,
      runtimes: 0,
      tasks: 0,
    })
    expect(scheduler.cancel).toHaveBeenCalledWith(
      'markdown-heavy-frame-continue:document:1:node:code-highlight:gate',
    )
    expect(scheduler.cancel).toHaveBeenCalledWith(
      'markdown-heavy-frame-continue:document:1:node:code-highlight:dispatch',
    )
    framePostMessage.mockRestore()
    vi.unstubAllGlobals()
  })

  it('cancels continuation before the gate and between scheduler stages', () => {
    const createScheduler = () => {
      const scheduled = new Map<
        string,
        { key: string; mutate?: () => void; postPaint?: () => void }
      >()
      return {
        authority: {
          cancel: (key: string) => scheduled.delete(key),
          schedule: (task: {
            key: string
            mutate?: () => void
            postPaint?: () => void
          }) => {
            scheduled.set(task.key, task)
            return true
          },
        },
        scheduled,
      }
    }
    const run = vi.fn()
    const drop = vi.fn()

    const beforeGate = createScheduler()
    const cancelBeforeGate = scheduleMarkdownHeavyFeatureFrameContinue(
      beforeGate.authority,
      'before-gate',
      run,
      drop,
    )!
    cancelBeforeGate()
    expect(beforeGate.scheduled.size).toBe(0)

    const betweenStages = createScheduler()
    const cancelBetweenStages = scheduleMarkdownHeavyFeatureFrameContinue(
      betweenStages.authority,
      'between-stages',
      run,
      drop,
    )!
    betweenStages.scheduled.get('between-stages:gate')?.postPaint?.()
    expect(betweenStages.scheduled.has('between-stages:dispatch')).toBe(true)
    cancelBetweenStages()
    expect(betweenStages.scheduled.size).toBe(0)
    expect(run).not.toHaveBeenCalled()
    expect(drop).not.toHaveBeenCalled()
  })

  it('fails closed when the second scheduler stage is rejected', () => {
    const scheduled = new Map<
      string,
      { key: string; mutate?: () => void; postPaint?: () => void }
    >()
    const run = vi.fn()
    const drop = vi.fn()
    const scheduler = {
      cancel: (key: string) => scheduled.delete(key),
      schedule: (task: {
        key: string
        mutate?: () => void
        postPaint?: () => void
      }) => {
        if (task.key.endsWith(':dispatch')) return false
        scheduled.set(task.key, task)
        return true
      },
    }
    expect(
      scheduleMarkdownHeavyFeatureFrameContinue(
        scheduler,
        'second-stage-rejection',
        run,
        drop,
      ),
    ).toBeTypeOf('function')
    scheduled.get('second-stage-rejection:gate')?.postPaint?.()
    expect(run).not.toHaveBeenCalled()
    expect(drop).toHaveBeenCalledOnce()
    expect(scheduled.size).toBe(0)
  })

  it('fails closed for malformed, wrong-kind, and oversized continue messages', () => {
    const capability = 'a'.repeat(64)
    expect(
      validateMarkdownHeavyFeatureFrameContinueMessage(
        {
          capability,
          scope: MARKDOWN_HEAVY_FEATURE_FRAME_SCOPE,
          type: 'continue',
        },
        capability,
      ),
    ).toBe(true)
    expect(
      validateMarkdownHeavyFeatureFrameContinueMessage(null, capability),
    ).toBe(false)
    expect(
      validateMarkdownHeavyFeatureFrameContinueMessage(
        {
          capability,
          scope: MARKDOWN_HEAVY_FEATURE_FRAME_SCOPE,
          type: 'resolve',
        },
        capability,
      ),
    ).toBe(false)
    expect(
      validateMarkdownHeavyFeatureFrameContinueMessage(
        {
          capability: `${capability}extra`,
          scope: MARKDOWN_HEAVY_FEATURE_FRAME_SCOPE,
          type: 'continue',
        },
        capability,
      ),
    ).toBe(false)
    expect(
      validateMarkdownHeavyFeatureFrameContinueMessage(
        {
          capability,
          extra: 'unexpected',
          scope: MARKDOWN_HEAVY_FEATURE_FRAME_SCOPE,
          type: 'continue',
        },
        capability,
      ),
    ).toBe(false)
  })

  it('copies and bounds requests before sending source into the frame realm', () => {
    const request =
      validateMarkdownHeavyFeatureIsolatedRenderRequest(validRequest)
    expect(request).toEqual(validRequest)
    expect(request).not.toBe(validRequest)
    expect(request?.tokens).not.toBe(validRequest.tokens)
    expect(Object.isFrozen(request)).toBe(true)
    expect(Object.isFrozen(request?.tokens)).toBe(true)

    expect(
      validateMarkdownHeavyFeatureIsolatedRenderRequest({
        ...validRequest,
        kind: 'html',
      }),
    ).toBeNull()
    expect(
      validateMarkdownHeavyFeatureIsolatedRenderRequest({
        ...validRequest,
        source: 'x'.repeat(16 * 1024 * 1024 + 1),
      }),
    ).toBeNull()
    expect(
      validateMarkdownHeavyFeatureIsolatedRenderRequest({
        ...validRequest,
        tokens: { background: 42 },
      }),
    ).toBeNull()
  })

  it('rejects malformed, wrong-kind, and oversized frame output', () => {
    expect(
      validateMarkdownHeavyFeatureIsolatedRenderOutput(
        { kind: 'latex', payload: '<span />' },
        'code-highlight',
      ),
    ).toBeNull()
    expect(
      validateMarkdownHeavyFeatureIsolatedRenderOutput(
        { kind: 'mermaid', payload: '<svg />' },
        'mermaid',
      ),
    ).toBeNull()
    expect(
      validateMarkdownHeavyFeatureIsolatedRenderOutput(
        {
          kind: 'code-highlight',
          payload: 'x'.repeat(128 * 1024 * 1024 + 1),
        },
        'code-highlight',
      ),
    ).toBeNull()
  })

  it('uses the consumer Trusted Script URL factory and ignores forged ready messages', async () => {
    const trustedScriptUrl = Object.freeze({ trusted: true })
    const trustedScriptUrlFactory = vi.fn((_moduleUrl: URL) => trustedScriptUrl)
    const sourceSetter = vi
      .spyOn(HTMLScriptElement.prototype, 'src', 'set')
      .mockImplementation(function (value: unknown) {
        expect(value).toBe(trustedScriptUrl)
      })
    const handle = createMarkdownHeavyFeatureIsolatedRender(
      validRequest,
      trustedScriptUrlFactory,
    )
    const rejection = handle.promise.catch((error: unknown) => error)
    const frame = document.querySelector('iframe')!
    const capability =
      frame.contentDocument!.documentElement.dataset.fsusMarkdownFrameCapability

    window.dispatchEvent(
      new MessageEvent('message', {
        data: {
          capability,
          scope: 'fsus-markdown-heavy-feature-frame@1',
          type: 'ready',
        },
        origin: window.location.origin,
        source: window,
      }),
    )
    expect(handle.resources()).toEqual({
      listeners: 2,
      observers: 0,
      runtimes: 1,
      tasks: 1,
    })

    handle.teardown()
    await expect(rejection).resolves.toMatchObject({ name: 'AbortError' })
    expect(trustedScriptUrlFactory).toHaveBeenCalledOnce()
    expect(trustedScriptUrlFactory.mock.calls[0]?.[0]).toBeInstanceOf(URL)
    expect(frame.isConnected).toBe(false)
    sourceSetter.mockRestore()
  })
})
