import { getDb } from './db'

export interface PropertyRow {
  key: string
  value: string
}

export async function readPropertyRows(): Promise<PropertyRow[]> {
  const db = await getDb()
  const result = await db.query<PropertyRow>('select key, value from app_config')
  return result.rows
}

export async function readPropertyRow(key: string): Promise<string | null> {
  const db = await getDb()
  const result = await db.query<PropertyRow>('select key, value from app_config where key = $1', [key])
  return result.rows[0]?.value ?? null
}

export async function writePropertyRow(key: string, value: string): Promise<void> {
  const db = await getDb()
  await db.query(
    `insert into app_config (key, value, updated_at) values ($1, $2, current_timestamp)
     on conflict (key) do update set value = excluded.value, updated_at = current_timestamp`,
    [key, value],
  )
}

export async function deletePropertyRow(key: string): Promise<void> {
  const db = await getDb()
  await db.query('delete from app_config where key = $1', [key])
}
