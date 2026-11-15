import { expect, test } from '@playwright/test'
import type {} from './main'

for (const revived of [false, true]) {
  for (const id of [
    'doc-a',
    'document:N',
    'workspace:article:tab',
    ':document:N:',
    '文章:😀:tab',
  ]) {
    test(`${revived ? 'revived' : 'direct'} identity ${id}`, async ({
      page,
    }) => {
      const errors: string[] = []
      page.on('pageerror', (error) => errors.push(error.message))
      page.on('console', (message) => {
        if (['error', 'warning'].includes(message.type()))
          errors.push(message.text())
      })
      await page.goto('/')
      await expect(page).toHaveTitle('Markdown public identity consumer')
      await expect(page.locator('#ready')).toHaveText('Public runtime ready')
      const result = await page.evaluate(
        ({ id, revived }) => window.runIdentityScenario(id, revived),
        { id, revived },
      )
      expect(result.ids).toEqual(
        [0, 1, 2].map((ordinal) => `syn:${id}:17:heading:${ordinal}`),
      )
      expect(result.statuses).toEqual(['current', 'current', 'current'])
      expect(result.outline).toHaveLength(3)
      expect(result.prefixedIds).toEqual(result.ids)
      expect(result.prefixedStart).toBe(7)
      expect(result.deleted).toBe('deleted')
      expect(result.recreatedId).not.toBe(result.ids[0])
      expect(result.recreatedOld).toBe('deleted')
      expect(result.nextEpoch).toBe('deleted')
      expect(result.otherDocument).toBe('invalid')
      expect(result.reverseOtherDocument).toBe('invalid')
      expect(result.invalid).toBe('invalid')
      expect(result.unknown).toBe('deleted')
      expect(result.reveal).toMatchObject({
        documentIdentity: { id, epoch: 17 },
        range: { start: 0, end: 8 },
      })
      expect(result.selection).toEqual({ anchor: 0, focus: 8 })
      expect(errors).toEqual([])
    })
  }
}
