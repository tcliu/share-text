import { expect, test } from '@playwright/test'

// Throwaway account per AGENTS.md (`e2e_<purpose>_<timestamp>`); the user and
// the documents it owns are deleted after the run by e2e/global-teardown.ts.
const stamp = Date.now().toString(36)
const username = `e2e_smoke_${stamp}`
const email = `${username}@example.com`
const password = 'SmokeTest1234!xyz'
const docName = `smoke ${stamp}`
const docContent = `Smoke test document ${stamp}. Hello world.`

test('smoke: register, create and open a shared-text document', async ({ page }) => {
  // Unauthenticated visitors land on the browser page with the login dialog
  // auto-opened (`/login` redirects to `/?login=1`).
  await page.goto('/?login=1')
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()

  // Register through the real form (the Create account tab has the email field).
  await dialog.getByRole('button', { name: 'Create account' }).click()
  await dialog.locator('#register-username').fill(username)
  await dialog.locator('#register-email').fill(email)
  await dialog.locator('#register-password').fill(password)
  await dialog.getByRole('button', { name: 'Continue' }).click()
  // Success refreshes the session and closes the dialog.
  await expect(dialog).toBeHidden()

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
