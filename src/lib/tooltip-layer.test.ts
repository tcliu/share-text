// @vitest-environment node
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { __unstable__loadDesignSystem } from 'tailwindcss'

// The tip host rides above portalled `z-40` dialogs through the `z-tooltip`
// utility. Tailwind resolves that name from the `--z-index-*` theme namespace,
// so declaring it under any other name (e.g. `--z-tooltip`) silently emits no
// CSS and the host drops below the dialogs that portal after it in body order.
// Compile the real stylesheet and assert the utility resolves; a bare check
// that the class name appears in markup cannot catch a wrong namespace.
const styles = readFileSync('src/styles.css', 'utf8')
const layout = readFileSync('src/routes/+layout.svelte', 'utf8')

async function designSystem() {
  return __unstable__loadDesignSystem(styles, {
    base: process.cwd(),
    loadStylesheet: async (id, base) => ({
      path: id,
      base,
      content: id === 'tailwindcss' ? readFileSync('node_modules/tailwindcss/index.css', 'utf8') : '',
    }),
  })
}

describe('tooltip hint host layering', () => {
  it('renders the tip host with the z-tooltip utility', () => {
    expect(layout).toContain('id="tip"')
    expect(layout).toContain('z-tooltip')
  })

  it('resolves z-tooltip to a z-index rule from the project stylesheet', async () => {
    const ds = await designSystem()
    const [rule] = ds.candidatesToCss(['z-tooltip']).filter(Boolean)
    expect(rule, 'z-tooltip produced no CSS; check the --z-index-* token name').toBeTruthy()
    expect(rule).toContain('z-index')
  })
})
