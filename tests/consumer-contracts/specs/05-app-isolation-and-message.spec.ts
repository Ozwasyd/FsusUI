import { expect, test } from '@playwright/test'
import { attachPageErrorCollector } from './helpers'

test.describe('FsusUI 2.0 multi-app config and FsusMessage isolation (#1151, #1152)', () => {
  test('isolates config, AppContext VNode messages, closeAll, and unmount teardown across independent Vue apps', async ({
    page,
  }) => {
    const { errors } = attachPageErrorCollector(page)

    await page.goto('/isolation?theme=light')
    await expect(page.getByTestId('isolation-contract')).toBeVisible()

    // #1151: App A (sm/en) and App B (lg/zhCN) observe independent configs after both install
    await expect(page.getByTestId('iso-app-alpha')).toHaveText('alpha:sm:Confirm')
    await expect(page.getByTestId('iso-app-beta')).toHaveText('beta:lg:确定')
    await expect(page.getByTestId('iso-config-summary')).toHaveText('sm/lg')

    // #1152: VNode message content reads each owning app's provides + FsusConfig
    await page.getByTestId('iso-show-a').click()
    await page.getByTestId('iso-show-b').click()
    await expect(page.getByTestId('iso-msg-alpha')).toHaveText('FromA|alpha|sm|Confirm')
    await expect(page.getByTestId('iso-msg-beta')).toHaveText('FromB|beta|lg|确定')
    await expect(page.locator('[data-fsus-message-host]')).toHaveCount(2)

    // #1152: closeAll on App A removes only App A's message & host without affecting App B
    await page.getByTestId('iso-close-all-a').click()
    await expect(page.getByTestId('iso-msg-alpha')).toHaveCount(0)
    await expect(page.getByTestId('iso-msg-beta')).toHaveText('FromB|beta|lg|确定')
    await expect(page.locator('[data-fsus-message-host]')).toHaveCount(1)

    // #1152: Unmounting App A tears down its persistent message & host without affecting App B
    await page.getByTestId('iso-show-a').click()
    await expect(page.getByTestId('iso-msg-alpha')).toBeVisible()
    await expect(page.locator('[data-fsus-message-host]')).toHaveCount(2)

    await page.getByTestId('iso-unmount-a').click()
    await expect(page.getByTestId('iso-msg-alpha')).toHaveCount(0)
    await expect(page.getByTestId('iso-msg-beta')).toHaveText('FromB|beta|lg|确定')
    await expect(page.locator('[data-fsus-message-host]')).toHaveCount(1)

    // Unmounting App B leaves zero message hosts
    await page.getByTestId('iso-unmount-b').click()
    await expect(page.getByTestId('iso-msg-beta')).toHaveCount(0)
    await expect(page.locator('[data-fsus-message-host]')).toHaveCount(0)

    // #1152 exact reproduction cycle: onMounted(() => FsusMessage({ duration: 0 })) + app.unmount()
    await page.getByTestId('iso-run-repro').click()
    await expect(page.getByTestId('iso-repro-hosts')).toHaveText('0')
    await expect(page.locator('[data-fsus-message-host]')).toHaveCount(0)

    expect(errors).toEqual([])
  })
})
