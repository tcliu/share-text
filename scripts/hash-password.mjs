#!/usr/bin/env node
import { randomBytes, scryptSync } from 'node:crypto'

// The password is read from ADMIN_PASSWORD or stdin, never argv: argv is
// visible in the process table and shell history.
function usage() {
  console.error('Usage: node scripts/hash-password.mjs')
  console.error('Reads the password from ADMIN_PASSWORD or stdin and prints a scrypt hash for ADMIN_PASSWORD_HASH.')
  console.error("  ADMIN_PASSWORD=secret node scripts/hash-password.mjs")
  console.error("  printf %s 'secret' | node scripts/hash-password.mjs")
  process.exit(1)
}

function hashPassword(password) {
  const salt = randomBytes(16)
  const derived = scryptSync(password, salt, 32)
  return `scrypt$${salt.toString('base64')}$${derived.toString('base64')}`
}

async function readStdin() {
  const chunks = []
  for await (const chunk of process.stdin) {
    chunks.push(chunk)
  }
  return Buffer.concat(chunks).toString('utf8')
}

let password = process.env.ADMIN_PASSWORD
if (!password) {
  if (process.stdin.isTTY) {
    console.error('Reading password from stdin; press Ctrl-D when done.')
  }
  password = (await readStdin()).replace(/\r?\n$/, '')
}
if (!password) {
  usage()
}

console.log(hashPassword(password))
