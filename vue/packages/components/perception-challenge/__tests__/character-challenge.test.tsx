import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { nextTick } from 'vue'
import {
  ElPerceptionCharacterChallenge,
  FsusPerceptionCharacterChallenge,
  FsusPerceptionChallenge,
  perceptionChallengeKinds,
} from '..'

import type {
  PerceptionCharacterMedia,
  PerceptionCharacterSubmitPayload,
} from '..'

const raster = (
  src = 'data:image/png;base64,AAAA',
): PerceptionCharacterMedia => ({
  raster: {
    kind: 'image-url',
    src,
    width: 240,
    height: 80,
    alt: 'must not be exposed as an answer',
  },
})

afterEach(() => {
  document.body.innerHTML = ''
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('perception character challenge', () => {
  test('exports character as a first-class kind and renders it through the host', () => {
    expect(perceptionChallengeKinds).toContain('character')
    expect(ElPerceptionCharacterChallenge.name).toBe(
      'ElPerceptionCharacterChallenge',
    )
    expect(FsusPerceptionCharacterChallenge.name).toBe(
      'FsusPerceptionCharacterChallenge',
    )

    const wrapper = mount(FsusPerceptionChallenge, {
      props: {
        challenge: {
          challengeId: 'characters-1',
          kind: 'character',
          prompt: 'Enter the visible characters',
          characterMedia: raster(),
        },
        state: 'ready',
      },
    })

    expect(wrapper.find('.el-perception-character-challenge').exists()).toBe(
      true,
    )
    expect(wrapper.find('.el-text-task-challenge').exists()).toBe(false)
  })

  test.each([
    ['loading', 'Preparing challenge', false],
    ['ready', '', true],
    ['verifying', 'Checking response', true],
    ['retryable', 'The response was not accepted', true],
    ['reissue', 'A new challenge is required', false],
    ['unavailable', 'Character challenge is unavailable', false],
    ['expired', 'Character challenge expired', false],
    ['disabled', 'Character challenge is disabled', true],
  ] as const)(
    'renders the %s state deterministically',
    (state, statusText, showsInput) => {
      const wrapper = mount(FsusPerceptionCharacterChallenge, {
        props: {
          challengeId: 'characters-1',
          state,
          media: raster(),
        },
      })

      expect(wrapper.classes()).toContain(`is-${state}`)
      expect(wrapper.find('[role="status"]').text()).toBe(statusText)
      expect(wrapper.find('input').exists()).toBe(showsInput)
      if (state === 'verifying' || state === 'disabled') {
        expect(wrapper.find('input').attributes('disabled')).toBeDefined()
      }
    },
  )

  test('renders purpose-oriented raster alt and opt-in audio without autoplay', async () => {
    const alternative = vi.fn()
    const wrapper = mount(FsusPerceptionCharacterChallenge, {
      props: {
        challengeId: 'characters-1',
        state: 'ready',
        media: {
          ...raster(),
          audio: {
            src: 'data:audio/mpeg;base64,AAAA',
            type: 'audio/mpeg',
          },
        },
        mediaAlt: 'Characters to transcribe',
        onAlternative: alternative,
      },
    })

    const image = wrapper.find('[data-test="perception-character-raster"]')
    expect(image.attributes('alt')).toBe('Characters to transcribe')
    expect(image.attributes('alt')).not.toContain('must not be exposed')

    await wrapper
      .find('[data-test="perception-character-alternative"]')
      .trigger('click')

    const audio = wrapper.find('[data-test="perception-character-audio"]')
    expect(audio.exists()).toBe(true)
    expect(audio.attributes('autoplay')).toBeUndefined()
    expect(audio.attributes('controls')).toBeDefined()
    expect(alternative).toHaveBeenCalledWith('audio')
  })

  test('draws final RGBA and bitmap raster media without transforming it', async () => {
    const putImageData = vi.fn()
    const drawImage = vi.fn()
    const clearRect = vi.fn()
    vi.stubGlobal(
      'ImageData',
      class {
        constructor(
          readonly data: Uint8ClampedArray,
          readonly width: number,
          readonly height: number,
        ) {}
      },
    )
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      putImageData,
      drawImage,
      clearRect,
    } as unknown as CanvasRenderingContext2D)

    const wrapper = mount(FsusPerceptionCharacterChallenge, {
      props: {
        challengeId: 'characters-rgba',
        state: 'ready',
        media: {
          raster: {
            kind: 'rgba-raster',
            pixels: new Uint8ClampedArray([0, 0, 0, 255]),
            width: 1,
            height: 1,
          },
        },
      },
    })
    await nextTick()
    await nextTick()

    expect(putImageData).toHaveBeenCalledTimes(1)

    const bitmap = {} as ImageBitmap
    await wrapper.setProps({
      challengeId: 'characters-bitmap',
      media: {
        raster: {
          kind: 'bitmap',
          bitmap,
          width: 2,
          height: 1,
        },
      },
    })
    await nextTick()
    await nextTick()

    expect(drawImage).toHaveBeenCalledWith(bitmap, 0, 0)
  })

  test('uses one live region, one error owner, and a stable explicit label association', () => {
    const wrapper = mount(FsusPerceptionCharacterChallenge, {
      props: {
        challengeId: 'characters-1',
        state: 'retryable',
        media: raster(),
        error: 'Try a different response',
        inputLabel: 'Type the characters',
      },
    })

    const input = wrapper.find('input')
    const label = wrapper.find('label')
    const error = wrapper.find('.el-perception-character-challenge__error')
    expect(wrapper.findAll('[aria-live]').length).toBe(1)
    expect(
      wrapper.findAll('.el-perception-character-challenge__error').length,
    ).toBe(1)
    expect(label.attributes('for')).toBe(input.attributes('id'))
    expect(input.attributes('aria-invalid')).toBe('true')
    expect(input.attributes('aria-describedby')).toContain(
      error.attributes('id'),
    )
  })

  test('submits a trimmed character payload from Enter', async () => {
    const submit = vi.fn()
    const wrapper = mount(FsusPerceptionCharacterChallenge, {
      props: {
        challengeId: 'characters-1',
        state: 'ready',
        media: raster(),
        onSubmit: submit,
      },
    })

    const input = wrapper.find('input')
    await input.setValue('  K7D2  ')
    await input.trigger('keydown.enter')

    expect(submit).toHaveBeenCalledWith({
      kind: 'character',
      value: 'K7D2',
      challengeId: 'characters-1',
    } satisfies PerceptionCharacterSubmitPayload)
  })

  test('clears stale response and error when challenge identity changes', async () => {
    const update = vi.fn()
    const wrapper = mount(FsusPerceptionCharacterChallenge, {
      props: {
        challengeId: 'characters-1',
        state: 'retryable',
        media: raster(),
        modelValue: 'OLD',
        error: 'Old challenge error',
        'onUpdate:modelValue': update,
      },
    })

    await wrapper.setProps({
      challengeId: 'characters-2',
      media: raster('data:image/png;base64,BBBB'),
    })
    await nextTick()

    expect(wrapper.find('input').element.value).toBe('')
    expect(
      wrapper.find('.el-perception-character-challenge__error').exists(),
    ).toBe(false)
    expect(update).toHaveBeenLastCalledWith('')
  })

  test.each([
    ['refresh', 'perception-character-refresh'],
    ['reissue', 'perception-character-reissue'],
  ] as const)(
    'returns focus only after %s replacement identity becomes ready',
    async (event, testId) => {
      const listener = vi.fn()
      const wrapper = mount(FsusPerceptionCharacterChallenge, {
        attachTo: document.body,
        props: {
          challengeId: 'characters-1',
          state: event === 'reissue' ? 'reissue' : 'ready',
          media: raster(),
          [`on${event[0].toUpperCase()}${event.slice(1)}`]: listener,
        },
      })

      await wrapper.find(`[data-test="${testId}"]`).trigger('click')
      expect(listener).toHaveBeenCalledTimes(1)
      const previousInput = wrapper.find('input').exists()
        ? wrapper.find('input').element
        : null

      await wrapper.setProps({
        challengeId: 'characters-2',
        state: 'loading',
        media: raster('data:image/png;base64,BBBB'),
      })
      await nextTick()
      if (previousInput) expect(document.activeElement).not.toBe(previousInput)

      await wrapper.setProps({ state: 'ready' })
      await nextTick()
      expect(document.activeElement).toBe(wrapper.find('input').element)
    },
  )

  test('keeps action order stable, exposes focus/reset, and supports retry', async () => {
    const retry = vi.fn()
    const wrapper = mount(FsusPerceptionCharacterChallenge, {
      attachTo: document.body,
      props: {
        challengeId: 'characters-1',
        state: 'retryable',
        media: {
          ...raster(),
          audio: { src: 'data:audio/mpeg;base64,AAAA' },
        },
        modelValue: 'OLD',
        error: 'Try again',
        onRetry: retry,
      },
    })

    const controls = wrapper.findAll('button, input, audio')
    expect(controls.map((control) => control.attributes('data-test'))).toEqual([
      'perception-character-alternative',
      'perception-character-refresh',
      'perception-character-input',
      'perception-character-submit',
      'perception-character-retry',
    ])

    await wrapper
      .find('[data-test="perception-character-retry"]')
      .trigger('click')
    expect(retry).toHaveBeenCalledTimes(1)
    expect(document.activeElement).toBe(wrapper.find('input').element)

    wrapper.vm.reset()
    await nextTick()
    expect(wrapper.find('input').element.value).toBe('')
    wrapper.vm.focus()
    expect(document.activeElement).toBe(wrapper.find('input').element)
  })
})
