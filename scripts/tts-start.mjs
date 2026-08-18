import { execFileSync, spawn } from 'node:child_process'
import path from 'node:path'
import { createInterface } from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'
import { fileURLToPath } from 'node:url'
import { parseEnvFile } from './db-config.mjs'

const backendDir = path.join(fileURLToPath(new URL('..', import.meta.url)), 'backend')
const setupSh = path.join(backendDir, 'setup.sh')

const env = {
  ...parseEnvFile(path.join(backendDir, '.env')),
  ...parseEnvFile(path.join(backendDir, '.env.dev')),
}
const port = env.TTS_PORT || '8000'
const host = env.TTS_HOST || '127.0.0.1'
const uvicornBin = path.join(backendDir, '.venv', 'bin', 'uvicorn')

if (!isSetupComplete()) {
  if (await confirmSetup()) {
    console.log('Running TTS setup…')
    execFileSync('bash', [setupSh], { stdio: 'inherit' })
    if (!isSetupComplete()) {
      console.error('Setup finished but .venv/bin/uvicorn is still missing. Run `npm run tts:setup` manually.')
      process.exit(1)
    }
  } else {
    console.log('Aborted: TTS setup not complete. Run `npm run tts:setup` first.')
    process.exit(1)
  }
}

try {
  execFileSync('bash', ['-c', `lsof -ti:${port} 2>/dev/null | xargs -r kill`], { stdio: 'inherit' })
} catch {
  // lsof unavailable; ignore
}

console.log(`Starting TTS backend on ${host}:${port}…`)
const child = spawn(uvicornBin, ['app.main:app', '--host', host, '--port', port], {
  cwd: backendDir,
  env: { ...process.env, ...env },
  stdio: 'inherit',
})
child.on('error', (error) => {
  console.error(`Failed to start uvicorn: ${error.message}`)
  process.exit(1)
})
child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal)
    return
  }
  process.exit(code ?? 0)
})

function isSetupComplete() {
  try {
    execFileSync('bash', [setupSh, '--check'], { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

async function confirmSetup() {
  if (!input.isTTY) return false
  const rl = createInterface({ input, output })
  try {
    const answer = await rl.question(
      'TTS setup not complete (missing .venv/bin/uvicorn). Run `npm run tts:setup` now? [y/N] ',
    )
    return /^y(es)?$/i.test(answer.trim())
  } finally {
    rl.close()
  }
}