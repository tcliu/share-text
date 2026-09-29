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
