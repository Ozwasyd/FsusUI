import { mount } from '@vue/test-utils'
import { describe, expect, test, vi } from 'vitest'
import { nextTick } from 'vue'
import {
  FsusLocalizationChallenge,
  FsusMicroInteractionChallenge,
  FsusPerceptionChallenge,
  FsusTextTaskChallenge,
} from '..'

import type {
  PerceptionChallengeAssignment,
  PerceptionChallengeSubmitPayload,
} from '..'

const flushPromises = async () => {
  await Promise.resolve()
  await Promise.resolve()
  await nextTick()
}

describe('perception challenge primitives', () => {
  test('renders host loading, error retry, and expired proof states', async () => {
    const retry = vi.fn()
    const refresh = vi.fn()
    const wrapper = mount(FsusPerceptionChallenge, {
      props: {
        kind: 'text-task',
        state: 'loading',
        title: 'Check task',
        onRefresh: refresh,
        onRetry: retry,
      },
    })

    expect(wrapper.classes()).toContain('is-loading')
    expect(wrapper.attributes('aria-busy')).toBe('true')
    expect(
      wrapper.find('[data-test="perception-challenge-loading"]').text(),
    ).toContain('Preparing challenge')

    await wrapper.setProps({
      state: 'error',
      error: 'render_failed',
      retryable: true,
    })
    await wrapper
      .find('[data-test="perception-challenge-retry"]')
      .trigger('click')

    expect(wrapper.find('[role="alert"]').text()).toContain('render_failed')
    expect(retry).toHaveBeenCalledTimes(1)
    expect(refresh).toHaveBeenCalledTimes(1)

    await wrapper.setProps({
      state: 'ready',
      proofExpired: true,
      error: '',
    })

    expect(wrapper.classes()).toContain('is-expired')
    expect(
      wrapper.find('[data-test="perception-challenge-expired"]').text(),
    ).toContain('Challenge proof expired')
  })

  test('keeps v1 state aliases compatible with submitting and failed states', async () => {
    const wrapper = mount(FsusPerceptionChallenge, {
      props: {
        kind: 'text-task',
        state: 'submitting',
      },
    })

    expect(wrapper.classes()).toContain('is-verifying')
    expect(wrapper.attributes('aria-busy')).toBe('true')

    await wrapper.setProps({
      state: 'failed',
      error: 'try_again',
    })

    expect(wrapper.classes()).toContain('is-error')
    expect(wrapper.find('[role="alert"]').text()).toContain('try_again')
  })

  test('emits cancel from an accessible cancel action while busy', async () => {
    const cancel = vi.fn()
    const wrapper = mount(FsusPerceptionChallenge, {
      props: {
        kind: 'text-task',
        state: 'submitting',
        cancelLabel: 'Stop challenge',
        onCancel: cancel,
      },
    })

    const cancelButton = wrapper.find(
      '[data-test="perception-challenge-cancel"]',
    )

    expect(cancelButton.exists()).toBe(true)
    expect(cancelButton.text()).toBe('Stop challenge')

    await cancelButton.trigger('click')

    expect(cancel).toHaveBeenCalledTimes(1)
  })

  test('emits expired once when expiresAtUnixMs is already elapsed or becomes elapsed', async () => {
    vi.useFakeTimers()
    try {
      vi.setSystemTime(1_000)
      const expired = vi.fn()
      const wrapper = mount(FsusPerceptionChallenge, {
        props: {
          challenge: {
            challengeId: 'expiring-challenge',
            kind: 'text-task',
            expiresAtUnixMs: 1_050,
          } satisfies PerceptionChallengeAssignment,
          now: () => Date.now(),
          onExpired: expired,
        },
      })

      expect(expired).not.toHaveBeenCalled()

      vi.advanceTimersByTime(50)
      await nextTick()

      expect(wrapper.classes()).toContain('is-expired')
      expect(expired).toHaveBeenCalledTimes(1)
      expect(expired).toHaveBeenCalledWith({
        challengeId: 'expiring-challenge',
        reason: 'expiresAtUnixMs',
      })

      await wrapper.setProps({
        proofExpired: true,
      })

      expect(expired).toHaveBeenCalledTimes(1)
    } finally {
      vi.useRealTimers()
    }
  })

  test.each([
    ['text-task', '.el-text-task-challenge'],
    ['localization', '.el-localization-challenge'],
    ['micro-interaction', '.el-micro-interaction-challenge'],
  ] as const)('renders the %s task through the host', (kind, selector) => {
    const wrapper = mount(FsusPerceptionChallenge, {
      props: {
        challenge: {
          challengeId: `${kind}-challenge`,
          kind,
          prompt: `${kind} prompt`,
          microInteractionEnabled: kind === 'micro-interaction',
          renderPayload:
            kind === 'localization'
              ? {
                  kind: 'image-url',
                  src: 'data:image/png;base64,CCCC',
                  width: 20,
                  height: 10,
                }
              : null,
        } satisfies PerceptionChallengeAssignment,
      },
    })

    expect(wrapper.find(selector).exists()).toBe(true)
    expect(wrapper.text()).toContain(`${kind} prompt`)
  })

  test('loads an assignment through the optional client and renders through the worker renderer adapter', async () => {
    const assignment: PerceptionChallengeAssignment = {
      challengeId: 'challenge-1',
      kind: 'localization',
      prompt: 'Select the marked point',
      gridWidth: 100,
      gridHeight: 50,
      expiresAtUnixMs: Date.now() + 60_000,
    }
    const client = {
      refresh: vi.fn().mockResolvedValue(assignment),
      verify: vi.fn().mockResolvedValue({
        verified: true,
        proofToken: 'proof-1',
      }),
    }
    const renderer = {
      render: vi.fn().mockResolvedValue({
        kind: 'image-url',
        src: 'data:image/png;base64,AAAA',
        width: 200,
        height: 100,
      }),
    }
    const verified = vi.fn()
    const wrapper = mount(FsusPerceptionChallenge, {
      props: {
        kind: 'localization',
        autoLoad: true,
        client,
        renderer,
        onVerified: verified,
      },
    })

    await flushPromises()

    expect(client.refresh).toHaveBeenCalledTimes(1)
    expect(renderer.render).toHaveBeenCalledWith(assignment)
    expect(wrapper.find('img').attributes('src')).toBe(
      'data:image/png;base64,AAAA',
    )

    const target = wrapper.find('[data-test="perception-localization-target"]')
    vi.spyOn(target.element, 'getBoundingClientRect').mockReturnValue({
      left: 10,
      top: 20,
      width: 200,
      height: 100,
      right: 210,
      bottom: 120,
      x: 10,
      y: 20,
      toJSON: () => ({}),
    } as DOMRect)

    await target.trigger('click', { clientX: 60, clientY: 45 })
    await flushPromises()

    expect(client.verify).toHaveBeenCalledWith({
      kind: 'localization',
      challengeId: 'challenge-1',
      x: 25,
      y: 13,
    })
    expect(verified).toHaveBeenCalledWith({
      verified: true,
      proofToken: 'proof-1',
    })
  })

  test('submits text-task answers from keyboard and exposes mobile input hints', async () => {
    const submit = vi.fn()
    const wrapper = mount(FsusTextTaskChallenge, {
      props: {
        prompt: 'Enter the visible characters',
        onSubmit: submit,
      },
    })

    const input = wrapper.find('input')
    expect(input.attributes('inputmode')).toBe('text')
    expect(input.attributes('enterkeyhint')).toBe('done')

    await input.setValue('K7D2')
    await input.trigger('keydown.enter')

    expect(submit).toHaveBeenCalledWith({
      kind: 'text-task',
      value: 'K7D2',
    } satisfies PerceptionChallengeSubmitPayload)
  })

  test('submits localization coordinates from target clicks', async () => {
    const submit = vi.fn()
    const wrapper = mount(FsusLocalizationChallenge, {
      props: {
        prompt: 'Select the glyph center',
        gridWidth: 100,
        gridHeight: 50,
        renderPayload: {
          kind: 'image-url',
          src: 'data:image/png;base64,BBBB',
          width: 200,
          height: 100,
        },
        onSubmit: submit,
      },
    })

    const target = wrapper.find('[data-test="perception-localization-target"]')
    vi.spyOn(target.element, 'getBoundingClientRect').mockReturnValue({
      left: 10,
      top: 20,
      width: 200,
      height: 100,
      right: 210,
      bottom: 120,
      x: 10,
      y: 20,
      toJSON: () => ({}),
    } as DOMRect)

    await target.trigger('click', { clientX: 60, clientY: 45 })

    expect(submit).toHaveBeenCalledWith({
      kind: 'localization',
      x: 25,
      y: 13,
    } satisfies PerceptionChallengeSubmitPayload)
    expect(
      wrapper.find('[data-test="perception-localization-point"]').exists(),
    ).toBe(true)
  })

  test('keeps micro-interaction disabled by default and emits a stub payload only when feature-gated on', async () => {
    const submit = vi.fn()
    const gated = mount(FsusMicroInteractionChallenge, {
      props: {
        onSubmit: submit,
      },
    })

    expect(gated.find('[data-test="perception-micro-gated"]').exists()).toBe(
      true,
    )
    expect(gated.find('[data-test="perception-micro-submit"]').exists()).toBe(
      false,
    )

    const enabled = mount(FsusMicroInteractionChallenge, {
      props: {
        enabled: true,
        onSubmit: submit,
      },
    })

    await enabled.find('[data-test="perception-micro-submit"]').trigger('click')

    expect(submit).toHaveBeenCalledWith({
      kind: 'micro-interaction',
      steps: ['acknowledged'],
    } satisfies PerceptionChallengeSubmitPayload)
  })
})
