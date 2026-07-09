import { createVNode, render } from 'vue'
import {
  debugWarn,
  createFsusError,
  fsusErr,
  fsusOk,
  hasOwn,
  isClient,
  isElement,
  isFunction,
  isObject,
  isString,
  isUndefined,
  isVNode,
} from '@element-plus/utils'
import MessageBoxConstructor from './index.vue'

import type { AppContext, ComponentPublicInstance, VNode } from 'vue'
import type {
  Action,
  Callback,
  ElMessageBoxOptions,
  ElMessageBoxShortcutMethod,
  IElMessageBox,
  MessageBoxData,
  MessageBoxState,
} from './message-box.type'
import type { FsusResult } from '@element-plus/utils'

// component default merge props & data

const messageInstance = new Map<
  ComponentPublicInstance<{ doClose: (action?: Action) => void }>,
  {
    options: any
    callback: Callback | undefined
    resolve: (res: FsusResult<MessageBoxData>) => void
  }
>()
const scopedMessageInstances = new WeakMap<AppContext, typeof messageInstance>()

const getMessageBoxScope = (appContext?: AppContext | null) => {
  if (!appContext) return messageInstance

  let scope = scopedMessageInstances.get(appContext)
  if (!scope) {
    scope = new Map()
    scopedMessageInstances.set(appContext, scope)
  }
  return scope
}

const getAppendToElement = (props: any): HTMLElement => {
  let appendTo: HTMLElement | null = document.body
  if (props.appendTo) {
    if (isString(props.appendTo)) {
      appendTo = document.querySelector<HTMLElement>(props.appendTo)
    }
    if (isElement(props.appendTo)) {
      appendTo = props.appendTo
    }

    // should fallback to default value with a warning
    if (!isElement(appendTo)) {
      debugWarn(
        'ElMessageBox',
        'the appendTo option is not an HTMLElement. Falling back to document.body.',
      )
      appendTo = document.body
    }
  }
  return appendTo
}

const initInstance = (
  props: any,
  container: HTMLElement,
  appContext: AppContext | null = null,
) => {
  const vnode = createVNode(
    MessageBoxConstructor,
    props,
    isFunction(props.message) || isVNode(props.message)
      ? {
          default: isFunction(props.message)
            ? props.message
            : () => props.message,
        }
      : null,
  )
  vnode.appContext = appContext
  render(vnode, container)
  getAppendToElement(props).appendChild(container.firstElementChild!)
  return vnode.component
}

const genContainer = () => {
  return document.createElement('div')
}

const showMessage = (options: any, appContext?: AppContext | null) => {
  const container = genContainer()
  const scopedInstances = getMessageBoxScope(appContext)
  // Adding destruct method.
  // when transition leaves emitting `vanish` evt. so that we can do the clean job.
  options.onVanish = () => {
    // not sure if this causes mem leak, need proof to verify that.
    // maybe calling out like 1000 msg-box then close them all.
    render(null, container)
    scopedInstances.delete(vm) // Remove vm to avoid mem leak.
    // here we were suppose to call document.body.removeChild(container.firstElementChild)
    // but render(null, container) did that job for us. so that we do not call that directly
  }

  options.onAction = (action: Action) => {
    const currentMsg = scopedInstances.get(vm)!
    let resolve: Action | { value: string; action: Action }
    if (options.showInput) {
      resolve = { value: vm.inputValue, action }
    } else {
      resolve = action
    }
    if (options.callback) {
      options.callback(resolve, instance.proxy)
    } else {
      if (action === 'cancel' || action === 'close') {
        if (options.distinguishCancelAndClose && action !== 'cancel') {
          currentMsg.resolve(fsusErr(createFsusError('aborted', 'close')))
        } else {
          currentMsg.resolve(fsusErr(createFsusError('aborted', 'cancel')))
        }
      } else {
        currentMsg.resolve(fsusOk(resolve as MessageBoxData))
      }
    }
  }

  const instance = initInstance(options, container, appContext)!

  // This is how we use message box programmably.
  // Maybe consider releasing a template version?
  // get component instance like v2.
  const vm = instance.proxy as ComponentPublicInstance<
    {
      visible: boolean
      doClose: (action?: Action) => void
    } & MessageBoxState
  >

  for (const prop in options) {
    if (hasOwn(options, prop) && !hasOwn(vm.$props, prop)) {
      vm[prop as keyof ComponentPublicInstance] = options[prop]
    }
  }

  // change visibility after everything is settled
  vm.visible = true
  return vm
}

async function MessageBox(
  options: ElMessageBoxOptions,
  appContext?: AppContext | null,
): Promise<FsusResult<MessageBoxData>>
function MessageBox(
  options: ElMessageBoxOptions | string | VNode,
  appContext: AppContext | null = null,
): Promise<FsusResult<MessageBoxData>> {
  if (!isClient) {
    return Promise.resolve(
      fsusErr(createFsusError('infra', 'message_box_requires_client')),
    )
  }
  let callback: Callback | undefined
  if (isString(options) || isVNode(options)) {
    options = {
      message: options,
    }
  } else {
    callback = options.callback
  }
  const normalizedOptions = normalizeMessageBoxOptions(options)
  callback = normalizedOptions.callback

  return new Promise((resolve) => {
    const vm = showMessage(
      normalizedOptions,
      appContext ?? (MessageBox as IElMessageBox)._context,
    )
    // collect this vm in order to handle upcoming events.
    getMessageBoxScope(
      appContext ?? (MessageBox as IElMessageBox)._context,
    ).set(vm, {
      options: normalizedOptions,
      callback,
      resolve,
    })
  })
}

const MESSAGE_BOX_BASE_DEFAULT_OPTS: Partial<ElMessageBoxOptions> = {
  autofocus: true,
  center: false,
  closeOnClickModal: true,
  closeOnHashChange: true,
  closeOnPressEscape: true,
  lockScroll: true,
  showClose: true,
  showConfirmButton: true,
  type: '',
}
const MESSAGE_BOX_VARIANTS = ['alert', 'confirm', 'prompt'] as const
const MESSAGE_BOX_DEFAULT_OPTS: Record<
  (typeof MESSAGE_BOX_VARIANTS)[number],
  Partial<ElMessageBoxOptions>
> = {
  alert: { closeOnPressEscape: false, closeOnClickModal: false },
  confirm: { showCancelButton: true },
  prompt: { showCancelButton: true, showInput: true },
}

const normalizeMessageBoxOptions = (
  options: ElMessageBoxOptions,
): ElMessageBoxOptions => {
  const boxType = options.boxType ?? ''
  const variantDefaults =
    boxType === 'alert' || boxType === 'confirm' || boxType === 'prompt'
      ? MESSAGE_BOX_DEFAULT_OPTS[boxType]
      : undefined

  return {
    ...MESSAGE_BOX_BASE_DEFAULT_OPTS,
    ...variantDefaults,
    ...options,
    boxType,
  }
}

MESSAGE_BOX_VARIANTS.forEach((boxType) => {
  ;(MessageBox as IElMessageBox)[boxType] = messageBoxFactory(
    boxType,
  ) as ElMessageBoxShortcutMethod
})

function messageBoxFactory(boxType: (typeof MESSAGE_BOX_VARIANTS)[number]) {
  return (
    message: string | VNode,
    title: string | ElMessageBoxOptions,
    options?: ElMessageBoxOptions,
    appContext?: AppContext | null,
  ) => {
    let titleOrOpts = ''
    if (isObject(title)) {
      options = title as ElMessageBoxOptions
      titleOrOpts = ''
    } else if (isUndefined(title)) {
      titleOrOpts = ''
    } else {
      titleOrOpts = title as string
    }

    return MessageBox(
      normalizeMessageBoxOptions({
        title: titleOrOpts,
        message,
        ...options,
        boxType,
      }),
      appContext,
    )
  }
}

MessageBox.close = () => {
  getMessageBoxScope((MessageBox as IElMessageBox)._context).forEach(
    (_, vm) => {
      vm.doClose('close')
    },
  )
}
;(MessageBox as IElMessageBox)._context = null

export default MessageBox as IElMessageBox
