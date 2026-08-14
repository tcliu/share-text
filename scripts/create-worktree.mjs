import { execFileSync } from 'node:child_process'
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import path from 'node:path'
import { parse as parseDotenv } from 'dotenv'

const branch = process.argv[2]
if (!branch) {
  console.error('Usage: node scripts/create-worktree.mjs <branch>')
  process.exit(1)
}
if (
  !/^[a-zA-Z0-9._/-]+$/.test(branch) ||
  branch.startsWith('/') ||
  branch.endsWith('/') ||
  branch.includes('..')
) {
  console.error(`Invalid branch name: ${branch}`)
  process.exit(1)
}

const root = process.cwd()
if (path.resolve(root).split(path.sep).includes('.worktrees')) {
  console.error('Run this script from the default worktree, not a nested worktree.')
  process.exit(1)
}

const worktreeDir = path.join(root, '.worktrees', branch)
if (existsSync(worktreeDir)) {
  console.error(`Worktree already exists: ${worktreeDir}`)
  process.exit(1)
}

mkdirSync(path.dirname(worktreeDir), { recursive: true })
execFileSync('git', ['worktree', 'add', worktreeDir, '-b', branch], { stdio: 'inherit' })

try {
  copyDevFiles(root, worktreeDir)
  setDevTag(worktreeDir, branch)
} catch (error) {
  console.error(`Failed to set up worktree: ${error.message}`)
  cleanupWorktree(worktreeDir, branch)
  process.exit(1)
}

console.log(`\nWorktree created: ${worktreeDir}`)
console.log(`DEV_TAG=${branch} set in ${path.join(worktreeDir, '.env.dev')}`)

function copyDevFiles(sourceRoot, targetRoot) {
  const sourceEnv = path.join(sourceRoot, '.env.dev')
  const targetEnv = path.join(targetRoot, '.env.dev')
  if (existsSync(sourceEnv) && !existsSync(targetEnv)) {
    copyFileSync(sourceEnv, targetEnv)
  }
  copyDirectoryContents(path.join(sourceRoot, '.data'), path.join(targetRoot, '.data'))
}

function copyDirectoryContents(sourceDir, targetDir) {
  if (!existsSync(sourceDir)) return
  mkdirSync(targetDir, { recursive: true })
  for (const entry of readdirSync(sourceDir)) {
    const source = path.join(sourceDir, entry)
    const target = path.join(targetDir, entry)
    if (statSync(source).isDirectory()) {
      copyDirectoryContents(source, target)
    } else if (!existsSync(target)) {
      copyFileSync(source, target)
    }
  }
}

function cleanupWorktree(worktreeDir, branchName) {
  try {
    execFileSync('git', ['worktree', 'remove', '--force', worktreeDir], { stdio: 'inherit' })
  } catch {
    console.error(`Failed to remove incomplete worktree: ${worktreeDir}`)
  }
  try {
    execFileSync('git', ['branch', '-D', branchName], { stdio: 'inherit' })
  } catch {
    console.error(`Failed to delete branch: ${branchName}`)
  }
}

function setDevTag(worktreeRoot, tag) {
  const filePath = path.join(worktreeRoot, '.env.dev')
  const content = existsSync(filePath) ? readFileSync(filePath, 'utf8') : ''
  const values = parseDotenv(content)
  const entry = `DEV_TAG=${tag}`
  if (!Object.prototype.hasOwnProperty.call(values, 'DEV_TAG')) {
    writeFileSync(filePath, content.replace(/\s*$/, '') + (content.trim() ? '\n' : '') + `${entry}\n`)
    return
  }
  const output = content.split(/\r?\n/).map(line => {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) return line
    const separatorIndex = trimmed.indexOf('=')
    if (separatorIndex === -1) return line
    if (trimmed.slice(0, separatorIndex).trim() !== 'DEV_TAG') return line
    return entry
  })
  writeFileSync(filePath, output.join('\n') + '\n')
}
