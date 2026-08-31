import { describe, expect, it, vi } from 'vitest'
import { createMarkdownHeavyFeatureIsolatedRender } from '../markdown-heavy-feature-isolated-client'
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
