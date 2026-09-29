import { expect, test } from '@playwright/test'
import { e2eUser, registerUser } from './helpers'

// Guards the editor pane and the Markdown preview path (the preview renders in
// a fully sandboxed iframe). Throwaway account cleaned up by global-teardown.
const user = e2eUser('editor')
const docName = `editor ${user.username}`
const heading = `Heading ${user.username}`
const markdown = `# ${heading}\n\nsome **bold** text`

test('editor: open a Markdown document and render its preview', async ({ page }) => {
  await registerUser(page, user)

  const created = await page.request.post('/api/documents', {
    data: { name: docName, content: markdown, documentType: 'markdown' },
  })
  const body = (await created.json()) as { document?: { id?: string } }
  expect(created.ok(), JSON.stringify(body)).toBe(true)
  const id = body.document?.id
  expect(id).toBeTruthy()

  await page.goto(`/${id}`)
  await expect(page.getByRole('region', { name: docName })).toBeVisible()
  await expect(page.locator('.cm-content')).toContainText(heading)

  // The default mode is editor-only; show the preview pane.
  await page.getByRole('button', { name: 'Preview view' }).click()

  const preview = page.frameLocator('iframe[title="Markdown preview"]')
  await expect(preview.locator('h1')).toHaveText(heading)
  await expect(preview.locator('strong')).toHaveText('bold')
})
