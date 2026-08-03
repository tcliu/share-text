import { randomBytes, scryptSync } from 'node:crypto'

function usage() {
  console.error('Usage: node scripts/hash-password.mjs <password>')
  console.error('Prints a scrypt hash for ADMIN_PASSWORD_HASH.')
  process.exit(1)
}

const password = process.argv[2]
if (!password) {
  usage()
}

const salt = randomBytes(16)
const derived = scryptSync(password, salt, 32)
console.log(`scrypt$${salt.toString('base64')}$${derived.toString('base64')}`)
