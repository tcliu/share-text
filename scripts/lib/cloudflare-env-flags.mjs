// Dependency-free flag parser for the Cloudflare env sync, split from the
// entry script so argument parsing can be unit-tested without loading the
// script's runtime dependencies (see `~/.agents/references/js-ts.md`, CLI
// scripts).
import { parseArgs } from 'node:util'

export const SECRET_MODES = ['always', 'missing']

export function parseFlags(argv) {
  let values
  try {
    ;({ values } = parseArgs({
      args: argv,
      options: {
        'dry-run': { type: 'boolean' },
        prune: { type: 'boolean' },
        secrets: { type: 'string', multiple: true },
      },
      strict: true,
    }))
  } catch (error) {
    throw new Error(
      `${error instanceof Error ? error.message : String(error)} (expected --dry-run, --prune, --secrets=always|missing).`,
    )
  }
  const modes = values.secrets ?? []
  // A repeated flag with conflicting values is a mistake, not last-wins.
  const uniqueModes = new Set(modes)
  if (uniqueModes.size > 1) {
    throw new Error(`Conflicting --secrets values: ${[...uniqueModes].join(', ')}.`)
  }
  const secrets = modes[0] ?? 'always'
  if (!SECRET_MODES.includes(secrets)) {
    throw new Error(`Unknown --secrets mode: ${secrets} (expected ${SECRET_MODES.join('|')}).`)
  }
  return { dryRun: values['dry-run'] === true, prune: values.prune === true, secrets }
}
