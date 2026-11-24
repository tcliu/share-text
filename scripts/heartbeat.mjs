#!/usr/bin/env node
// Standalone prod heartbeat switch (no deploy): syncs the cron-job.org
// scan job that calls GET /api/cron/scan.
//
// Usage:
//   node scripts/heartbeat.mjs [--target vercel|cloudflare] [--provider cron-job|none]
// Missing and interactive: arrow-key picker (default cron-job).
// Missing and non-interactive: abort.
import { applyHeartbeat, HEARTBEAT_CHOICES, HEARTBEAT_PROVIDERS } from './lib/heartbeat.mjs'
import { resolveCloudflareAppUrl } from './lib/cloudflare.mjs'
import { ROOT as ROOT_DIR } from './lib/root.mjs'
import { loadTargetEnv, seedCloudflareCredentials } from './lib/target-env.mjs'
import { c, parseCliArgsOrExit } from './_terminal.mjs'
import { interactiveShell } from './_interactive-shell.mjs'
import { renderOptionPicker } from './_pickers.mjs'
import { failExit } from './_deploy/core.mjs'

function usage() {
  console.log(`Usage:
  node scripts/heartbeat.mjs [--target vercel|cloudflare] [--provider cron-job|none]

Targets (--target):
  vercel       Point the scan job at the Vercel deployment (default).
  cloudflare   Point the scan job at the Cloudflare Workers deployment.

Providers (--provider):
  cron-job   Upsert + enable the cron-job.org scan job (needs
             CRONJOB_API_KEY).
  none       Disable the scan job.

Options:
  --target vercel|cloudflare
                        Missing and interactive: picker (default vercel).
                        Missing and non-interactive: vercel.
  --provider cron-job|none
                       Missing and interactive: picker (default cron-job).
                       Missing and non-interactive: abort.

Examples:
  npm run heartbeat -- --provider cron-job
  npm run heartbeat -- --target cloudflare --provider cron-job
  npm run heartbeat -- --target cloudflare --provider none`)
}

function parseArgs(argv) {
  const { values, positionals } = parseCliArgsOrExit(
    argv,
    {
      target: { type: 'string' },
      provider: { type: 'string' },
      help: { type: 'boolean', short: 'h' },
    },
    usage,
    { help: cli => cli.values.help || cli.positionals.includes('help') },
  )
  if (positionals.length > 0) {
    failExit(`Unknown argument: ${positionals[0]}`)
  }
  return { targetFlag: values.target ?? '', providerFlag: values.provider ?? '' }
}

async function pickProvider() {
  const node = {
    message: 'Sync the cron-job.org auto-scan heartbeat?',
    async process(ctx) {
      const picked = await ctx.selectOne(HEARTBEAT_CHOICES, {
        defaultValue: 'cron-job',
        render: renderOptionPicker('default cron-job.org'),
      })
      if (!picked) {
        failExit('Heartbeat switch cancelled.')
      }
      ctx.provider = picked.value
      return null
    },
  }
  const answers = await interactiveShell(node, {
    options: { ctx: { provider: '' }, output: process.stderr },
    chrome: { cancelText: `${c.yellow}Heartbeat switch cancelled.${c.reset}` },
  })
  return answers.provider
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  if (options.targetFlag && options.targetFlag !== 'vercel' && options.targetFlag !== 'cloudflare') {
    failExit(`Unknown target: ${options.targetFlag} (expected vercel|cloudflare).`)
  }
  const target = options.targetFlag || 'vercel'
  if (options.providerFlag && !HEARTBEAT_PROVIDERS.includes(options.providerFlag)) {
    failExit(`Unknown provider: ${options.providerFlag} (expected cron-job|none).`)
  }
  let provider = options.providerFlag
  if (!provider) {
    if (!process.stdin.isTTY) {
      failExit('Missing provider: pass --provider cron-job|none or run interactively.')
    }
    provider = await pickProvider()
  }
  let result
  try {
    // The Cloudflare live URL is the Worker's Workers.dev host derived from
    // the name: resolve it instead of reading APP_BASE_URL (absent on that
    // target). Wrangler authenticates from the process env, so seed the
    // operator token from .env.local first — shell values always win.
    let baseUrl
    if (target === 'cloudflare') {
      const merged = loadTargetEnv('cloudflare', ROOT_DIR)
      seedCloudflareCredentials({ token: merged, accountId: merged })
      baseUrl = await resolveCloudflareAppUrl()
    }
    result = await applyHeartbeat(provider, undefined, target, { baseUrl })
  } catch (error) {
    failExit(error?.message || error)
  }
  // Report what actually happened: a step that skipped (no scan route, missing
  // credentials) must not print the same success line as an applied heartbeat.
  if (result && result.applied === false) {
    console.log(`SKIPPED heartbeat -> ${provider} (${target}): ${result.reason ?? 'nothing to apply'}`)
  } else {
    console.log(`OK heartbeat -> ${provider} (${target})`)
  }
}

main().catch(error => {
  console.error(error?.message || error)
  process.exit(1)
})
