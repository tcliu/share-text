import { expect, type Page } from '@playwright/test'

export interface E2eUser {
  username: string
  email: string
  password: string
}

// Throwaway account prefix: `e2e/global-teardown.ts` deletes every user whose
// username starts with `e2e_` plus the documents it owns.
export function e2eUser(purpose: string): E2eUser {
  const username = `e2e_${purpose}_${Date.now().toString(36)}`
  return { username, email: `${username}@example.com`, password: 'E2eTest1234!xyz' }
}

// Registers through the browser page's embedded auth dialog — the only sign-in
// form (`/login` redirects to `/?login=1`). Success refreshes the session and
// closes the dialog.
export async function registerUser(page: Page, user: E2eUser): Promise<void> {
  await page.goto('/?login=1')
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: 'Create account' }).click()
  await dialog.locator('#register-username').fill(user.username)
  await dialog.locator('#register-email').fill(user.email)
  await dialog.locator('#register-password').fill(user.password)
  await dialog.getByRole('button', { name: 'Continue' }).click()
  await expect(dialog).toBeHidden()
}

export interface E2eDocument {
  name: string
  content: string
  documentType?: string
}

// Creates a document via the authenticated session (page.request shares its
// cookies) and returns its id. Centralizes the register → create → open
// preamble the flow specs share.
export async function createDocument(page: Page, document: E2eDocument): Promise<string> {
  const created = await page.request.post('/api/documents', { data: document })
  const body = (await created.json()) as { document?: { id?: string } }
  expect(created.ok(), JSON.stringify(body)).toBe(true)
  const id = body.document?.id
  expect(id).toBeTruthy()
  return id as string
}
