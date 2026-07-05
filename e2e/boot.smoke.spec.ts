import { expect, test } from '@playwright/test'

test.describe('Boot shell smoke', () => {
  test('boots from a single mount root and respects persisted route preference on reload', async ({
    page,
  }) => {
    await page.goto('/')

    await expect(page.locator('#app')).toBeVisible()
    await expect(page.locator('#app > #pianoroll')).toBeVisible()
    await expect(page.locator('#app > #ui-overlay')).toBeAttached()
    await expect(page.locator('#solid-root')).toBeAttached()
    await expect(page.locator('#home-live')).toBeVisible()

    await page.evaluate(() => {
      localStorage.setItem('midee.skipHomeIntro', 'true')
    })
    await page.reload()

    await expect(page).toHaveURL(/\/play$/)
    await expect(page.locator('#ts-open')).toBeVisible()
  })
})
