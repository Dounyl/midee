import { expect, test } from '@playwright/test'

test.describe('Boot shell smoke', () => {
  test('boots from a single mount root and preserves canonical routes across reloads', async ({
    page,
  }) => {
    await page.goto('/')

    await expect(page.locator('#app')).toBeVisible()
    await expect(page.locator('#app > #pianoroll')).toBeVisible()
    await expect(page.locator('#app > #ui-overlay')).toBeAttached()
    await expect(page.locator('#solid-root')).toBeAttached()
    await expect(page).toHaveURL(/\/play$/)
    await expect(page.locator('#ts-open')).toBeVisible()
    await expect(page.locator('#ts-mode-live')).toBeVisible()

    await page.goto('/live')
    await expect(page).toHaveURL(/\/live$/)
    await expect(page.locator('#hud-session')).toBeVisible()
    await page.reload()

    await expect(page).toHaveURL(/\/live$/)
    await expect(page.locator('#hud-session')).toBeVisible()
  })
})
