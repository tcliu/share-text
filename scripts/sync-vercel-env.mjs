#!/usr/bin/env node
// Syncs the keys in SOURCE_FILES (.env.vercel) to the Vercel production env.
// An empty local value is skipped so the remote value survives — blank a key
// in the Vercel dashboard instead. Pass --prune to remove remote keys that
// are absent from .env.vercel.
//
// Values are fed to `vercel env add` on stdin, never on the command line, so
// they never appear in the process argv where other local processes can read
// them.

import { spawn } from 'node:child_process'
import { join } from 'node:path'
import { parseArgs } from 'node:util'
import { echoCommand } from './_run.mjs'
import { parseEnvFile } from './env-file.mjs'
import { errorMessage, logEvent } from './log-event.mjs'

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
const SOURCE_FILES = ['.env.vercel']
const STARTED_AT = Date.now()

function loadDesiredEnv() {
  return SOURCE_FILES.reduce((merged, file) => ({ ...merged, ...parseEnvFile(join(process.cwd(), file)) }), {})
}

function spawnVercelBin(bin, args, { input } = {}) {
  echoCommand(bin, args)
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, {
      cwd: process.cwd(),
      stdio: [input === undefined ? 'ignore' : 'pipe', 'pipe', 'pipe'],
      env: process.env,
    })

    let stdout = ''
    let stderr = ''

    child.stdout.on('data', chunk => {
      stdout += chunk
    })
    child.stderr.on('data', chunk => {
      stderr += chunk
    })

    child.on('error', reject)
    child.on('close', code => {
      if (code === 0) {
        resolve(stdout)
      } else {
        const message = stderr.trim() || stdout.trim() || `vercel exited with code ${code}`
        reject(new Error(message))
      }
    })

    if (input !== undefined) {
      // A closed stdin (spawn failure) surfaces on the child 'error' event.
      child.stdin.on('error', () => {})
      child.stdin.end(input)
    }
  })
}

async function runVercelCommand(args, options) {
  try {
    return await spawnVercelBin('vercel', args, options)
  } catch (error) {
    if (error.code === 'ENOENT') {
      const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx'
      return await spawnVercelBin(npx, ['vercel@latest', ...args], options)
    }
    throw error
  }
}

async function listVercelEnvKeys() {
  const output = await runVercelCommand(['env', 'ls', TARGET, '--format', 'json'])
  const parsed = JSON.parse(output)
  return new Set((parsed.envs || []).map(entry => entry.key))
}

async function upsertVercelEnv(key, value) {
  // The value goes on stdin: `--value` would expose it in the process argv.
  await runVercelCommand(['env', 'add', key, TARGET, '--force', '--yes'], { input: value })
}

async function removeVercelEnv(key) {
  await runVercelCommand(['env', 'rm', key, TARGET, '--yes'])
}

async function main() {
  const desiredEnv = loadDesiredEnv()
  const desiredKeys = new Set(Object.keys(desiredEnv))
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
    console.log(`synced ${key}`)
    syncedCount += 1
  }

  const orphans = [...existingKeys].filter(key => !desiredKeys.has(key))
  let removedCount = 0

  if (PRUNE) {
    for (const key of orphans) {
      await removeVercelEnv(key)
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
