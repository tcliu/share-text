// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { formatCommand, maskCommandLine } from './_run.mjs'

const argvWithValue = (key, value = 's3cr3t', extra = []) => ['env', 'add', key, 'production', '--value', value, ...extra]

describe('formatCommand', () => {
  it('masks the --value of a secret-named key', () => {
    expect(formatCommand('vercel', argvWithValue('SESSION_SECRET', 's3cr3t', ['--force']))).toBe(
      'vercel env add SESSION_SECRET production --value *** --force',
    )
  })

  it.each([
    'SESSION_SECRET',
    'ADMIN_PASSWORD',
    'ADMIN_PASSWORD_HASH',
    'CRON_SECRET',
    'VERCEL_TOKEN',
    'DATABASE_URL',
    'PROJECT_CATALOG_DATABASE_URL',
    'API_KEY',
    'ENCRYPTION_KEY',
  ])('treats %s as secret', key => {
    expect(formatCommand('vercel', argvWithValue(key))).toBe(`vercel env add ${key} production --value ***`)
  })

  it.each(['PROFILE', 'APP_BASE_URL', 'SCHEMA_NAME', 'ADMIN_USERNAME', 'VERCEL_TEAM_ID', 'MAX_DOCUMENTS_PER_IP'])(
    'leaves %s values visible',
    key => {
      expect(formatCommand('vercel', argvWithValue(key, 'plain'))).toBe(
        `vercel env add ${key} production --value plain`,
      )
    },
  )

  it('masks an inline secret flag and the value after a secret flag', () => {
    expect(formatCommand('curl', ['--token=abc123', '--secret', 'x'])).toBe('curl --token=*** --secret ***')
  })

  it('keeps a boundary-scoped non-secret key visible', () => {
    expect(formatCommand('curl', ['--MONKEY=visible'])).toBe('curl --MONKEY=visible')
  })

  it('leaves ordinary commands untouched', () => {
    expect(formatCommand('deploy', ['--prod', '--yes'])).toBe('deploy --prod --yes')
  })

  it('fails closed when the key after add is missing or a flag', () => {
    expect(formatCommand('env', ['add', '--value'])).toBe('env add --value')
    expect(formatCommand('env', ['add', '--value', 's3cr3t'])).toBe('env add --value ***')
    expect(formatCommand('env', ['add', '--force', '--value', 's3cr3t'])).toBe('env add --force --value ***')
  })

  it('masks --value when no add positional is present', () => {
    expect(formatCommand('wrangler', ['pages', 'deploy', '--value', 's3cr3t'])).toBe('wrangler pages deploy --value ***')
  })

  it('masks the inline --value form', () => {
    expect(formatCommand('vercel', ['env', 'add', 'SESSION_SECRET', 'production', '--value=s3cr3t'])).toBe(
      'vercel env add SESSION_SECRET production --value=***',
    )
  })
})

describe('maskCommandLine', () => {
  it('masks secret flags and inline tokens on a command line', () => {
    expect(maskCommandLine('vercel env add SESSION_SECRET production --token=abc --secret x')).toBe(
      'vercel env add SESSION_SECRET production --token=*** --secret ***',
    )
  })

  it('masks the --value of a secret-named add key', () => {
    expect(maskCommandLine('vercel env add SESSION_SECRET production --value s3cr3t --force')).toBe(
      'vercel env add SESSION_SECRET production --value *** --force',
    )
  })

  it('preserves whitespace outside masked values', () => {
    expect(maskCommandLine('  git   rev-parse   HEAD  ')).toBe('  git   rev-parse   HEAD  ')
  })

  it('leaves ordinary commands untouched', () => {
    expect(maskCommandLine('git rev-parse HEAD')).toBe('git rev-parse HEAD')
  })

  it('keeps a boundary-scoped non-secret flag visible', () => {
    expect(maskCommandLine('--MONKEY=visible --api-key=hidden')).toBe('--MONKEY=visible --api-key=***')
  })

  it('masks the whole quoted value of a secret flag, not just its first fragment', () => {
    expect(maskCommandLine('vercel env add SESSION_SECRET production --value "my s3cr3t value"')).toBe(
      'vercel env add SESSION_SECRET production --value *** *** ***',
    )
  })

  it('masks the fragments after an inline quoted secret value', () => {
    expect(maskCommandLine('curl --token="multi word secret" https://x')).toBe('curl --token=*** *** *** https://x')
  })
})
