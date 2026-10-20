import { expect, test } from '@playwright/test'
import { e2eUser, registerUser } from './helpers'

// Throwaway account per AGENTS.md (`e2e_<purpose>_<timestamp>`); the user is
// deleted after the run by e2e/global-teardown.ts.
const user = e2eUser('drawer')

// Guards the document-list drawer on a phone-class viewport: the pane floats
// over the editor there, and it must paint above the shell's backdrop so its
// controls stay reachable.
test('drawer: the floating document list sits above the backdrop', async ({ page }) => {
  await registerUser(page, user)
  await page.setViewportSize({ width: 600, height: 800 })
  await page.waitForLoadState('networkidle')

  const pane = page.getByRole('complementary', { name: 'Document list' })
  if (!(await pane.isVisible())) {
    // The pane starts closed on the narrow route; the header toggle opens it.
    await page.getByRole('button', { name: 'Show document list' }).click()
  }
  await expect(pane).toBeVisible()

  // The pane is the topmost element at its own centre once the slide settles,
  // so a click there reaches the drawer instead of the backdrop under it.
  await expect
    .poll(async () => {
      const box = await pane.boundingBox()
      if (!box) return false
      return pane.evaluate(
        (el, point) => Boolean(el.closest('.app-shell-pane')?.contains(document.elementFromPoint(point.x, point.y))),
        { x: box.x + box.width / 2, y: box.y + box.height / 2 },
      )
    })
    .toBe(true)
})
