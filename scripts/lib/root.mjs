#!/usr/bin/env node
// lib/root.mjs — the repository root, resolved once from this module's own
// location so every script agrees on the same path regardless of the process
// cwd. Callers that need a different root (tests, fixture dirs) keep their own
// injectable default; production callers use this constant.
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const LIB_DIR = dirname(fileURLToPath(import.meta.url))
export const ROOT = join(LIB_DIR, '..', '..')
