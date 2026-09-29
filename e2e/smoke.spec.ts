import { expect, test } from '@playwright/test'
import { e2eUser, registerUser } from './helpers'

// Throwaway account per AGENTS.md (`e2e_<purpose>_<timestamp>`); the user and
// the documents it owns are deleted after the run by e2e/global-teardown.ts.
const user = e2eUser('smoke')
const docName = `smoke ${user.username}`
const docContent = `Smoke test document ${user.username}. Hello world.`

test('smoke: register, create and open a shared-text document', async ({ page }) => {
  // Unauthenticated visitors land on the browser page with the login dialog
  // auto-opened (`/login` redirects to `/?login=1`).
  await registerUser(page, user)

  // Create via the authenticated session (page.request shares its cookies).
  const created = await page.request.post('/api/documents', {
    data: { name: docName, content: docContent },
  })
  const body = (await created.json()) as { document?: { id?: string } }
  expect(created.ok(), JSON.stringify(body)).toBe(true)
  const id = body.document?.id
  expect(id).toBeTruthy()

  // Open by deep link: the editor names the document and shows its content.
  await page.goto(`/${id}`)
  await expect(page.getByRole('region', { name: docName })).toBeVisible()
  await expect(page.locator('.cm-content')).toContainText(docContent)
})
