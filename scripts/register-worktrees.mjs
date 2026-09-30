#!/usr/bin/env node
import { c } from './_terminal.mjs'
import { interactiveShell } from './_interactive-shell.mjs'
import { CHECKLIST_HINT, renderList } from './_pickers.mjs'
import { errorMessage, logEvent } from './log-event.mjs'
import { listRegisterTargets, registerWorktree, resolveWorktreesDir } from './_worktrees.mjs'

export { listRegisterTargets, registerWorktree }

function renderWorktreePicker() {
  return renderList({
    checkboxes: true,
    hint: CHECKLIST_HINT,
    formatRow: item => `${item.name} ${c.gray}(${item.path})${c.reset}`,
  })
}

// Single-question interview: pick -> exit. q/Ctrl-C (or confirming an
// empty selection) yields no selection; the caller treats it as cancel.
// Effect code stays outside the graph, mirroring deploy.mjs
// (runDeployInterview collects answers, runDeployFlow acts on them).
function buildRegisterGraph() {
  const graph = {
    pick: {
      message: 'Select directories to register as git worktrees:',
      async process(ctx) {
        ctx.selected = await ctx.selectMany(ctx.worktrees, {
          render: renderWorktreePicker(),
        })
        return null
      },
    },
  }
  return graph
}

async function runRegisterInterview(worktrees) {
  const graph = buildRegisterGraph()
  return interactiveShell(graph.pick, {
    options: { ctx: { worktrees, selected: [] } },
    chrome: { cancelText: `${c.yellow}Cancelled.${c.reset}` },
  })
}

async function main() {
  const root = process.cwd()
  const worktrees = listRegisterTargets(root, resolveWorktreesDir(root))

  if (worktrees.length === 0) {
    console.log(`${c.yellow}No unregistered worktrees found.${c.reset}`)
    return
  }

  const { selected } = await runRegisterInterview(worktrees)
  if (selected.length === 0) return

  for (const worktree of selected) {
    console.log(`${c.green}Registering${c.reset} ${worktree.name}...`)
    const startedAt = Date.now()
    logEvent({
      action: 'worktree_register_start',
      details: { name: worktree.name, path: worktree.path },
    })
    try {
      registerWorktree(root, worktree.path, worktree.name)
      logEvent({
        action: 'worktree_register_end',
        details: { name: worktree.name, path: worktree.path, elapsed_ms: Date.now() - startedAt },
      })
      console.log(`${c.green}Registered${c.reset} ${worktree.name}`)
    } catch (error) {
      logEvent({
        action: 'worktree_register_error',
        details: {
          name: worktree.name,
          path: worktree.path,
          elapsed_ms: Date.now() - startedAt,
          error: errorMessage(error),
        },
      })
      console.error(`${c.red}Failed to register${c.reset} ${worktree.name}: ${error.message}`)
    }
  }
  console.log(`${c.green}Done.${c.reset}`)
}

main().catch(error => {
  console.error(`${c.red}${error.message}${c.reset}`)
  process.exit(1)
})
