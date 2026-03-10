import { test, expect, type Page } from '@playwright/test'

// Helper: switch to the Playwright Test project via the project selector dropdown
async function selectPlaywrightProject(page: Page) {
  // The project button shows the current project name
  const projectBtn = page.locator('header button', { hasText: /(Media Server|Playwright Test|Example|Subgeneratorr)/ }).first()
  const btnText = await projectBtn.textContent()

  if (btnText?.includes('Playwright Test')) return // Already selected

  // Click to open project selector dropdown
  await projectBtn.click()
  // Wait for dropdown and click Playwright Test
  await page.getByText('Playwright Test').click()
  // Wait for the project switch to complete
  await expect(page.locator('header button', { hasText: 'Playwright Test' })).toBeVisible({ timeout: 5_000 })
}

// Wait for tasks to load (WebSocket connected + tasks rendered)
async function waitForTasks(page: Page) {
  await expect(page.getByText('Connected')).toBeVisible({ timeout: 10_000 })
  // Wait for a bucket header — use uppercase tracking class to distinguish from card content
  await expect(page.locator('.uppercase', { hasText: 'Running' }).first()).toBeVisible({ timeout: 10_000 })
}

// Get a bucket header element by its label text
function bucketHeader(page: Page, label: string) {
  return page.locator('.uppercase', { hasText: label }).first()
}

test.describe('Agent Conductor — Playwright Test Project', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await selectPlaywrightProject(page)
    await waitForTasks(page)
  })

  test('renders all 6 buckets with correct task counts', async ({ page }) => {
    await expect(bucketHeader(page, 'Running')).toContainText('(4)')
    await expect(bucketHeader(page, 'Needs Review')).toContainText('(4)')
    await expect(bucketHeader(page, 'Ready')).toContainText('(8)')
    await expect(bucketHeader(page, 'Needs Planning')).toContainText('(4)')
    await expect(bucketHeader(page, 'Blocked')).toContainText('(4)')
    // Done is collapsed — shows count in button text
    await expect(page.getByRole('button', { name: /Done \(6\)/ })).toBeVisible()
  })

  test('priority sort: HIGH tasks appear before LOW within Ready bucket', async ({ page }) => {
    // The Ready bucket section contains task cards in priority order
    // "Grid alignment baseline check" is HIGH, "Search matches unique keywords" is LOW
    const readyHeader = bucketHeader(page, 'Ready')
    const readySection = readyHeader.locator('..')

    const text = await readySection.textContent()
    const highTask = text!.indexOf('Grid alignment baseline check')
    const lowTask = text!.indexOf('Search matches unique keywords')
    expect(highTask).toBeGreaterThan(-1)
    expect(lowTask).toBeGreaterThan(-1)
    expect(highTask).toBeLessThan(lowTask)
  })

  test('Done bucket is collapsed by default and expands on click', async ({ page }) => {
    const doneBtn = page.getByRole('button', { name: /Done \(6\)/ })
    await expect(doneBtn).toBeVisible()

    // Done tasks should not be visible initially
    await expect(page.getByText('Collapsed section toggle animation')).not.toBeVisible()

    // Click to expand
    await doneBtn.click()

    // Now done tasks should appear
    await expect(page.getByText('Collapsed section toggle animation')).toBeVisible()
  })

  test('search isolates matching tasks without expanding filters', async ({ page }) => {
    // Open sidebar to access search
    await page.locator('header button').first().click()
    const searchInput = page.getByPlaceholder('Search tasks...')
    await expect(searchInput).toBeVisible()

    // Type search term
    await searchInput.fill('xylophone')

    // Should show exactly 1 result
    await expect(page.getByText('1/30')).toBeVisible()
    await expect(page.getByText('Search matches unique keywords')).toBeVisible()

    // Other tasks should be filtered out
    await expect(page.getByText('Grid alignment baseline check')).not.toBeVisible()
  })

  test('Stage filter shows only selected bucket', async ({ page }) => {
    // Click the Filters button to expand filter bar
    await page.getByRole('button', { name: 'Filters' }).click()

    // Click Stage chip
    await page.getByRole('button', { name: 'Stage', exact: true }).click()

    // Select "Blocked" from the Stage dropdown
    // Use a more specific locator since "Blocked" appears in card content too
    const stageDropdown = page.locator('.absolute', { hasText: 'Running' }).locator('button', { hasText: 'Blocked' })
    await stageDropdown.click()

    // Should show filter indicator
    await expect(page.getByText('1 active')).toBeVisible()
    await expect(page.getByText('4/30')).toBeVisible()

    // Only blocked tasks should be visible
    await expect(page.getByText('Bulk delete confirmation dialog')).toBeVisible()
    // Non-blocked tasks should be hidden
    await expect(page.getByText('Grid alignment baseline check')).not.toBeVisible()
  })

  test('responsive: desktop viewport (1280x800)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await expect(bucketHeader(page, 'Running')).toBeVisible()
    await expect(bucketHeader(page, 'Ready')).toBeVisible()
    await expect(page.getByRole('button', { name: /Done/ })).toBeVisible()
    await page.screenshot({ path: 'e2e/screenshots/desktop-1280x800.png', fullPage: true })
  })

  test('responsive: tablet viewport (768x1024)', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 })
    await expect(bucketHeader(page, 'Running')).toBeVisible()
    await expect(bucketHeader(page, 'Ready')).toBeVisible()
    await page.screenshot({ path: 'e2e/screenshots/tablet-768x1024.png', fullPage: true })
  })

  test('responsive: mobile viewport (375x812)', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await expect(bucketHeader(page, 'Running')).toBeVisible()
    await expect(bucketHeader(page, 'Ready')).toBeVisible()
    await page.screenshot({ path: 'e2e/screenshots/mobile-375x812.png', fullPage: true })
  })
})
