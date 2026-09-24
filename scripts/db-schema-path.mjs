#!/usr/bin/env node
// db-schema-path.mjs — SQL schema-source path helpers, free of the Neon
// dependency so callers that are not DB clients (the deploy interview) can
// import them without installing `@neondatabase/serverless`.
import { existsSync } from 'node:fs'
import { join } from 'node:path'

// Absolute path of the schema source both apply flows read (apply-schema.mjs
// for Neon/SQLite, apply-d1-schema.mjs for D1). `root` is injectable so tests
// can point at a fixture dir; production callers omit it (repo root).
export function neonSchemaPath(root = process.cwd()) {
  return join(root, 'sql', 'schema.sql')
}

// Whether there is a schema file to apply: without one the deploy interview
// skips the apply-schema question instead of asking it.
export function hasNeonSchema(root) {
  try {
    return existsSync(neonSchemaPath(root))
  } catch {
    return false
  }
}
