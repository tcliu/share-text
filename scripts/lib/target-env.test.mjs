import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  loadTargetEnv,
  loadTargetEnvFiles,
  loadTargetFileEnv,
  loadTargetOperatorEnv,
  targetOverlayFile,
  targetSourceFiles,
  targetSourceLabel,
} from './target-env.mjs'

function fixture(files) {
  const dir = mkdtempSync(join(tmpdir(), 'target-env-'))
  for (const [name, content] of Object.entries(files)) {
    writeFileSync(join(dir, name), content)
  }
  return dir
}

describe('loadTargetEnv', () => {
  it('overlays .env.prod with the target file, shell wins', () => {
    const dir = fixture({
      '.env.prod': 'SHARED=prod\nSHARED_ONLY=prod\n',
      '.env.cloudflare': 'SHARED=cf\nCF_ONLY=cf\n',
      '.env.vercel': 'SHARED=vercel\n',
    })
    const cf = loadTargetEnv('cloudflare', dir)
    expect(cf.SHARED).toBe('cf')
    expect(cf.CF_ONLY).toBe('cf')
    expect(cf.SHARED_ONLY).toBe('prod')
    const vercel = loadTargetEnv('vercel', dir)
    expect(vercel.SHARED).toBe('vercel')
    expect(vercel.CF_ONLY).toBeUndefined()
  })

  it('includes .env.local (operator tokens) below shell', () => {
    const dir = fixture({
      '.env.prod': 'SHARED=prod\n',
      '.env.local': 'SHARED=local\nLOCAL_TOKEN=t\n',
      '.env.cloudflare': 'SHARED=cf\n',
    })
    expect(loadTargetEnv('cloudflare', dir).SHARED).toBe('cf')
    expect(loadTargetEnv('cloudflare', dir).LOCAL_TOKEN).toBe('t')
  })

  it('sync universe is .env.prod + overlay only (never .env/.env.local/shell)', () => {
    const dir = fixture({
      '.env': 'DEV_ONLY=1\nSHARED=dev\n',
      '.env.local': 'LOCAL_TOKEN=t\nSHARED=local\n',
      '.env.prod': 'SHARED=prod\nPROD_ONLY=p\n',
      '.env.cloudflare': 'SHARED=cf\n',
    })
    const files = loadTargetFileEnv('cloudflare', dir)
    expect(files).toEqual({ SHARED: 'cf', PROD_ONLY: 'p' })
  })

  it('falls back to the vercel overlay for unknown targets', () => {
    expect(targetOverlayFile('nope')).toBe('.env.vercel')
    expect(targetSourceFiles('nope')).toEqual(['.env.prod', '.env.vercel'])
  })

  it('names the per-target overlays', () => {
    expect(targetOverlayFile('vercel')).toBe('.env.vercel')
    expect(targetOverlayFile('cloudflare')).toBe('.env.cloudflare')
    expect(targetSourceFiles('cloudflare')).toEqual(['.env.prod', '.env.cloudflare'])
  })

  it('names each target push universe and its label', () => {
    expect(targetSourceFiles('vercel')).toEqual(['.env.vercel'])
    expect(targetSourceLabel('vercel')).toBe('.env.vercel')
    expect(targetSourceLabel('cloudflare')).toBe('.env.prod + .env.cloudflare')
  })

  it('excludes .env.prod from the vercel push universe', () => {
    const dir = fixture({ '.env.prod': 'PROD_ONLY=p\n', '.env.vercel': 'V=1\n' })
    expect(loadTargetFileEnv('vercel', dir)).toEqual({ V: '1' })
  })

  it('merges every file layer without the shell', () => {
    const dir = fixture({ '.env': 'A=env\n', '.env.local': 'B=local\n', '.env.prod': 'C=prod\n' })
    expect(loadTargetEnvFiles('vercel', dir)).toEqual({ A: 'env', B: 'local', C: 'prod' })
  })

  it('reads the operator layer as .env.local overlaid by the shell', () => {
    const dir = fixture({ '.env.local': 'LOCAL_ONLY=t\n', '.env.prod': 'SYNCED_ONLY=p\n' })
    const operator = loadTargetOperatorEnv(dir)
    expect(operator.LOCAL_ONLY).toBe('t')
    expect(operator.SYNCED_ONLY).toBeUndefined()
  })
})
