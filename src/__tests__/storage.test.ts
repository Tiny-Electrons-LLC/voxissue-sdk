// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import 'fake-indexeddb/auto'
import { VisualStorage } from '../storage.js'
import type { StoredCapture } from '../types.js'

// Regression guard for the WebKit "Error preparing Blob/File data to be stored
// in object store" bug: iOS Safari can't structured-clone a Blob into IDB, so
// storage persists an ArrayBuffer + mime and reconstructs the Blob on read. This
// test proves a capture round-trips with its bytes and type intact.
function makeCapture(index: number, bytes: Uint8Array): StoredCapture {
  return {
    meta: {
      sessionId: 's1', index, scenario: 'sc', checkpoint: 'top', route: '/x',
      timestamp: new Date(0).toISOString(),
      viewport: { width: 390, height: 844, devicePixelRatio: 3 },
      browser: 'test', platform: 'test', engine: 'test',
    } as StoredCapture['meta'],
    blob: new Blob([bytes as BlobPart], { type: 'image/png' }),
    uploaded: false,
  }
}

describe('VisualStorage', () => {
  let storage: VisualStorage
  beforeEach(() => { storage = new VisualStorage() })

  it('round-trips a capture blob through IndexedDB (bytes + mime intact)', async () => {
    const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3, 4, 5])
    await storage.saveCapture('s1', makeCapture(1, bytes))

    const rows = await storage.listCaptures('s1')
    expect(rows).toHaveLength(1)
    expect(rows[0]!.blob.type).toBe('image/png')
    const out = new Uint8Array(await rows[0]!.blob.arrayBuffer())
    expect(Array.from(out)).toEqual(Array.from(bytes))
  })

  it('lists captures ordered by index and prunes other sessions', async () => {
    // pruneOldSessions walks the sessions store, so mirror real runner usage and
    // save a session row per session before adding its captures.
    const sess = (id: string) => ({
      sessionId: id, suiteId: 'x', suiteName: 'X', status: 'complete' as const,
      startedAt: new Date(0).toISOString(), captureIndex: 0, totalCaptures: 0,
      failures: [], uploaded: 0,
    })
    await storage.saveSession(sess('s1'))
    await storage.saveSession(sess('s2'))
    await storage.saveCapture('s1', makeCapture(2, new Uint8Array([2])))
    await storage.saveCapture('s1', makeCapture(1, new Uint8Array([1])))
    await storage.saveCapture('s2', makeCapture(1, new Uint8Array([9])))

    const s1 = await storage.listCaptures('s1')
    expect(s1.map((c) => c.meta.index)).toEqual([1, 2])

    await storage.pruneOldSessions('s1')
    expect(await storage.listCaptures('s2')).toHaveLength(0)
    expect(await storage.listCaptures('s1')).toHaveLength(2)
  })
})
