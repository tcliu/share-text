#!/usr/bin/env node
// Production deploy to Vercel or Cloudflare Pages: syncs the target env,
// optionally applies the Neon schema, deploys (Vercel with `vercel deploy
// --prod` and a READY wait, or `wrangler pages deploy` on Cloudflare Pages),
// and points the target at its production URL.
//
// Usage:
//   node scripts/deploy.mjs [--profile dev|prod] [--target vercel|cloudflare|all]
//     [--sync-env|--no-sync-env] [--apply-schema|--no-apply-schema]
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { parseArgs as parseCliArgs } from 'node:util'
import { errorMessage, logEvent } from './log-event.mjs'
import { ROOT_DIR, fail, runScript } from './_deploy/core.mjs'
import { runDeployInterview } from './_deploy/interview.mjs'
import {
  AUTO_PLUGINS,
  DEFAULT_PLUGINS,
  DEFAULT_TARGET,
  TARGETS,
  expandTargetFlag,
  resolvePlugins,
} from './_deploy/registry.mjs'
import { HEARTBEAT_PROVIDERS, shouldAskHeartbeat } from './lib/heartbeat.mjs'
import { isCloudflareD1Mode, runCloudflareFlow } from './_deploy/targets/cloudflare.mjs'
import { runVercelFlow } from './_deploy/targets/vercel.mjs'

function usage() {
  console.log(`Usage:
  node scripts/deploy.mjs [--profile dev|prod] [--target vercel|cloudflare|all]
    [--sync-env|--no-sync-env] [--apply-schema|--no-apply-schema]

Targets (--target, prod profile only; repeatable, comma-separated, or all):
  vercel       Deploy the app to Vercel.
  cloudflare   Deploy the app to Cloudflare Pages (reads .env.prod +
               .env.cloudflare, syncs vars/secrets via wrangler, removes
               forbidden keys, builds with CF_PAGES=1). Runs on D1 when
               CLOUDFLARE_D1_DATABASE is set, otherwise on Neon.
  all          Deploy to every target in parallel (the Neon schema applies once).

Options:
  --profile dev|prod   Backend profile to deploy (also read from $PROFILE).
                       Missing and interactive: arrow-key picker (default prod).
                       Missing and non-interactive: abort.
  --target vercel|cloudflare|all
                       Deploy targets; only valid with the prod profile
                       (dev has no deploy target). Defaults to vercel.
  --sync-env           Sync the target env file before a prod deploy.
  --no-sync-env        Skip the env sync. prod without a flag asks interactively
                       (default yes); non-interactive defaults to skip.
  --apply-schema       Apply sql/schema.sql before a prod deploy.
  --no-apply-schema    Skip the schema apply (same interactive/non-interactive
                       defaults as --sync-env).
  --heartbeat cron-job|none
                       Wire (or disable) the cron-job.org heartbeat that calls
                       GET /api/cron/scan; needs CRONJOB_API_KEY. Non-interactive
                       without the flag skips wiring.
  --project <name>     Vercel project to link (or switch) to; also read from
                       $VERCEL_PROJECT. Missing and interactive: prompt.

Examples:
  npm run deploy -- --profile prod --target vercel --sync-env
  npm run deploy -- --target cloudflare --sync-env --apply-schema
  npm run deploy -- --target all --sync-env --apply-schema
  PROFILE=prod node scripts/deploy.mjs --target vercel --no-sync-env`)
}

// Pure fallback for the non-interactive path (no TTY prompts here).
function resolveProfileSync(profileFlag) {
  const profile = profileFlag || process.env.PROFILE || ''
  if (profile !== 'dev' && profile !== 'prod') {
    fail('PROFILE is mandatory: pass --profile dev|prod, set $PROFILE, or run interactively.')
  }
  return profile
}

// Precedence: explicit flag, non-interactive skip with notice.
function resolveProdConfirmSync(profile, flag, skipNotice) {
  if (profile !== 'prod') {
    return 'no'
  }
  if (flag) {
    return flag
  }
  console.error(skipNotice)
  return 'no'
}

function parseArgs(argv) {
  let cli
  try {
    cli = parseCliArgs({
      args: argv,
      options: {
        profile: { type: 'string' },
        target: { type: 'string', multiple: true },
        'sync-env': { type: 'boolean' },
        'no-sync-env': { type: 'boolean' },
        'apply-schema': { type: 'boolean' },
        'no-apply-schema': { type: 'boolean' },
        heartbeat: { type: 'string' },
        project: { type: 'string' },
        help: { type: 'boolean', short: 'h' },
      },
      allowPositionals: true,
      strict: true,
    })
  } catch (error) {
    fail(error.message)
  }
  const { values, positionals } = cli
  if (values.help) {
    usage()
    process.exit(0)
  }
  if (values['sync-env'] && values['no-sync-env']) {
    fail('Conflicting --sync-env/--no-sync-env.')
  }
  if (values['apply-schema'] && values['no-apply-schema']) {
    fail('Conflicting --apply-schema/--no-apply-schema.')
  }
  const options = {
    profileFlag: values.profile ?? '',
    targetFlags: [],
    syncEnvFlag: values['sync-env'] ? 'yes' : values['no-sync-env'] ? 'no' : '',
    applySchemaFlag: values['apply-schema'] ? 'yes' : values['no-apply-schema'] ? 'no' : '',
    heartbeatFlag: values.heartbeat ?? '',
    projectFlag: values.project ?? '',
  }
  for (const raw of values.target ?? []) {
    options.targetFlags = expandTargetFlag(raw, options.targetFlags)
  }
  for (const positional of positionals) {
    if (positional === 'vercel') {
      // Legacy `deploy.sh vercel` positional: treat as --target vercel.
      if (!options.targetFlags.includes('vercel')) options.targetFlags.push('vercel')
    } else if (positional === 'help') {
      usage()
      process.exit(0)
    } else {
      fail(`Unknown argument: ${positional}`)
    }
  }
  return options
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  const unknown = options.targetFlags.filter(value => !TARGETS.some(entry => entry.value === value))
  if (unknown.length > 0) {
    fail(`Unknown target: ${unknown.join(', ')} (expected ${TARGETS.map(entry => entry.value).join('|')} or all).`)
  }
  await deployWithTarget(options)
}

async function deployWithTarget(options) {
  const seeded = [...options.targetFlags]
  const targets = seeded.length > 0 ? seeded : [DEFAULT_TARGET]
  // Explicit invalid sources fail fast; the interview only fills gaps.
  if (options.profileFlag && options.profileFlag !== 'dev' && options.profileFlag !== 'prod') {
    fail('PROFILE is mandatory: pass --profile dev|prod, set $PROFILE, or run interactively.')
  }
  const envProfile = options.profileFlag ? '' : process.env.PROFILE || ''
  if (envProfile && envProfile !== 'dev' && envProfile !== 'prod') {
    fail('PROFILE is mandatory: pass --profile dev|prod, set $PROFILE, or run interactively.')
  }
  if (options.heartbeatFlag && !HEARTBEAT_PROVIDERS.includes(options.heartbeatFlag)) {
    fail(`Unknown heartbeat: ${options.heartbeatFlag} (expected ${HEARTBEAT_PROVIDERS.join('|')}).`)
  }
  const seededProfile = options.profileFlag || process.env.PROFILE || ''
  if (
    process.stdin.isTTY &&
    seededProfile !== 'dev' &&
    (seededProfile === '' ||
      seeded.length === 0 ||
      !options.syncEnvFlag ||
      !options.applySchemaFlag ||
      shouldAskHeartbeat({ heartbeat: options.heartbeatFlag }))
  ) {
    const answers = await runDeployInterview(options)
    await runDeployTargets(answers.targets?.length ? answers.targets : targets, {
      profile: answers.profile,
      syncEnv: answers.syncEnv,
      applySchema: answers.applySchema,
      heartbeat: answers.heartbeat || 'skip',
      projectFlag: options.projectFlag,
    })
    return
  }
  const profileValue = resolveProfileSync(options.profileFlag)
  if (profileValue !== 'prod') {
    fail(`Target '${targets.join(',')}' supports only the prod profile; dev has no deploy target.`)
  }
  const syncEnv = resolveProdConfirmSync(
    profileValue,
    options.syncEnvFlag,
    '-> Non-interactive prod deploy without --sync-env: skipping target env sync.',
  )
  const applySchema = resolveProdConfirmSync(
    profileValue,
    options.applySchemaFlag,
    '-> Non-interactive prod deploy without --apply-schema: skipping schema apply.',
  )
  let heartbeat = options.heartbeatFlag
  if (!heartbeat) {
    console.error(
      '-> Non-interactive prod deploy without --heartbeat: skipping heartbeat wiring (cron-job.org job untouched).',
    )
    heartbeat = 'skip'
  }
  await runDeployTargets(targets, { profile: profileValue, syncEnv, applySchema, heartbeat, projectFlag: options.projectFlag })
}

// Load the per-project plugin selection (`deploy.config.mjs`), unioned with the
// auto-gated plugins; a project that ships no config uses the full default set.
async function loadPlugins() {
  const selected = existsSync(join(ROOT_DIR, 'scripts', 'deploy.config.mjs'))
    ? (await import('./deploy.config.mjs')).plugins
    : DEFAULT_PLUGINS
  return resolvePlugins([...new Set([...AUTO_PLUGINS, ...(selected ?? [])])])
}

// Runs each selected target. The schema apply is shared, so it runs once up
// front whenever a Neon-backed flow needs it (Vercel always; Cloudflare only
// outside D1 mode); the D1 flow applies its own schema. Env sync is per target.
async function runDeployTargets(targets, { profile, syncEnv, applySchema, heartbeat, projectFlag }) {
  const plugins = await loadPlugins()
  const d1Mode = targets.includes('cloudflare') && isCloudflareD1Mode()
  let schema = applySchema
  if (applySchema === 'yes' && (targets.includes('vercel') || (targets.includes('cloudflare') && !d1Mode))) {
    logEvent({ action: 'neon_schema_apply' })
    runScript('apply-schema.mjs', { ...process.env, PROFILE: 'prod' })
    schema = 'done'
  }
  const runOne = async target => {
    const startedAt = Date.now()
    logEvent({ action: 'deploy_start', details: { target, profile, sync_env: syncEnv, apply_schema: applySchema, heartbeat } })
    try {
      const url =
        target === 'cloudflare'
          ? await runCloudflareFlow({ syncEnv, applySchema: d1Mode ? applySchema : schema, d1Mode, heartbeat, plugins })
          : await runVercelFlow({ profile, syncEnv, applySchema: schema, heartbeat, projectFlag, plugins })
      logEvent({ action: 'deploy_end', details: { target, url, elapsed_ms: Date.now() - startedAt } })
    } catch (error) {
      logEvent({
        action: 'deploy_error',
        details: { target, elapsed_ms: Date.now() - startedAt, error: errorMessage(error) },
      })
      throw error
    }
  }
  if (targets.length > 1) {
    logEvent({ action: 'deploy_parallel', details: { targets } })
    await Promise.all(targets.map(runOne))
  } else {
    await runOne(targets[0])
  }
}

main().catch(error => {
  console.error(error?.message || error)
  process.exit(error?.exitCode ?? 1)
})
