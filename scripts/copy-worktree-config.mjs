#!/usr/bin/env node
import { c } from './_terminal.mjs'
import { interactiveShell } from './_interactive-shell.mjs'
import { CHECKLIST_HINT, renderList } from './_pickers.mjs'
import { errorMessage, logEvent } from './log-event.mjs'
import { copyDevFiles, listCopyTargets, readDevTag, resolveWorktreesDir } from './_worktrees.mjs'

export { copyDevFiles }

// DEV_TAG is read once per target and captured in the renderer: the picker
// redraws on every keystroke, and re-reading .env.local per row per redraw
// is needless filesystem work.
function renderWorktreePicker(devTags) {
  return renderList({
    checkboxes: true,
    hint: CHECKLIST_HINT,
    formatRow: item => {
      const devTag = devTags.get(item.path)
      const suffix = devTag ? ` DEV_TAG=${devTag}` : ''
      return `${item.name} ${c.gray}(${item.path}${suffix})${c.reset}`
    },
  })
}

function collectDevTags(worktrees) {
  return new Map(worktrees.map(item => [item.path, readDevTag(item.path)]))
}

// Single-question interview: pick -> exit. q/Ctrl-C (or confirming an
// empty selection) yields no selection; the caller treats it as cancel.
// Effect code stays outside the graph, mirroring deploy.mjs
// (runDeployInterview collects answers, runDeployFlow acts on them).
function buildCopyGraph(devTags) {
  const graph = {
    pick: {
      message: 'Select worktrees to copy config to:',
      async process(ctx) {
        ctx.selected = await ctx.selectMany(ctx.worktrees, {
          render: renderWorktreePicker(devTags),
        })
        return null
      },
    },
  }
  return graph
}

async function runCopyInterview(worktrees) {
  const graph = buildCopyGraph(collectDevTags(worktrees))
  return interactiveShell(graph.pick, {
    options: { ctx: { worktrees, selected: [] } },
    chrome: { cancelText: `${c.yellow}Cancelled.${c.reset}` },
  })
}

async function main() {
  const root = process.cwd()
  const worktrees = listCopyTargets(root, resolveWorktreesDir(root))

  if (worktrees.length === 0) {
    console.log(`${c.yellow}No worktrees found to copy to.${c.reset}`)
    return
  }

  const { selected } = await runCopyInterview(worktrees)
  if (selected.length === 0) return

  for (const worktree of selected) {
    console.log(`${c.green}Copying config to${c.reset} ${worktree.name}...`)
    const startedAt = Date.now()
    logEvent({
      action: 'worktree_copy_config_start',
      details: { name: worktree.name, path: worktree.path },
    })
    let copied
    try {
      copied = copyDevFiles(root, worktree.path)
    } catch (error) {
      logEvent({
        action: 'worktree_copy_config_error',
        details: {
          name: worktree.name,
          path: worktree.path,
          elapsed_ms: Date.now() - startedAt,
          error: errorMessage(error),
        },
      })
      throw error
    }
    logEvent({
      action: 'worktree_copy_config_end',
      details: {
        name: worktree.name,
        path: worktree.path,
        elapsed_ms: Date.now() - startedAt,
        files_copied: copied.length,
      },
    })
    if (copied.length === 0) {
      console.log(`  ${c.dim}(nothing to copy — already present)${c.reset}`)
    } else {
      for (const file of copied) {
        console.log(`  ${c.gray}${file}${c.reset}`)
      }
    }
  }
  console.log(`${c.green}Done.${c.reset}`)
}

main().catch(error => {
  console.error(`${c.red}${error.message}${c.reset}`)
  process.exit(1)
})
