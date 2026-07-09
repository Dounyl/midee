import { expect, type Page, test } from '@playwright/test'

// Live input browser e2e.
//
// We enter `/live` directly because the router owns mode selection now. The
// chord readout is the DOM signal for currently held live notes, so we assert
// on its visible text instead of internal CSS-module class names.

async function focusBodyForKeys(page: Page): Promise<void> {
  // Focus the body so key events land on `window` instead of a control.
  await page.locator('body').click({ position: { x: 5, y: 5 } })
}

async function openAppInLiveMode(page: Page): Promise<void> {
  await page.goto('/live')
  expect(await page.evaluate(() => window.isSecureContext)).toBe(true)

  await page.locator('#ts-chord-slot').waitFor({ state: 'attached', timeout: 30_000 })
  await expect(page.locator('#hud-session')).toBeVisible({ timeout: 30_000 })
  await focusBodyForKeys(page)
}

async function chordText(page: Page): Promise<string> {
  const text = await page.locator('#ts-chord-readout').textContent()
  return (text ?? '').trim()
}

test.describe('Live input (computer keyboard)', () => {
  test('a held key registers a live note and releasing it clears the note', async ({ page }) => {
    await openAppInLiveMode(page)

    const readout = page.locator('#ts-chord-readout')
    await expect(readout).toBeVisible()

    const emptyText = await chordText(page)
    expect(emptyText.length).toBeGreaterThan(0)

    await page.keyboard.down('x')
    await expect
      .poll(async () => chordText(page), { timeout: 15_000 })
      .toContain('D')

    await page.keyboard.up('x')
    await expect
      .poll(async () => chordText(page), { timeout: 15_000 })
      .toBe(emptyText)
  })

  test('two keys held together register as a chord (multi-note live capture)', async ({ page }) => {
    test.skip(!process.env.E2E_HEAVY, 'multi-key timing-fragile on CI; run with E2E_HEAVY=1')
    await openAppInLiveMode(page)

    const emptyText = await chordText(page)

    await page.keyboard.down('q')
    await page.keyboard.down('c')
    await page.keyboard.down('b')

    await expect
      .poll(async () => chordText(page), { timeout: 15_000 })
      .toContain('C')

    await page.keyboard.up('q')
    await page.keyboard.up('c')
    await page.keyboard.up('b')
    await expect
      .poll(async () => chordText(page), { timeout: 15_000 })
      .toBe(emptyText)
  })
})
