// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getDefaultTagColor } from '$lib/tag-colors'

const documentsMocks = vi.hoisted(() => ({
  importDocumentsForAdmin: vi.fn(),
}))

vi.mock('$lib/server/documents', async () => {
  const actual = await vi.importActual<typeof import('$lib/server/documents')>('$lib/server/documents')
  return {
    ...actual,
    importDocumentsForAdmin: documentsMocks.importDocumentsForAdmin,
  }
})

import { POST } from '../documents/+server'

const imported = [
  {
    id: 'a1b2c3',
    name: 'Notes',
    documentType: 'text',
    tags: [],
    content: 'hello world',
    createdBy: '127.0.0.1',
    updatedBy: '127.0.0.1',
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-02T00:00:00.000Z',
    contentSize: 12,
    isPublic: true,
  },
]

function postEvent(input: { ip?: string; body: unknown }) {
  return {
    request: new Request('http://localhost/api/admin/documents', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input.body),
    }),
    getClientAddress: () => input.ip ?? '127.0.0.1',
  } as never
}

describe('POST /api/admin/documents (import)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    documentsMocks.importDocumentsForAdmin.mockResolvedValue(imported)
  })

  it('imports a single document object', async () => {
    const response = await POST(postEvent({ body: { records: [{ name: 'Notes', content: 'hello world' }] } }))

    expect(response.status).toBe(201)
    await expect(response.json()).resolves.toEqual({ documents: imported, count: 1 })
    expect(documentsMocks.importDocumentsForAdmin).toHaveBeenCalledWith(
      [
        {
          name: 'Notes',
          content: 'hello world',
          documentType: undefined,
          tags: undefined,
          isPublic: undefined,
          key: undefined,
        },
      ],
      '127.0.0.1',
    )
  })

  it('passes an optional key through to the import', async () => {
    const response = await POST(
      postEvent({ body: { records: [{ name: 'Notes', content: 'hello world', key: 'abc123' }] } }),
    )

    expect(response.status).toBe(201)
    expect(documentsMocks.importDocumentsForAdmin).toHaveBeenCalledWith(
      [
        {
          name: 'Notes',
          content: 'hello world',
          documentType: undefined,
          tags: undefined,
          isPublic: undefined,
          key: 'abc123',
        },
      ],
      '127.0.0.1',
    )
  })

  it('imports an array of documents with optional fields', async () => {
    const response = await POST(
      postEvent({
        body: {
          records: [
            { name: 'A', content: 'one' },
            { name: 'B', content: 'two', documentType: 'yaml', tags: ['x'], isPublic: false },
          ],
        },
      }),
    )

    expect(response.status).toBe(201)
    expect(documentsMocks.importDocumentsForAdmin).toHaveBeenCalledWith(
      [
        { name: 'A', content: 'one', documentType: undefined, tags: undefined, isPublic: undefined, key: undefined },
        {
          name: 'B',
          content: 'two',
          documentType: 'yaml',
          tags: [{ name: 'x', color: getDefaultTagColor('x') }],
          isPublic: false,
          key: undefined,
        },
      ],
      '127.0.0.1',
    )
  })

  it('uses the client IP for attribution and passes it to the import', async () => {
    await POST(postEvent({ ip: '10.1.2.3', body: { records: [{ name: 'N', content: 'c' }] } }))

    expect(documentsMocks.importDocumentsForAdmin).toHaveBeenCalledWith(
      [{ name: 'N', content: 'c', documentType: undefined, tags: undefined, isPublic: undefined, key: undefined }],
      '10.1.2.3',
    )
  })

  it('rejects a body without a records array', async () => {
    const response = await POST(postEvent({ body: { records: 'nope' } }))

    expect(response.status).toBe(400)
    expect(documentsMocks.importDocumentsForAdmin).not.toHaveBeenCalled()
  })

  it('rejects an empty records array', async () => {
    const response = await POST(postEvent({ body: { records: [] } }))

    expect(response.status).toBe(400)
  })

  it('rejects more than the maximum record count', async () => {
    const records = Array.from({ length: 501 }, (_, i) => ({ name: `doc-${i}`, content: 'c' }))
    const response = await POST(postEvent({ body: { records } }))

    expect(response.status).toBe(400)
    expect(documentsMocks.importDocumentsForAdmin).not.toHaveBeenCalled()
  })

  it('rejects a non-object record', async () => {
    const response = await POST(postEvent({ body: { records: ['not an object'] } }))

    expect(response.status).toBe(400)
  })

  it('rejects a record with unsupported fields', async () => {
    const response = await POST(postEvent({ body: { records: [{ name: 'N', content: 'c', id: 1 }] } }))

    expect(response.status).toBe(400)
    expect(documentsMocks.importDocumentsForAdmin).not.toHaveBeenCalled()
  })

  it('returns a validation error from the import with a 400 status', async () => {
    documentsMocks.importDocumentsForAdmin.mockRejectedValue(new Error('record 1: name is required'))
    const response = await POST(postEvent({ body: { records: [{ content: 'c' }] } }))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'record 1: name is required' })
  })

  it('creates a single document when the body has no records array', async () => {
    documentsMocks.importDocumentsForAdmin.mockResolvedValue(imported)
    const response = await POST(
      postEvent({ body: { name: 'Notes', content: 'hello world', documentType: 'markdown' } }),
    )

    expect(response.status).toBe(201)
    await expect(response.json()).resolves.toEqual({ document: imported[0] })
    expect(documentsMocks.importDocumentsForAdmin).toHaveBeenCalledWith(
      [{ name: 'Notes', content: 'hello world', documentType: 'markdown' }],
      '127.0.0.1',
    )
  })

  it('rejects unsupported fields in a single-create body', async () => {
    const response = await POST(postEvent({ body: { name: 'Notes', content: 'c', key: 'abc123' } }))

    expect(response.status).toBe(400)
    expect(documentsMocks.importDocumentsForAdmin).not.toHaveBeenCalled()
  })
})
