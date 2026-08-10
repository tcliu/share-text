import { describe, expect, it } from 'vitest'
import {
  convertJsonToYaml,
  convertYamlToJson,
  formatJson,
  formatYaml,
  parseXmlStructure,
  serializeXmlStructure,
  validateJson,
  validateYaml,
} from '$lib/document-type-utils'
import { parseCsv, serializeCsv, validateCsv } from '$lib/csv-utils'

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
    expect(result.error).toMatch(/quoted field unterminated/i)
  })

  it('rejects inconsistent column counts', () => {
    const result = validateCsv('a,b,c\n1,2')
    expect(result.valid).toBe(false)
    expect(result.error).toMatch(/2 columns/)
  })
})

describe('parseCsv', () => {
  it('returns no rows for empty input', () => {
    expect(parseCsv('')).toEqual([])
  })

  it('parses simple rows', () => {
    expect(parseCsv('a,b,c\n1,2,3')).toEqual([
      ['a', 'b', 'c'],
      ['1', '2', '3'],
    ])
  })

  it('keeps a single empty field as one empty row', () => {
    expect(parseCsv('')).toEqual([])
  })

  it('parses quoted fields with embedded commas', () => {
    expect(parseCsv('a,b\n"x,y",z')).toEqual([
      ['a', 'b'],
      ['x,y', 'z'],
    ])
  })

  it('parses escaped quotes', () => {
    expect(parseCsv('name,note\n"he said ""hi""",ok')).toEqual([
      ['name', 'note'],
      ['he said "hi"', 'ok'],
    ])
  })

  it('parses multi-line quoted fields', () => {
    expect(parseCsv('a,"line1\nline2",c')).toEqual([['a', 'line1\nline2', 'c']])
  })

  it('does not add a trailing empty row for a final newline', () => {
    expect(parseCsv('a,b\n')).toEqual([['a', 'b']])
  })
})

describe('serializeCsv', () => {
  it('joins fields with commas and rows with newlines', () => {
    expect(
      serializeCsv([
        ['a', 'b', 'c'],
        ['1', '2', '3'],
      ]),
    ).toBe('a,b,c\n1,2,3')
  })

  it('quotes fields containing commas, quotes or newlines', () => {
    expect(serializeCsv([['x,y', 'he said "hi"', 'a\nb']])).toBe('"x,y","he said ""hi""","a\nb"')
  })

  it('round-trips with parseCsv', () => {
    const rows = [
      ['name', 'note'],
      ['x,y', 'he said "hi"'],
      ['multi', 'line1\nline2'],
    ]
    expect(parseCsv(serializeCsv(rows))).toEqual(rows)
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

describe('parseXmlStructure', () => {
  it('parses a flat XML document into an element node', () => {
    const result = parseXmlStructure('<root attr="1"><child>text</child></root>')
    expect(result.ok).toBe(true)
    expect(result.value).toEqual({
      tag: 'root',
      attributes: { attr: '1' },
      children: [{ tag: 'child', attributes: {}, children: 'text' }],
    })
  })

  it('collects repeated element children into an array', () => {
    const result = parseXmlStructure('<root><item>a</item><item>b</item></root>')
    expect(result.ok).toBe(true)
    expect(result.value).toEqual({
      tag: 'root',
      attributes: {},
      children: [
        { tag: 'item', attributes: {}, children: 'a' },
        { tag: 'item', attributes: {}, children: 'b' },
      ],
    })
  })

  it('skips formatting whitespace between element children', () => {
    const result = parseXmlStructure('<root>\n  <child>v</child>\n</root>')
    expect(result.ok).toBe(true)
    expect(result.value).toEqual({
      tag: 'root',
      attributes: {},
      children: [{ tag: 'child', attributes: {}, children: 'v' }],
    })
  })

  it('stores a single text child as a string', () => {
    const result = parseXmlStructure('<name>Alice</name>')
    expect(result.ok).toBe(true)
    expect(result.value).toEqual({ tag: 'name', attributes: {}, children: 'Alice' })
  })

  it('rejects malformed XML', () => {
    const result = parseXmlStructure('<root><unclosed></root>')
    expect(result.ok).toBe(false)
    expect(result.error).toBeTruthy()
  })

  it('rejects a document without a root element', () => {
    const result = parseXmlStructure('<item/><item/>')
    expect(result.ok).toBe(false)
    expect(result.error).toBeTruthy()
  })

  it('drops whitespace-only text nodes, treating them as empty', () => {
    const result = parseXmlStructure('<x> </x>')
    expect(result.ok).toBe(true)
    expect(result.value).toEqual({ tag: 'x', attributes: {}, children: '' })
  })
})

describe('serializeXmlStructure', () => {
  it('serializes a text-only element inline', () => {
    expect(serializeXmlStructure({ tag: 'name', attributes: {}, children: 'Alice' })).toBe('<name>Alice</name>')
  })

  it('produces self-closing tags for empty elements', () => {
    expect(serializeXmlStructure({ tag: 'br', attributes: {}, children: '' })).toBe('<br />')
  })

  it('pretty-prints element-only children with two-space indentation', () => {
    expect(
      serializeXmlStructure({
        tag: 'catalog',
        attributes: {},
        children: [{ tag: 'book', attributes: { id: '1' }, children: '' }],
      }),
    ).toBe('<catalog>\n  <book id="1" />\n</catalog>')
  })

  it('escapes text content and attribute values', () => {
    expect(
      serializeXmlStructure({
        tag: 'note',
        attributes: { lang: 'en"xe' },
        children: 'a & b < c > d',
      }),
    ).toBe('<note lang="en&quot;xe">a &amp; b &lt; c &gt; d</note>')
  })

  it('round-trips a complex document', () => {
    const text = '<root a="1"><item>x &amp; y</item><item>2</item></root>'
    const parsed = parseXmlStructure(text)
    expect(parsed.ok).toBe(true)
    expect(parseXmlStructure(serializeXmlStructure(parsed.value)!).ok).toBe(true)
  })

  it('returns null for non-element values', () => {
    expect(serializeXmlStructure({ foo: 1 })).toBeNull()
    expect(serializeXmlStructure(42)).toBeNull()
  })

  it('serializes non-string edited children as text', () => {
    expect(serializeXmlStructure({ tag: 'count', attributes: {}, children: 8 })).toBe('<count>8</count>')
    expect(serializeXmlStructure({ tag: 'flag', attributes: {}, children: true })).toBe('<flag>true</flag>')
  })
})
