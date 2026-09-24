#!/usr/bin/env node
// _deploy/interview.mjs — interactive deploy interview: targets, profile, env
// sync, apply schema, heartbeat. Built on the shared pickers and the
// interactive shell.
import { logEvent } from '../log-event.mjs'
import { hasNeonSchema } from '../db-schema-path.mjs'
import { HEARTBEAT_CHOICES, renderOptionPicker, shouldAskHeartbeat } from '../lib/heartbeat.mjs'
import { renderList } from '../_pickers.mjs'
import { c } from '../_terminal.mjs'
import { interactiveShell } from '../_interactive-shell.mjs'
import { ROOT_DIR, fail } from './core.mjs'
import { DEFAULT_TARGET, TARGETS } from './registry.mjs'

export const PROFILES = [
  { value: 'dev', description: 'Local SQLite backend (ephemeral storage on Vercel)' },
  { value: 'prod', description: 'Neon Postgres via DATABASE_URL (syncs the target env first)' },
]

// Interactive defaults: every interview question resolves on Enter.
const DEFAULT_PROFILE = 'prod'
const DEFAULT_CONFIRM = 'yes'

const SYNC_ENV_CHOICES = [
  { value: 'yes', label: 'Yes', description: 'sync the target env file first' },
  { value: 'no', label: 'No', description: 'dashboard env already carries PROFILE=prod' },
]

const APPLY_SCHEMA_CHOICES = [
  { value: 'yes', label: 'Yes', description: 'apply sql/schema.sql to the database' },
  { value: 'no', label: 'No', description: 'schema already applied' },
]

function renderProfilePicker() {
  return renderList({
    hint: 'Up/Down: move | Enter: confirm (default prod) | q: cancel',
    formatRow: item => `${c.green}${item.value}${c.reset} ${c.gray}(${item.description})${c.reset}`,
  })
}

function renderTargetsPicker() {
  return (entries, state) => {
    const lines = []
    for (let i = 0; i < entries.length; i++) {
      const item = entries[i]
      const cursor = i === state.cursor ? `${c.cyan}>${c.reset}` : ' '
      const mark = state.selected.has(i) ? `${c.green}[x]${c.reset}` : '[ ]'
      lines.push(` ${cursor} ${mark} ${c.green}${item.value}${c.reset} ${c.gray}(${item.description})${c.reset}`)
    }
    lines.push('', `${c.dim}Up/Down: move | Space: toggle | Enter: confirm | q: cancel${c.reset}`)
    return lines
  }
}

// Linear interview: target -> profile -> sync-env -> apply-schema -> heartbeat
// -> exit. Flag/env seeds skip their node; q/Ctrl-C aborts via fail.
// Non-interactive callers never enter the graph.
function buildDeployGraph() {
  const graph = {
    target: {
      message: 'Select deploy targets (space to toggle, enter to confirm):',
      async process(ctx) {
        const valid = Array.isArray(ctx.targets) && ctx.targets.length > 0
        if (!valid || !ctx.targets.every(value => TARGETS.some(entry => entry.value === value))) {
          const picked = await ctx.selectMany(TARGETS, {
            initialSelected: [0],
            render: renderTargetsPicker(),
          })
          if (!picked || picked.length === 0) {
            fail('Deploy cancelled.')
          }
          ctx.targets = picked.map(item => item.value)
        }
        return graph.profile
      },
    },
    profile: {
      message: 'Select deploy profile:',
      async process(ctx) {
        if (ctx.profile !== 'dev' && ctx.profile !== 'prod') {
          const picked = await ctx.selectOne(PROFILES, {
            defaultValue: DEFAULT_PROFILE,
            render: renderProfilePicker(),
          })
          if (!picked) {
            fail('Deploy cancelled.')
          }
          ctx.profile = picked.value
        }
        if (ctx.profile !== 'prod') {
          fail(
            `Target '${(ctx.targets || [DEFAULT_TARGET]).join(',')}' supports only the prod profile; dev has no deploy target.`,
          )
        }
        return graph.syncEnv
      },
    },
    syncEnv: {
      message: 'Sync the target env file before deploy?',
      async process(ctx) {
        if (ctx.syncEnv !== 'yes' && ctx.syncEnv !== 'no') {
          const picked = await ctx.selectOne(SYNC_ENV_CHOICES, {
            defaultValue: DEFAULT_CONFIRM,
            render: renderOptionPicker(),
          })
          if (!picked) {
            fail('Deploy cancelled.')
          }
          ctx.syncEnv = picked.value
        }
        return graph.applySchema
      },
    },
    applySchema: {
      message: 'Apply sql/schema.sql to the Neon database before deploy?',
      async process(ctx) {
        if (ctx.applySchema !== 'yes' && ctx.applySchema !== 'no') {
          // No schema file, no question: asking would offer a dead choice
          // (both apply flows read sql/schema.sql and fail without it).
          if (!hasNeonSchema(ROOT_DIR)) {
            ctx.applySchema = 'skip'
            logEvent({ action: 'neon_schema_skip', details: { reason: 'missing sql/schema.sql' } })
          } else {
            const picked = await ctx.selectOne(APPLY_SCHEMA_CHOICES, {
              defaultValue: DEFAULT_CONFIRM,
              render: renderOptionPicker(),
            })
            if (!picked) {
              fail('Deploy cancelled.')
            }
            ctx.applySchema = picked.value
          }
        }
        // Bypass the heartbeat node when there is nothing to ask: the
        // interview chrome prints every entered node's message, so entering
        // it just to skip would show a phantom question.
        if (!shouldAskHeartbeat({ heartbeat: ctx.heartbeat })) {
          if (!ctx.heartbeat) {
            ctx.heartbeat = 'skip'
          }
          return null
        }
        return graph.heartbeat
      },
    },
    heartbeat: {
      message: 'Sync the cron-job.org auto-scan heartbeat?',
      async process(ctx) {
        // An explicit flag always reaches the step. Otherwise skip without
        // prompting when there is nothing to wire: no cron endpoint in the
        // app, or no operator API key to manage the job with.
        if (!shouldAskHeartbeat({ heartbeat: ctx.heartbeat })) {
          if (!ctx.heartbeat) {
            ctx.heartbeat = 'skip'
          }
          return null
        }
        const picked = await ctx.selectOne(HEARTBEAT_CHOICES, {
          defaultValue: 'cron-job',
          render: renderOptionPicker('default cron-job.org'),
        })
        if (!picked) {
          fail('Deploy cancelled.')
        }
        ctx.heartbeat = picked.value
        return null
      },
    },
  }
  return graph
}

export async function runDeployInterview(options) {
  const graph = buildDeployGraph()
  return interactiveShell(graph.target, {
    options: {
      ctx: {
        targets: options.targetFlags.length > 0 ? [...options.targetFlags] : [],
        profile: options.profileFlag || process.env.PROFILE || '',
        syncEnv: options.syncEnvFlag || '',
        applySchema: options.applySchemaFlag || '',
        heartbeat: options.heartbeatFlag || '',
      },
      output: process.stderr,
    },
    chrome: { cancelText: `${c.yellow}Deploy cancelled.${c.reset}` },
  })
}
