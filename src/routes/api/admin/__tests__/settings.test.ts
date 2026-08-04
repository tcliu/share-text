import { beforeEach, describe, expect, it, vi } from 'vitest'

const settingsMocks = vi.hoisted(() => ({
  listSettings: vi.fn(),
  setSettingValue: vi.fn(),
  deleteSettingValue: vi.fn(),
}))

vi.mock('$lib/server/settings', async () => {
  const actual = await vi.importActual<typeof import('$lib/server/settings')>('$lib/server/settings')
  return {
    ...actual,
    listSettings: settingsMocks.listSettings,
    setSettingValue: settingsMocks.setSettingValue,
    deleteSettingValue: settingsMocks.deleteSettingValue,
  }
})

import { GET, PUT } from '../settings/+server'

const settingRow = {
  key: 'max_documents_per_ip',
  label: 'Max documents per IP',
  description: '',
  defaultValue: 10,
  envKey: 'MAX_DOCUMENTS_PER_IP',
  min: 1,
  max: 1000,
  value: 10,
  source: 'default',
}

function putEvent(body: unknown) {
  return {
    request: new Request('http://localhost/api/admin/settings', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
    getClientAddress: () => '203.0.113.9',
  } as never
}

describe('GET /api/admin/settings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    settingsMocks.listSettings.mockResolvedValue([settingRow])
  })

  it('returns the resolved settings', async () => {
    const response = await GET({} as never)
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ settings: [settingRow] })
  })
})

describe('PUT /api/admin/settings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    settingsMocks.listSettings.mockResolvedValue([settingRow])
    settingsMocks.setSettingValue.mockImplementation((key: string, value: unknown) => Promise.resolve(Number(value)))
    settingsMocks.deleteSettingValue.mockResolvedValue(undefined)
  })

  it('updates settings and returns the refreshed list', async () => {
    settingsMocks.listSettings
      .mockResolvedValueOnce([{ ...settingRow, value: 10 }])
      .mockResolvedValueOnce([{ ...settingRow, value: 50, source: 'database' }])
    settingsMocks.setSettingValue.mockResolvedValue(50)

    const response = await PUT(putEvent({ settings: [{ key: 'max_documents_per_ip', value: 50 }] }))

    expect(response.status).toBe(200)
    expect(settingsMocks.setSettingValue).toHaveBeenCalledWith('max_documents_per_ip', 50)
    await expect(response.json()).resolves.toEqual({
      settings: [{ ...settingRow, value: 50, source: 'database' }],
    })
  })

  it('deletes the override when the value is null', async () => {
    const response = await PUT(putEvent({ settings: [{ key: 'max_documents_per_ip', value: null }] }))

    expect(response.status).toBe(200)
    expect(settingsMocks.deleteSettingValue).toHaveBeenCalledWith('max_documents_per_ip')
    expect(settingsMocks.setSettingValue).not.toHaveBeenCalled()
  })

  it('rejects an unknown setting key', async () => {
    const response = await PUT(putEvent({ settings: [{ key: 'nope', value: 5 }] }))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'Unknown setting: nope' })
    expect(settingsMocks.setSettingValue).not.toHaveBeenCalled()
  })

  it('does not apply earlier items when a later setting is invalid', async () => {
    const response = await PUT(
      putEvent({ settings: [{ key: 'max_documents_per_ip', value: 50 }, { key: 'nope', value: 5 }] }),
    )

    expect(response.status).toBe(400)
    expect(settingsMocks.setSettingValue).not.toHaveBeenCalled()
    expect(settingsMocks.deleteSettingValue).not.toHaveBeenCalled()
  })

  it('rejects a body without a settings array', async () => {
    const response = await PUT(putEvent({ foo: 'bar' }))

    expect(response.status).toBe(400)
  })
})
