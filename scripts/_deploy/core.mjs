#!/usr/bin/env node
// _deploy/core.mjs — deploy pipeline core shared by every target: generic
// paths/script helpers, the fixed phase order, and the step runner. Kept
// dependency-light and free of target-specific code so targets and plugins can
// import it without a cycle.
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promptYesNo } from '../_terminal.mjs'
import { formatCommand } from '../_run.mjs'
import { errorMessage, logEvent } from '../log-event.mjs'
import { withPrompt } from '../lib/prompt-queue.mjs'

const MODULE_DIR = dirname(fileURLToPath(import.meta.url))
export const SCRIPT_DIR = join(MODULE_DIR, '..')
export const ROOT_DIR = join(SCRIPT_DIR, '..')

export function fail(message) {
  throw new Error(message)
}

export function formatElapsedTime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  if (minutes > 0) {
    return `${minutes}m${String(seconds).padStart(2, '0')}s`
  }
  return `${seconds}s`
}

// Run another script of this scripts/ directory with the same runtime.
export function runScript(script, env = process.env) {
  console.log(formatCommand('node', [`scripts/${script}`]))
  const result = spawnSync('node', [join(SCRIPT_DIR, script)], { cwd: ROOT_DIR, stdio: 'inherit', env })
  if ((result.status ?? 1) !== 0) {
    throw new Error(`scripts/${script} failed (exit ${result.status ?? 1}).`)
  }
}

// Order steps by a target's phase slots. Each target declares its own ordered
// slots (heartbeat runs before build on Cloudflare, after domains on Vercel);
// steps in the same slot keep their registration order. Steps whose phase is
// not among the target's slots are dropped.
export function assembleSteps(slots, steps) {
  return slots.flatMap(slot => steps.filter(step => step.phase === slot))
}

// Expand the selected plugins that are enabled for this context into their
// steps. `enabled` defaults to true; a self-gating plugin (heartbeat on
// CRONJOB_API_KEY) contributes nothing when its gate is closed.
export function pluginSteps(plugins, ctx) {
  return plugins
    .filter(plugin => !plugin.enabled || plugin.enabled(ctx))
    .flatMap(plugin => plugin.steps(ctx))
}

// Step isolation: each deploy step runs through here so one failure does not
// abort the whole run. Interactive callers are asked whether to continue
// (default No); non-interactive callers fail fast with the step name.
export async function runSteps(target, steps) {
  for (const step of steps) {
    const startedAt = Date.now()
    logEvent({ action: 'deploy_step_start', details: { target, step: step.name } })
    try {
      await step.run()
      logEvent({
        action: 'deploy_step_end',
        details: { target, step: step.name, elapsed_ms: Date.now() - startedAt },
      })
    } catch (error) {
      const message = errorMessage(error)
      logEvent({
        action: 'deploy_step_error',
        details: { target, step: step.name, elapsed_ms: Date.now() - startedAt, error: message },
      })
      if (process.stdin.isTTY) {
        const proceed = await withPrompt(() =>
          promptYesNo(`Step "${step.name}" failed: ${message}. Continue anyway`, false, process.stderr),
        )
        if (!proceed) {
          fail(`Deploy cancelled after step "${step.name}" failed.`)
        }
        logEvent({ action: 'deploy_step_continue', details: { target, step: step.name, level: 'WARN' } })
      } else {
        fail(`Step "${step.name}" failed: ${message}`)
      }
    }
  }
}
