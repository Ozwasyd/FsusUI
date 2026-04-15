import { nextTick } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { rAF } from '@element-plus/test-utils/tick'
import Notification, { closeAll } from '../src/notify'
import { ElNotification } from '..'

import type { NotificationHandle } from '../src/notification'

const selector = '.el-notification'

const getNotificationPosition = (elm: Element): number => {
  const element = elm as HTMLElement
  return (
    Number.parseFloat(element.style.top || '0') +
    Number.parseFloat(
      element.style.getPropertyValue('--el-notification-stack-y') || '0'
    )
  )
}

describe('Notification on command', () => {
  afterEach(() => {
    closeAll()
  })

  it('it should get component handle', async () => {
    const handle = Notification()
    await rAF()
    expect(document.querySelector(selector)).toBeDefined()

    handle.close()
    await rAF()
    await nextTick()
    expect(document.querySelector(selector)).toBeNull()
    expect(
      document.querySelector('[class^="container_notification"]')
    ).toBeNull()
  })

  it('it should be able to render vnode', async () => {
    const testClassName = 'test-classname'
    const { close } = Notification({
      duration: 0,
      message: <div class={testClassName}>test-content</div>,
    })

    await rAF()
    expect(document.querySelector(`.${testClassName}`)).toBeDefined()
    close()
  })

  it('it should be able to close notification by manually close', async () => {
    const { close } = Notification({
      duration: 0,
    })
    await rAF()

    const element = document.querySelector(selector)
    expect(element).toBeDefined()
    close()
    await rAF()
    await nextTick()

    expect(document.querySelector(selector)).toBeNull()
  })

  it('it should close all notifications', async () => {
    const notifications: NotificationHandle[] = []
    const onClose = vi.fn()
    for (let i = 0; i < 4; i++) {
      notifications.push(
        Notification({
          onClose,
          duration: 0,
        })
      )
    }
    // vi.runAllTicks()
    await rAF()

    expect(document.querySelectorAll(selector).length).toBe(4)
    closeAll()
    // vi.runAllTicks()
    await rAF()
    expect(onClose).toHaveBeenCalledTimes(notifications.length)
    expect(document.querySelectorAll(selector).length).toBe(0)
  })

  it('it should be able to render all types notification', () => {
    for (const type of ['success', 'warning', 'error', 'info'] as const) {
      Notification[type]({})
      expect(document.querySelector(`.el-icon-${type}`)).toBeDefined()
    }
  })

  it('it should appendTo specified HTMLElement', async () => {
    const htmlElement = document.createElement('div')
    const handle = Notification({
      appendTo: htmlElement,
    })
    await rAF()
    expect(htmlElement.querySelector(selector)).toBeDefined()

    handle.close()
    await rAF()
    await nextTick()
    expect(htmlElement.querySelector(selector)).toBeNull()
  })

  it('it should appendTo specified selector', async () => {
    const htmlElement = document.createElement('div')
    htmlElement.classList.add('notification-manager')
    document.body.appendChild(htmlElement)
    const handle = Notification({
      appendTo: '.notification-manager',
    })
    await rAF()
    expect(htmlElement.querySelector(selector)).toBeDefined()
    handle.close()
    await rAF()
    await nextTick()
    expect(htmlElement.querySelector(selector)).toBeNull()
  })

  it('should stack notifications through transform offsets and restack after close', async () => {
    const handles = [
      Notification({ duration: 0 }),
      Notification({ duration: 0 }),
      Notification({ duration: 0 }),
    ]

    await rAF()
    const elements = document.querySelectorAll(selector) as NodeListOf<HTMLElement>
    expect(getNotificationPosition(elements[0])).toBe(16)
    expect(getNotificationPosition(elements[1])).toBe(32)
    expect(elements[2].style.getPropertyValue('--el-notification-stack-y')).toBe(
      '32px'
    )

    handles[1].close()
    await rAF()

    expect(elements[2].style.getPropertyValue('--el-notification-stack-y')).toBe(
      '16px'
    )

    handles[0].close()
    handles[2].close()
  })

  describe('context inheritance', () => {
    it('should globally inherit context correctly', () => {
      expect(ElNotification._context).toBe(null)
      const testContext = {
        config: {
          globalProperties: {},
        },
        _context: {},
      }
      ElNotification.install?.(testContext as any)
      expect(ElNotification._context).not.toBe(null)
      expect(ElNotification._context).toBe(testContext._context)
      // clean up
      ElNotification._context = null
    })
  })
})
