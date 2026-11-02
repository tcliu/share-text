#!/usr/bin/env node
// Syncs the keys in SOURCE_FILES (.env.vercel) to the Vercel production env.
// An empty local value is skipped so the remote value survives — blank a key
// in the Vercel dashboard instead. Pass --prune to remove remote keys that
// are absent from .env.vercel.
//
// Values are fed to `vercel env add` on stdin, never on the command line, so
// they never appear in the process argv where other local processes can read
// them.

import { join } from 'node:path'
import { parseArgs } from 'node:util'
import { parseEnvFile } from './env-file.mjs'
import { ROOT as ROOT_DIR } from './lib/root.mjs'
import { missingTargetSources, targetSourceFiles } from './lib/target-env.mjs'
import { errorMessage, logEvent } from './log-event.mjs'
import { runVercelCliAsync } from './_vercel-cli.mjs'

let PRUNE = false
try {
  PRUNE = Boolean(
    parseArgs({ args: process.argv.slice(2), options: { prune: { type: 'boolean' } }, strict: true }).values.prune,
  )
} catch (error) {
  console.error(errorMessage(error))
  process.exit(2)
}

const TARGET = 'production'
const SOURCE_FILES = targetSourceFiles('vercel')
const STARTED_AT = Date.now()

function loadDesiredEnv() {
  return SOURCE_FILES.reduce((merged, file) => ({ ...merged, ...parseEnvFile(join(ROOT_DIR, file)) }), {})
}

async function listVercelEnvKeys() {
  const output = await runVercelCliAsync(['env', 'ls', TARGET, '--format', 'json'], { cwd: ROOT_DIR })
  const parsed = JSON.parse(output)
  return new Set((parsed.envs || []).map(entry => entry.key))
}

async function upsertVercelEnv(key, value) {
  // The value goes on stdin: `--value` would expose it in the process argv.
  await runVercelCliAsync(['env', 'add', key, TARGET, '--force', '--yes'], { cwd: ROOT_DIR, input: value })
}

async function removeVercelEnv(key) {
  await runVercelCliAsync(['env', 'rm', key, TARGET, '--yes'], { cwd: ROOT_DIR })
}

async function main() {
  // Fail closed: `parseEnvFile` yields {} for a missing file, so a checkout
  // without .env.vercel would make every remote key look orphaned and
  // `--prune` would delete the whole production environment.
  const missing = missingTargetSources('vercel', ROOT_DIR)
  if (missing.length > 0) {
    throw new Error(`Missing ${missing.join(', ')} at ${ROOT_DIR}: nothing to sync.`)
  }
  const desiredEnv = loadDesiredEnv()
  const desiredKeys = new Set(Object.keys(desiredEnv))
  if (PRUNE && desiredKeys.size === 0) {
    throw new Error(`Refusing to prune: ${SOURCE_FILES.join(', ')} defines no keys.`)
  }
  logEvent({
    action: 'env_sync_start',
    details: { target: TARGET, source: SOURCE_FILES.join(', '), keys: desiredKeys.size },
  })
  const existingKeys = await listVercelEnvKeys()

  let syncedCount = 0
  for (const [key, value] of Object.entries(desiredEnv)) {
    // Empty local values never blank the remote: fill the key in
    // .env.vercel and re-run the sync.
    if (!value) {
      console.log(`skipped ${key} (empty in .env.vercel; remote value kept)`)
      continue
    }
    await upsertVercelEnv(key, value)
    logEvent({ action: 'env_var_synced', details: { key } })
    console.log(`synced ${key}`)
    syncedCount += 1
  }

  const orphans = [...existingKeys].filter(key => !desiredKeys.has(key))
  let removedCount = 0

  if (PRUNE) {
    for (const key of orphans) {
      await removeVercelEnv(key)
      logEvent({ action: 'env_var_removed', details: { key } })
      console.log(`removed ${key}`)
      removedCount += 1
    }
  } else if (orphans.length > 0) {
    console.log(
      `Skipped ${orphans.length} unmanaged env var(s) (${orphans.join(', ')}). ` +
        'Re-run with --prune to remove them.',
    )
  }

  console.log(`Synced ${syncedCount} of ${desiredKeys.size} env vars to Vercel ${TARGET}`)
  logEvent({
    action: 'env_sync_end',
    details: {
      target: TARGET,
      elapsed_ms: Date.now() - STARTED_AT,
      synced: syncedCount,
      skipped: desiredKeys.size - syncedCount,
      removed: removedCount,
    },
  })
}

main().catch(error => {
  logEvent({
    action: 'env_sync_error',
    details: { target: TARGET, elapsed_ms: Date.now() - STARTED_AT, error: errorMessage(error) },
  })
  console.error(error?.message || error)
  process.exit(1)
})
