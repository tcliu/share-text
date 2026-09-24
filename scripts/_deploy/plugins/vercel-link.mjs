#!/usr/bin/env node
// _deploy/plugins/vercel-link.mjs — link the checkout to a Vercel project:
// resolve the name (--project, then $VERCEL_PROJECT / .env files, then an
// interactive prompt persisted to the overlay), confirm a switch, create the
// remote project when absent, and link. A matching link (or nothing requested
// on a linked checkout) keeps the existing link untouched.
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseEnvFile } from '../../env-file.mjs'
import { logEvent } from '../../log-event.mjs'
import { ask, c, promptYesNo } from '../../_terminal.mjs'
import { withPrompt } from '../../lib/prompt-queue.mjs'
import { loadTargetEnv } from '../../lib/target-env.mjs'
import { checkVercelAuth, runVercelCli } from '../../_vercel-cli.mjs'
import {
  decideLinkAction,
  defaultProjectName,
  normalizeProjectName,
  resolveProjectName,
} from '../../vercel-project.mjs'
import { ROOT_DIR, fail } from '../core.mjs'
import { persistEnvValue } from '../env-overlay.mjs'

function linkedProjectName() {
  try {
    const data = JSON.parse(readFileSync(join(ROOT_DIR, '.vercel', 'project.json'), 'utf8'))
    return String(data.projectName || '')
  } catch {
    return ''
  }
}

function mergedProjectEnv() {
  return loadTargetEnv('vercel', ROOT_DIR)
}

function packageDefaultProjectName() {
  try {
    const data = JSON.parse(readFileSync(join(ROOT_DIR, 'package.json'), 'utf8'))
    return defaultProjectName(data.name)
  } catch {
    return ''
  }
}

async function promptProjectName() {
  const fallback = packageDefaultProjectName()
  const hint = fallback ? ` [${fallback}]` : ''
  for (;;) {
    const answer = await withPrompt(() => ask(`${c.cyan}Vercel project name${c.reset}${hint}: `, process.stderr))
    const raw = String(answer ?? '').trim()
    if (raw.toLowerCase() === 'q') {
      fail('Deploy cancelled.')
    }
    const name = normalizeProjectName(raw || fallback)
    if (name) {
      return name
    }
    console.error(`Invalid project name ${JSON.stringify(raw)}: use lowercase letters, numbers, and hyphens.`)
  }
}

function persistProjectName(name) {
  // Prefer the overlay that already carries VERCEL_PROJECT (.env.local in apps
  // that keep the link slug out of the synced env); default .env.vercel. All
  // syncs exclude the local-only link slug, so either file is safe.
  const vercelFile = join(ROOT_DIR, '.env.vercel')
  const localFile = join(ROOT_DIR, '.env.local')
  const hasKey = file => {
    try {
      return String(parseEnvFile(file).VERCEL_PROJECT || '').trim() !== ''
    } catch {
      return false
    }
  }
  const useLocal = hasKey(localFile) && !hasKey(vercelFile)
  persistEnvValue(useLocal ? localFile : vercelFile, useLocal ? '.env.local' : '.env.vercel', 'VERCEL_PROJECT', name)
}

function ensureRemoteProject(name) {
  const inspect = runVercelCli(['projects', 'inspect', name], { capture: true })
  if (inspect.status === 0) {
    return
  }
  const created = runVercelCli(['projects', 'add', name])
  if (created.status !== 0) {
    logEvent({ action: 'vercel_project_create_error', details: { project: name, exit_code: created.status } })
    throw new Error(`Failed to create Vercel project ${name}. Create it in the dashboard and retry.`)
  }
  logEvent({ action: 'vercel_project_create', details: { project: name } })
}

export async function ensureVercelLink(projectFlag) {
  const projectFile = join(ROOT_DIR, '.vercel', 'project.json')
  const linked = existsSync(projectFile) ? normalizeProjectName(linkedProjectName()) : ''
  let requested = ''
  try {
    requested = resolveProjectName({ flag: projectFlag, env: mergedProjectEnv() })
  } catch (error) {
    // A stale or malformed VERCEL_PROJECT must not block a checkout that is
    // already linked and was not explicitly targeted with --project.
    if (projectFlag || !linked) {
      throw new Error(error?.message || String(error))
    }
    logEvent({ action: 'vercel_link_stale', details: { error: error?.message || error, linked, level: 'WARN' } })
  }
  const decision = decideLinkAction({ linked, requested })
  if (decision.action === 'keep') {
    return
  }
  checkVercelAuth()
  if (decision.action === 'switch') {
    if (process.stdin.isTTY) {
      const ok = await withPrompt(() =>
        promptYesNo(`Switch Vercel link from ${decision.from} to ${decision.name}`, true, process.stderr),
      )
      if (!ok) {
        fail('Deploy cancelled: Vercel link unchanged.')
      }
    } else if (!projectFlag) {
      // An env-only change must not silently re-point production for
      // non-interactive callers; the explicit flag is the opt-in.
      fail(
        `Refusing to switch the Vercel link from ${decision.from} to ${decision.name} non-interactively. Re-run with --project ${decision.name} to confirm.`,
      )
    }
  }
  let name = decision.name
  if (!name && process.stdin.isTTY) {
    name = await promptProjectName()
  }
  if (!name) {
    throw new Error(
      'Vercel project is not linked: pass --project <name>, set VERCEL_PROJECT in .env.vercel, or run interactively.',
    )
  }
  persistProjectName(name)
  ensureRemoteProject(name)
  console.log(
    decision.action === 'switch'
      ? `-> Switching link to Vercel project ${name}...`
      : `-> Linking to Vercel project ${name}...`,
  )
  const linkedNow = runVercelCli(['link', '--yes', '--project', name])
  if (linkedNow.status !== 0 || !existsSync(projectFile)) {
    logEvent({ action: 'vercel_link_error', details: { project: name, exit_code: linkedNow.status } })
    throw new Error(`Failed to link Vercel project ${name}. Run 'vercel link' from the repo root and retry.`)
  }
  logEvent({ action: 'vercel_link', details: { project: name, switched: decision.action === 'switch' } })
}

export const vercelLinkPlugin = {
  name: 'vercel-link',
  target: 'vercel',
  steps: ctx => [{ name: 'link', phase: 'link', run: () => ensureVercelLink(ctx.projectFlag) }],
}
