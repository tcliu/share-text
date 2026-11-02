#!/usr/bin/env node

// palette.mjs — the ANSI palette shared by the CLI helpers.
//
// Its own module so `_terminal.mjs` (prompts, arg parsing) and `_tui.mjs`
// (full-screen primitives) can both read it without importing each other:
// `_terminal` re-exports the width helpers from `_tui`, so a `_tui` → `_terminal`
// import for the palette would close an A → B → A cycle.

export const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
  reverse: '\x1b[7m',
  bgCyan: '\x1b[46m',
  black: '\x1b[30m',
}
