// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

const documentsMocks = vi.hoisted(() => ({
  exportDocumentsForAdmin: vi.fn(),
}))

vi.mock('$lib/server/documents', async () => {
  const actual = await vi.importActual<typeof import('$lib/server/documents')>('$lib/server/documents')
  return {
    ...actual,
    exportDocumentsForAdmin: documentsMocks.exportDocumentsForAdmin,
  }
})

import { GET } from '../documents/export/+server'

const exported = [
  {
    name: 'Notes',
    content: 'hello world',
    documentType: 'text',
    tags: [],
    isPublic: true,
  },
]

function getEvent(input: { url?: string; ip?: string } = {}) {
  return {
    url: new URL(input.url ?? 'http://localhost/api/admin/documents/export'),
    getClientAddress: () => input.ip ?? '127.0.0.1',
  } as never
}

describe('GET /api/admin/documents/export', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    documentsMocks.exportDocumentsForAdmin.mockResolvedValue(exported)
  })

  it('exports every document when no ids are given', async () => {
    const response = await GET(getEvent())

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual(exported)
    expect(documentsMocks.exportDocumentsForAdmin).toHaveBeenCalledWith(undefined)
  })

  it('exports only the selected documents when ids are given', async () => {
    const response = await GET(getEvent({ url: 'http://localhost/api/admin/documents/export?ids=aaaaaa,bbbbbb' }))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual(exported)
    expect(documentsMocks.exportDocumentsForAdmin).toHaveBeenCalledWith(['aaaaaa', 'bbbbbb'])
  })

  it('ignores an empty ids parameter', async () => {
    await GET(getEvent({ url: 'http://localhost/api/admin/documents/export?ids=' }))

    expect(documentsMocks.exportDocumentsForAdmin).toHaveBeenCalledWith(undefined)
  })

  it('rejects an invalid document id in the selection', async () => {
    const response = await GET(getEvent({ url: 'http://localhost/api/admin/documents/export?ids=aaaaaa,NOT_VALID' }))

    expect(response.status).toBe(400)
    expect(documentsMocks.exportDocumentsForAdmin).not.toHaveBeenCalled()
  })
})
