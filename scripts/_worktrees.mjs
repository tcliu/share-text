import { execFileSync } from 'node:child_process'
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import path from 'node:path'
import { parse as parseDotenv } from 'dotenv'

export function getWorktreesRoot(root = process.cwd()) {
  return path.join(root, '.worktrees')
}

export function getMainRoot(root = process.cwd()) {
  return execFileSync('git', ['rev-parse', '--show-toplevel'], {
    cwd: root,
    encoding: 'utf-8',
    stdio: 'pipe',
  }).trim()
}

export function getGitWorktrees(root = process.cwd()) {
  const output = execFileSync('git', ['worktree', 'list', '--porcelain'], {
    cwd: root,
    encoding: 'utf-8',
    stdio: 'pipe',
  })
  const worktrees = []
  let current = null

  for (const line of output.split('\n')) {
    if (line.startsWith('worktree ')) {
      if (current?.path) worktrees.push(current)
      current = { path: line.slice('worktree '.length) }
      continue
    }
    if (!current) continue
    if (line.startsWith('branch ')) {
      current.branch = line.slice('branch '.length).replace('refs/heads/', '')
      continue
    }
    if (line === '') {
      if (current.path) worktrees.push(current)
      current = null
    }
  }

  if (current?.path) worktrees.push(current)
  return worktrees.map(worktree => ({
    ...worktree,
    path: path.resolve(worktree.path),
    name: path.relative(getWorktreesRoot(root), path.resolve(worktree.path)),
  }))
}

export function hasGitEntry(dir) {
  return existsSync(path.join(dir, '.git'))
}

export function listNestedGitDirs(root = process.cwd()) {
  const worktreesRoot = getWorktreesRoot(root)
  if (!existsSync(worktreesRoot)) return []

  const results = []

  function scan(dir) {
    for (const entry of readdirSync(dir)) {
      if (entry === 'node_modules' || entry === '.vercel' || entry === '.svelte-kit') continue
      const full = path.join(dir, entry)
      if (!statSync(full).isDirectory()) continue
      if (hasGitEntry(full)) {
        results.push({
          path: path.resolve(full),
          name: path.relative(worktreesRoot, path.resolve(full)),
        })
        continue
      }
      scan(full)
    }
  }

  scan(worktreesRoot)
  return results.sort((a, b) => a.name.localeCompare(b.name))
}

export function listCopyTargets(root = process.cwd()) {
  return listNestedGitDirs(root)
}

export function listDeleteTargets(root = process.cwd()) {
  const registered = new Map(getGitWorktrees(root).map(worktree => [worktree.path, worktree]))
  return listNestedGitDirs(root).map(item => {
    const registeredEntry = registered.get(item.path)
    if (registeredEntry) return registeredEntry
    return {
      ...item,
      branch: readBranchFromGitDir(item.path),
      registered: false,
    }
  })
}

export function listRegisterTargets(root = process.cwd()) {
  const registered = new Set(getGitWorktrees(root).map(worktree => worktree.path))
  return listNestedGitDirs(root).filter(item => !registered.has(item.path))
}

export function readBranchFromGitDir(worktreePath) {
  try {
    return execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
      cwd: worktreePath,
      encoding: 'utf-8',
      stdio: 'pipe',
    }).trim()
  } catch {
    return null
  }
}

export function registerWorktree(root, worktreePath, branch) {
  execFileSync('git', ['worktree', 'add', worktreePath, '-b', branch], {
    cwd: root,
    stdio: 'pipe',
  })
}

export function removeWorktree(root, worktree) {
  const mainRoot = getMainRoot(root)
  if (path.resolve(worktree.path) === mainRoot) {
    return false
  }

  try {
    execFileSync('git', ['worktree', 'remove', '--force', worktree.path], {
      cwd: root,
      encoding: 'utf-8',
      stdio: 'pipe',
    })
    return true
  } catch {
    try {
      rmSync(worktree.path, { recursive: true, force: true })
      return true
    } catch {
      return false
    }
  }
}

export function deleteBranch(root, branch) {
  if (!branch) return false
  try {
    execFileSync('git', ['branch', '-D', branch], {
      cwd: root,
      encoding: 'utf-8',
      stdio: 'pipe',
    })
    return true
  } catch {
    return false
  }
}

export function isValidBranchName(name) {
  return (
    /^[a-zA-Z0-9._/-]+$/.test(name) &&
    !name.startsWith('/') &&
    !name.endsWith('/') &&
    !name.includes('..')
  )
}

export function setDevTag(worktreeRoot, tag) {
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

export function copyDevFiles(sourceRoot, targetRoot) {
  copyEnvDev(path.join(sourceRoot, '.env.dev'), path.join(targetRoot, '.env.dev'))
  copyEnvDev(path.join(sourceRoot, 'backend', '.env.dev'), path.join(targetRoot, 'backend', '.env.dev'))
  copyDirectoryContents(path.join(sourceRoot, '.data'), path.join(targetRoot, '.data'))
}

function copyEnvDev(sourceEnv, targetEnv) {
  if (existsSync(sourceEnv) && !existsSync(targetEnv)) {
    copyFileSync(sourceEnv, targetEnv)
  }
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

export function readDevTag(worktreeRoot) {
  const envPath = path.join(worktreeRoot, '.env.dev')
  if (!existsSync(envPath)) return null
  const content = readFileSync(envPath, 'utf8')
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const separatorIndex = trimmed.indexOf('=')
    if (separatorIndex === -1) continue
    if (trimmed.slice(0, separatorIndex).trim() === 'DEV_TAG') {
      return trimmed.slice(separatorIndex + 1).trim()
    }
  }
  return null
}
