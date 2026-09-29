import Database from 'better-sqlite3'
import path from 'node:path'

// Deletes this run's throwaway users (`e2e_<purpose>_<timestamp>`) and the
// documents they own: `documents.owner_user_id` is ON DELETE SET NULL, so
// documents do not cascade with the user and must be removed first.
async function globalTeardown() {
  const db = new Database(path.resolve('.data', 'dev.sqlite'))
  try {
    db.pragma('foreign_keys = ON')
    const owners = db.prepare("select id from users where username like 'e2e\\_%' escape '\\'").all() as {
      id: number
    }[]
    const removeDocuments = db.prepare('delete from documents where owner_user_id = ?')
    for (const { id } of owners) {
      removeDocuments.run(id)
    }
    const removed = db.prepare("delete from users where username like 'e2e\\_%' escape '\\'").run()
    console.log(`[e2e-teardown] removed ${removed.changes} e2e user(s), ${owners.length} owner(s)`)
  } finally {
    db.close()
  }
}

export default globalTeardown
