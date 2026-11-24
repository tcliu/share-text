#!/usr/bin/env node
// Production deploy to Vercel or Cloudflare Workers: syncs the target env,
// optionally applies the Neon schema, deploys (Vercel with `vercel deploy
// --prod` and a READY wait, or `wrangler deploy` on Cloudflare Workers),
// and points the target at its production URL.
//
// Usage:
//   node scripts/deploy.mjs [--profile dev|prod] [--target vercel|cloudflare|all]
//     [--sync-env|--no-sync-env] [--apply-schema|--no-apply-schema]
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { errorMessage, logEvent } from './log-event.mjs'
import { ROOT_DIR, fail, runScript } from './_deploy/core.mjs'
import { parseCliArgsOrExit } from './_terminal.mjs'
import { runDeployInterview } from './_deploy/interview.mjs'
import {
  DEFAULT_TARGET,
  linkableTargetValues,
  planTargetSelection,
  requiredEnvFromConfig,
  resolveConfiguredPlugins,
  selectDefaultTargets,
} from './_deploy/registry.mjs'
import { HEARTBEAT_PROVIDERS, shouldAskHeartbeat } from './lib/heartbeat.mjs'
import { preflightDeploy, targetAvailability } from './_deploy/preflight.mjs'
import { planDeployBackends } from './_deploy/backend.mjs'
import { runCloudflareFlow } from './_deploy/targets/cloudflare.mjs'
import { runVercelFlow } from './_deploy/targets/vercel.mjs'
import { loadTargetFileEnv } from './lib/target-env.mjs'

function usage() {
  console.log(`Usage:
  node scripts/deploy.mjs [--profile dev|prod] [--target vercel|cloudflare|all]
    [--sync-env|--no-sync-env] [--apply-schema|--no-apply-schema]

Targets (--target, prod profile only; repeatable, comma-separated, or all):
  vercel       Deploy the app to Vercel.
  cloudflare   Deploy the app to Cloudflare Workers (reads .env.prod +
               .env.cloudflare, syncs vars/secrets via wrangler, removes
               forbidden keys, builds with CF_WORKERS=1).
  all          Deploy to every target in parallel (the shared schema applies once).

The database backend is configuration, not target identity: a configured D1
database (CLOUDFLARE_D1_DATABASE) selects D1, everything else selects Neon.

A target is offered only when its required config is present: Vercel needs a
link, --project, or VERCEL_PROJECT (or an interactive run that can link);
Cloudflare needs CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID, and
CLOUDFLARE_PROJECT, plus any requiredEnv keys declared in
deploy.config.json. --target all covers only the available targets.

Options:
  --profile dev|prod   Backend profile to deploy (also read from $PROFILE).
                       Missing and interactive: arrow-key picker (default prod).
                       Missing and non-interactive: abort.
  --target vercel|cloudflare|all
                       Deploy targets; only valid with the prod profile
                       (dev has no deploy target). Defaults to vercel when
                       available, otherwise the first available target.
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
  const { values, positionals } = parseCliArgsOrExit(
    argv,
    {
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
    usage,
    { onError: fail },
  )
  if (values['sync-env'] && values['no-sync-env']) {
    fail('Conflicting --sync-env/--no-sync-env.')
  }
  if (values['apply-schema'] && values['no-apply-schema']) {
    fail('Conflicting --apply-schema/--no-apply-schema.')
  }
  const options = {
    profileFlag: values.profile ?? '',
    // Raw `--target`/positional values; resolved against availability in main.
    targetRaws: [...(values.target ?? [])],
    syncEnvFlag: values['sync-env'] ? 'yes' : values['no-sync-env'] ? 'no' : '',
    applySchemaFlag: values['apply-schema'] ? 'yes' : values['no-apply-schema'] ? 'no' : '',
    heartbeatFlag: values.heartbeat ?? '',
    projectFlag: values.project ?? '',
  }
  for (const positional of positionals) {
    if (positional === 'vercel') {
      // Legacy `deploy.sh vercel` positional: treat as --target vercel.
      options.targetRaws.push('vercel')
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
  // Validate the profile before probing availability: an invalid value or `dev`
  // (which has no deploy target) must report its own reason, not a missing link
  // or token.
  const seededProfile = options.profileFlag || process.env.PROFILE || ''
  if (seededProfile && seededProfile !== 'dev' && seededProfile !== 'prod') {
    fail('PROFILE is mandatory: pass --profile dev|prod, set $PROFILE, or run interactively.')
  }
  if (seededProfile === 'dev') {
    const label = options.targetRaws.length ? options.targetRaws.join(',') : DEFAULT_TARGET
    fail(`Target '${label}' supports only the prod profile; dev has no deploy target.`)
  }
  const config = await loadDeployConfig()
  const requiredEnv = requiredEnvFromConfig(config)
  const plugins = resolveConfiguredPlugins(config)
  const linkTargets = linkableTargetValues(plugins)
  // A target is available only when its required config resolves here, so the
  // picker and `--target` never offer a target this checkout cannot deploy.
  const availability = targetAvailability({ requiredEnv, projectFlag: options.projectFlag, linkTargets })
  const { flags, availableValues, entries } = planTargetSelection({ raws: options.targetRaws, availability })
  options.targetFlags = flags
  await deployWithTarget(options, { availableEntries: entries, availableValues, config, plugins, linkTargets })
}

async function deployWithTarget(options, { availableEntries, availableValues, config, plugins, linkTargets }) {
  const seeded = [...options.targetFlags]
  const targets = selectDefaultTargets(seeded, availableValues)
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
    const answers = await runDeployInterview(options, availableEntries)
    await runDeployTargets(answers.targets?.length ? answers.targets : targets, {
      profile: answers.profile,
      syncEnv: answers.syncEnv,
      applySchema: answers.applySchema,
      heartbeat: answers.heartbeat || 'skip',
      projectFlag: options.projectFlag,
      config,
      plugins,
      linkTargets,
    })
    return
  }
  const profileValue = resolveProfileSync(options.profileFlag)
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
  await runDeployTargets(targets, {
    profile: profileValue,
    syncEnv,
    applySchema,
    heartbeat,
    projectFlag: options.projectFlag,
    config,
    plugins,
    linkTargets,
  })
}

// Load the shared deploy-config loader (`deploy.config.mjs`), which reads the
// project-owned `deploy.config.json`; `{}` when the loader is absent so every
// reader falls back to its default.
async function loadDeployConfig() {
  if (!existsSync(join(ROOT_DIR, 'scripts', 'deploy.config.mjs'))) {
    return {}
  }
  return import('./deploy.config.mjs')
}

// Runs each selected target. The database backend is resolved from each
// target's config (never from the target name) and the schema apply is shared:
// it runs once up front whenever a selected target uses Neon; a D1-backed flow
// applies its own schema. Env sync is per target.
async function runDeployTargets(
  targets,
  { profile, syncEnv, applySchema, heartbeat, projectFlag, config, plugins, linkTargets },
) {
  // Fail fast on missing per-target env props before any deploy CLI (or the
  // shared schema apply) runs.
  const requiredEnv = requiredEnvFromConfig(config)
  for (const target of targets) {
    preflightDeploy({ target, requiredEnv, projectFlag, linkTargets })
  }
  const { backends, needsNeonSchema } = planDeployBackends(targets, target => loadTargetFileEnv(target))
  let schema = applySchema
  if (applySchema === 'yes' && needsNeonSchema) {
    logEvent({ action: 'neon_schema_apply' })
    runScript('apply-schema.mjs', { ...process.env, PROFILE: 'prod' })
    schema = 'done'
  }
  const runOne = async target => {
    const startedAt = Date.now()
    const backend = backends.get(target)
    logEvent({
      action: 'deploy_start',
      details: { target, backend, profile, sync_env: syncEnv, apply_schema: applySchema, heartbeat },
    })
    try {
      const url =
        target === 'cloudflare'
          ? await runCloudflareFlow({
              syncEnv,
              applySchema: backend === 'd1' ? applySchema : schema,
              backend,
              heartbeat,
              plugins,
            })
          : await runVercelFlow({
              profile,
              syncEnv,
              applySchema: schema,
              heartbeat,
              projectFlag,
              vercelProtection: config.vercelProtection,
              plugins,
            })
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
