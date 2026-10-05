import { expect, test } from '@playwright/test'
import { createDocument, e2eUser, registerUser } from './helpers'

// Guards the CSV grid's owned-node focus registry
// (`src/lib/components/grid-cell-refs.ts`): cell editors register their own
// nodes, and Tab/Enter transitions reach the live node through the registry.
// Throwaway account cleaned up by global-teardown.
const user = e2eUser('csvgrid')
const docName = `csv ${user.username}`

test('csv grid: edit a cell, Tab across the registry, and persist', async ({ page }) => {
  await registerUser(page, user)
  const id = await createDocument(page, {
    name: docName,
    content: 'name,age\nAlice,30',
    documentType: 'csv',
  })

  await page.goto(`/${id}`)
  await expect(page.getByRole('region', { name: docName })).toBeVisible()

  // The default mode is editor-only; the grid renders in the preview pane.
  // Scope under the preview's testid: the grid uses split header/body tables
  // that both carry role="grid".
  await page.getByRole('button', { name: 'Preview view' }).click()
  const grid = page.getByTestId('csv-preview')
  await expect(grid).toBeVisible()

  const firstCell = grid.locator('textarea[data-row="1"][data-col="0"]')
  await expect(firstCell).toHaveValue('Alice')
  await firstCell.fill('Bob')
  await expect(firstCell).toHaveValue('Bob')

  // Tab reaches the neighbour editor through the registry, not DOM queries.
  await firstCell.press('Tab')
  await expect(grid.locator('textarea[data-row="1"][data-col="1"]')).toBeFocused()

  // Saving is explicit: the toolbar Save button PUTs the content, and the
  // round-trip proves the registry edit survived to the server.
  const saved = page.waitForResponse(
    response =>
      response.url().endsWith(`/api/documents/${id}`) && response.request().method() === 'PUT',
    { timeout: 15_000 },
  )
  await page.getByRole('button', { name: 'Save' }).click()
  await saved
  const fetched = await page.request.get(`/api/documents/${id}`)
  expect(fetched.ok()).toBe(true)
  expect(JSON.stringify(await fetched.json())).toContain('Bob')
})
