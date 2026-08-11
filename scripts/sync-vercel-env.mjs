import { spawn } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { parse as parseDotenv } from 'dotenv'

const TARGET = 'production'
const SOURCE_FILES = ['.env', '.env.vercel']

function parseEnvFile(filePath) {
  if (!existsSync(filePath)) return {}

  const content = readFileSync(filePath, 'utf8')
  return parseDotenv(content)
}

function loadDesiredEnv() {
  return SOURCE_FILES.reduce(
    (merged, filePath) => ({
      ...merged,
      ...parseEnvFile(filePath),
    }),
    {},
  )
}

async function runVercelCommand(args) {
  return new Promise((resolve, reject) => {
    const child = spawn('vercel', args, {
      cwd: process.cwd(),
      stdio: ['ignore', 'pipe', 'pipe'],
      env: process.env,
    })

    let stdout = ''
    let stderr = ''

    child.stdout.on('data', chunk => {
      stdout += chunk
    })
    child.stderr.on('data', chunk => {
      stderr += chunk
    })

    child.on('error', reject)
    child.on('close', code => {
      if (code === 0) {
        resolve(stdout)
      } else {
        const message = stderr.trim() || stdout.trim() || `vercel exited with code ${code}`
        reject(new Error(message))
      }
    })
  })
}

async function listVercelEnvKeys() {
  const output = await runVercelCommand(['env', 'ls', TARGET, '--format', 'json'])
  const parsed = JSON.parse(output)
  return new Set((parsed.envs || []).map(entry => entry.key))
}

async function upsertVercelEnv(key, value) {
  await runVercelCommand(['env', 'add', key, TARGET, '--value', value, '--force', '--yes'])
}

async function removeVercelEnv(key) {
  await runVercelCommand(['env', 'rm', key, TARGET, '--yes'])
}

const desiredEnv = loadDesiredEnv()
const desiredKeys = new Set(Object.keys(desiredEnv))
const existingKeys = await listVercelEnvKeys()

for (const [key, value] of Object.entries(desiredEnv)) {
  await upsertVercelEnv(key, value)
  console.log(`synced ${key}`)
}

for (const key of existingKeys) {
  if (desiredKeys.has(key)) continue

  await removeVercelEnv(key)
  console.log(`removed ${key}`)
}

console.log(`Synced ${desiredKeys.size} env vars to Vercel ${TARGET}`)
