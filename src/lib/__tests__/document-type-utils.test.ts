import { describe, expect, it } from 'vitest'
import {
  convertJsonToYaml,
  convertYamlToJson,
  formatJson,
  formatYaml,
  validateCsv,
  validateJson,
  validateYaml,
} from '$lib/document-type-utils'

describe('validateJson', () => {
  it('accepts valid JSON', () => {
    expect(validateJson('{"a":1}')).toEqual({ valid: true })
  })

  it('rejects invalid JSON', () => {
    const result = validateJson('{"a":')
    expect(result.valid).toBe(false)
    expect(result.error).toBeTruthy()
  })
})

describe('validateYaml', () => {
  it('accepts valid YAML', async () => {
    expect(await validateYaml('a: 1\nb: hello')).toEqual({ valid: true })
  })

  it('rejects invalid YAML', async () => {
    const result = await validateYaml('a: [1, 2')
    expect(result.valid).toBe(false)
    expect(result.error).toBeTruthy()
  })
})

describe('validateCsv', () => {
  it('accepts empty CSV', () => {
    expect(validateCsv('')).toEqual({ valid: true })
  })

  it('accepts consistent columns with quoted fields', () => {
    expect(validateCsv('a,b,c\n"x,y",2,3')).toEqual({ valid: true })
  })

  it('accepts escaped quotes inside quoted fields', () => {
    expect(validateCsv('name,note\n"he said ""hi""",ok')).toEqual({ valid: true })
  })

  it('rejects an unclosed quote', () => {
    const result = validateCsv('a,b\n"unclosed,2')
    expect(result.valid).toBe(false)
    expect(result.error).toMatch(/unclosed quote/i)
  })

  it('rejects inconsistent column counts', () => {
    const result = validateCsv('a,b,c\n1,2')
    expect(result.valid).toBe(false)
    expect(result.error).toMatch(/2 columns/)
  })
})

describe('formatJson', () => {
  it('formats with the requested indent', () => {
    expect(formatJson('{"a":[1,2]}', 2)).toEqual({ ok: true, value: '{\n  "a": [\n    1,\n    2\n  ]\n}' })
  })

  it('rejects invalid JSON', () => {
    const result = formatJson('{oops', 2)
    expect(result.ok).toBe(false)
    expect(result.error).toBeTruthy()
  })
})

describe('formatYaml', () => {
  it('formats YAML with the requested indent', async () => {
    const result = await formatYaml('a: 1\nb:\n- 1\n- 2\n', 4)
    expect(result.ok).toBe(true)
    expect(result.value).toBe('a: 1\nb:\n    - 1\n    - 2\n')
  })

  it('rejects invalid YAML', async () => {
    const result = await formatYaml('a: [1, 2')
    expect(result.ok).toBe(false)
    expect(result.error).toBeTruthy()
  })

  it('keeps empty content', async () => {
    const result = await formatYaml('   ')
    expect(result.ok).toBe(true)
    expect(result.value).toBe('')
  })
})

describe('convertJsonToYaml', () => {
  it('converts JSON to YAML', async () => {
    const result = await convertJsonToYaml('{"name":"test","tags":["a","b"]}')
    expect(result.ok).toBe(true)
    expect(result.value).toBe('name: test\ntags:\n  - a\n  - b\n')
  })

  it('converts JSON to YAML with custom indent', async () => {
    const result = await convertJsonToYaml('{"name":"test","tags":["a","b"]}', 4)
    expect(result.ok).toBe(true)
    expect(result.value).toBe('name: test\ntags:\n    - a\n    - b\n')
  })

  it('rejects invalid JSON', async () => {
    const result = await convertJsonToYaml('{oops')
    expect(result.ok).toBe(false)
    expect(result.error).toBeTruthy()
  })
})

describe('convertYamlToJson', () => {
  it('converts YAML to JSON', async () => {
    const result = await convertYamlToJson('name: test\ntags:\n  - a\n  - b\n')
    expect(result.ok).toBe(true)
    expect(result.value).toBe('{\n  "name": "test",\n  "tags": [\n    "a",\n    "b"\n  ]\n}')
  })

  it('converts YAML to JSON with custom indent', async () => {
    const result = await convertYamlToJson('name: test\n', 4)
    expect(result.ok).toBe(true)
    expect(result.value).toBe('{\n    "name": "test"\n}')
  })

  it('rejects invalid YAML', async () => {
    const result = await convertYamlToJson('a: [1, 2')
    expect(result.ok).toBe(false)
    expect(result.error).toBeTruthy()
  })

  it('handles empty YAML', async () => {
    const result = await convertYamlToJson('')
    expect(result.ok).toBe(true)
    expect(result.value).toBe('')
  })
})
