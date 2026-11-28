import { defineComponent, h, ref, render } from 'vue'
import {
  createFsusError,
  fsusErr,
  fsusOk,
  isClient,
  type FsusResult,
  type FsusVariant,
} from '@fsusui/core'
import FsusButton from '../button/FsusButton.vue'

export interface FsusMessageBoxOptions {
  title?: string
  message: string
  mode?: 'alert' | 'confirm' | 'prompt'
  confirmText?: string
  cancelText?: string
  confirmVariant?: FsusVariant
  placeholder?: string
  inputValue?: string
}

export interface FsusMessageBoxOutcome {
  action: 'confirm'
  value?: string
}

let messageBoxSeed = 0

const openMessageBox = (
  options: FsusMessageBoxOptions,
): Promise<FsusResult<FsusMessageBoxOutcome>> => {
  if (!isClient) {
    return Promise.resolve(fsusErr(createFsusError('aborted', 'DOM unavailable')))
  }

  return new Promise((resolve) => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const mode = options.mode ?? 'alert'
    const boxId = ++messageBoxSeed
    const titleId = `fsus-message-box-title-${boxId}`
    const descId = `fsus-message-box-desc-${boxId}`
    const fallbackLabel = mode === 'confirm' ? 'Confirm' : mode === 'prompt' ? 'Input' : 'Notice'

    const cleanup = () => {
      render(null, container)
      container.remove()
    }

    const Modal = defineComponent({
      name: 'FsusMessageBoxModal',
      setup() {
        const inputVal = ref(options.inputValue ?? '')
        const onCancel = () => {
          cleanup()
          resolve(fsusErr(createFsusError('aborted', 'Cancelled by user')))
        }
        const onConfirm = () => {
          cleanup()
          resolve(
            fsusOk({
              action: 'confirm',
              ...(mode === 'prompt' ? { value: inputVal.value } : {}),
            }),
          )
        }
        return () =>
          h('div', { class: 'fsus-overlay', style: { zIndex: 2500 } }, [
            h('div', { class: 'fsus-overlay__scrim', onClick: mode === 'alert' ? undefined : onCancel }),
            h('div', { class: 'fsus-dialog__host' }, [
              h(
                'div',
                {
                  class: 'fsus-dialog fsus-message-box',
                  role: 'alertdialog',
                  'aria-modal': 'true',
                  'aria-labelledby': options.title ? titleId : undefined,
                  'aria-label': options.title ? undefined : fallbackLabel,
                  'aria-describedby': options.message ? descId : undefined,
                  tabindex: '-1',
                },
                [
                  options.title
                    ? h('header', { class: 'fsus-dialog__header' }, [
                        h('h2', { id: titleId, class: 'fsus-dialog__title' }, options.title),
                      ])
                    : null,
                  h('div', { class: 'fsus-dialog__body' }, [
                    h('p', { id: descId, class: 'fsus-message-box__message' }, options.message),
                    mode === 'prompt'
                      ? h('input', {
                          class: 'fsus-input__native fsus-message-box__input',
                          value: inputVal.value,
                          placeholder: options.placeholder,
                          onInput: (e: Event) => {
                            inputVal.value = (e.target as HTMLInputElement).value
                          },
                        })
                      : null,
                  ]),
                  h('footer', { class: 'fsus-dialog__footer' }, [
                    mode !== 'alert'
                      ? h(
                          FsusButton,
                          { variant: 'ghost', onClick: onCancel },
                          () => options.cancelText ?? 'Cancel',
                        )
                      : null,
                    h(
                      FsusButton,
                      { variant: options.confirmVariant ?? 'primary', onClick: onConfirm },
                      () => options.confirmText ?? 'Confirm',
                    ),
                  ]),
                ],
              ),
            ]),
          ])
      },
    })

    render(h(Modal), container)
  })
}

export const FsusMessageBox = {
  open: openMessageBox,
  alert: (message: string, title = 'Notice', options?: Partial<FsusMessageBoxOptions>) =>
    openMessageBox({ ...options, message, title, mode: 'alert' }),
  confirm: (message: string, title = 'Confirm', options?: Partial<FsusMessageBoxOptions>) =>
    openMessageBox({ ...options, message, title, mode: 'confirm' }),
  prompt: (message: string, title = 'Input', options?: Partial<FsusMessageBoxOptions>) =>
    openMessageBox({ ...options, message, title, mode: 'prompt' }),
}
