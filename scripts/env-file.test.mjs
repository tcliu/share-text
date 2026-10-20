import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { readJsonFile } from './env-file.mjs'

function scratchFile(name, contents) {
  const dir = mkdtempSync(join(tmpdir(), 'env-file-'))
  const path = join(dir, name)
  writeFileSync(path, contents)
  return path
}

describe('readJsonFile', () => {
  it('parses a present JSON file', () => {
    expect(readJsonFile(scratchFile('package.json', '{"name":"x"}'))).toEqual({ name: 'x' })
  })

  it('returns the fallback when the file is absent', () => {
    expect(readJsonFile(join(tmpdir(), 'definitely-absent.json'), {})).toEqual({})
    expect(readJsonFile(join(tmpdir(), 'definitely-absent.json'))).toBeNull()
  })

  it('stops the run on a present but malformed file, naming the path', () => {
    const path = scratchFile('broken.json', '{"name":')
    expect(() => readJsonFile(path)).toThrow(/Invalid JSON in /)
    expect(() => readJsonFile(path)).toThrow(path)
  })
})
