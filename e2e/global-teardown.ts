import Database from 'better-sqlite3'
import path from 'node:path'

// Deletes this run's throwaway user (`e2e_smoke_<timestamp>`) and the documents
// it owns: `documents.owner_user_id` is ON DELETE SET NULL, so documents do not
// cascade with the user and must be removed first.
async function globalTeardown() {
  const db = new Database(path.resolve('.data', 'dev.sqlite'))
  try {
    db.pragma('foreign_keys = ON')
    const owners = db
      .prepare("select id from users where username like 'e2e\\_smoke\\_%' escape '\\'")
      .all() as { id: number }[]
    const removeDocuments = db.prepare('delete from documents where owner_user_id = ?')
    for (const { id } of owners) {
      removeDocuments.run(id)
    }
    const removed = db.prepare("delete from users where username like 'e2e\\_smoke\\_%' escape '\\'").run()
    console.log(`[e2e-teardown] removed ${removed.changes} smoke user(s), ${owners.length} owner(s)`)
  } finally {
    db.close()
  }
}

export default globalTeardown
