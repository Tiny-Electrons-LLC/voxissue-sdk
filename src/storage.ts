// ─────────────────────────────────────────────────────────────────────────────
// IndexedDB-backed capture storage. Captures + session state are persisted as
// they're produced so a Safari reload / memory-pressure discard mid-run doesn't
// lose the session (mobile Safari does this). Blobs live in IDB, not RAM.
// ─────────────────────────────────────────────────────────────────────────────

import type { StoredCapture, VisualSessionState } from './types.js'

const DB_NAME = 'visual-capture'
const DB_VERSION = 1
const CAPTURES = 'captures'
const SESSIONS = 'sessions'

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(CAPTURES)) {
        const store = db.createObjectStore(CAPTURES, { keyPath: 'key' })
        store.createIndex('bySession', 'sessionId', { unique: false })
      }
      if (!db.objectStoreNames.contains(SESSIONS)) {
        db.createObjectStore(SESSIONS, { keyPath: 'sessionId' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function tx<T>(db: IDBDatabase, store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = db.transaction(store, mode)
    const req = fn(t.objectStore(store))
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

// On disk we persist the capture bytes as an ArrayBuffer + mime, NOT a Blob.
// WebKit/iOS Safari (the primary target) fails to structured-clone a Blob into
// IndexedDB in many contexts ("Error preparing Blob/File data to be stored in
// object store"), silently dropping every capture. ArrayBuffers clone reliably
// everywhere, so we convert Blob->ArrayBuffer on write and back on read; the
// StoredCapture.blob contract callers (zip/upload) see is unchanged.
interface CaptureRow {
  key: string
  sessionId: string
  meta: StoredCapture['meta']
  uploaded: boolean
  bytes: ArrayBuffer
  mime: string
}

async function toRow(sessionId: string, c: StoredCapture): Promise<CaptureRow> {
  const bytes = await c.blob.arrayBuffer()
  return { key: `${sessionId}:${c.meta.index}`, sessionId, meta: c.meta, uploaded: c.uploaded, bytes, mime: c.blob.type || 'image/png' }
}

function fromRow(row: CaptureRow): StoredCapture {
  return { meta: row.meta, uploaded: row.uploaded, blob: new Blob([row.bytes], { type: row.mime }) }
}

export class VisualStorage {
  private dbP = openDb()

  async saveCapture(sessionId: string, capture: StoredCapture): Promise<void> {
    const db = await this.dbP
    const row = await toRow(sessionId, capture)
    await tx(db, CAPTURES, 'readwrite', (s) => s.put(row))
  }

  async markUploaded(sessionId: string, index: number): Promise<void> {
    const db = await this.dbP
    const key = `${sessionId}:${index}`
    const row = await tx<CaptureRow | undefined>(db, CAPTURES, 'readonly', (s) => s.get(key))
    if (row) { row.uploaded = true; await tx(db, CAPTURES, 'readwrite', (s) => s.put(row)) }
  }

  async listCaptures(sessionId: string): Promise<StoredCapture[]> {
    const db = await this.dbP
    const rows = await tx<CaptureRow[]>(db, CAPTURES, 'readonly', (s) => s.index('bySession').getAll(sessionId))
    return rows.sort((a, b) => a.meta.index - b.meta.index).map(fromRow)
  }

  async saveSession(state: VisualSessionState): Promise<void> {
    const db = await this.dbP
    await tx(db, SESSIONS, 'readwrite', (s) => s.put(state))
  }

  async getSession(sessionId: string): Promise<VisualSessionState | undefined> {
    const db = await this.dbP
    return tx<VisualSessionState | undefined>(db, SESSIONS, 'readonly', (s) => s.get(sessionId))
  }

  async latestSession(): Promise<VisualSessionState | undefined> {
    const db = await this.dbP
    const all = await tx<VisualSessionState[]>(db, SESSIONS, 'readonly', (s) => s.getAll())
    return all.sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0]
  }

  async clearSession(sessionId: string): Promise<void> {
    const db = await this.dbP
    const rows = await tx<CaptureRow[]>(db, CAPTURES, 'readonly', (s) => s.index('bySession').getAll(sessionId))
    for (const r of rows) await tx(db, CAPTURES, 'readwrite', (s) => s.delete(r.key))
    await tx(db, SESSIONS, 'readwrite', (s) => s.delete(sessionId))
  }

  /**
   * Prune every session EXCEPT `keepSessionId`, so IndexedDB doesn't grow
   * unbounded across runs (each run is ~11 PNGs at DPR 3 = tens of MB). On iOS
   * Safari an over-quota origin gets its whole storage evicted, so keeping only
   * the current run's captures is deliberate. (H5)
   */
  async pruneOldSessions(keepSessionId: string): Promise<void> {
    const db = await this.dbP
    const sessions = await tx<VisualSessionState[]>(db, SESSIONS, 'readonly', (s) => s.getAll())
    for (const s of sessions) {
      if (s.sessionId !== keepSessionId) await this.clearSession(s.sessionId)
    }
  }
}
