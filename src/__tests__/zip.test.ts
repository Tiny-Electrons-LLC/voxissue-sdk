// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import JSZip from 'jszip'
import { buildSessionZip } from '../zip.js'
import type { StoredCapture, VisualSessionState } from '../types.js'

const session = {
  sessionId: 's1', suiteId: 'x', suiteName: 'X', status: 'complete' as const,
  startedAt: new Date(0).toISOString(), captureIndex: 2, totalCaptures: 2,
  failures: [], uploaded: 0,
} satisfies VisualSessionState

function cap(index: number, scenario: string, checkpoint: string): StoredCapture {
  const filename = `${String(index).padStart(3, '0')}_${scenario}_${checkpoint}_390x844.png`
  return {
    meta: {
      sessionId: 's1', index, scenario, checkpoint, filename, route: '/x',
      timestamp: new Date(0).toISOString(),
      viewport: { width: 390, height: 844, devicePixelRatio: 3 },
      browser: 'test', platform: 'test', engine: 'test',
    } as StoredCapture['meta'],
    blob: new Blob([new Uint8Array([index]) as BlobPart], { type: 'image/png' }),
    uploaded: false,
  }
}

const captures = [cap(1, 'dashboard', 'top'), cap(2, 'devices', 'top')]

async function names(blob: Blob): Promise<string[]> {
  const zip = await JSZip.loadAsync(await blob.arrayBuffer())
  return Object.keys(zip.files).filter((n) => !zip.files[n]!.dir).sort()
}

describe('buildSessionZip layout', () => {
  it("'folder' writes PNGs foldered by scenario only", async () => {
    const n = await names(await buildSessionZip(session, captures, 'folder'))
    expect(n).toContain('dashboard/001_dashboard_top_390x844.png')
    expect(n).toContain('devices/002_devices_top_390x844.png')
    expect(n.some((x) => x.startsWith('_combined/'))).toBe(false)
  })

  it("'combined' writes every PNG flat in _combined/ only", async () => {
    const n = await names(await buildSessionZip(session, captures, 'combined'))
    expect(n).toContain('_combined/001_dashboard_top_390x844.png')
    expect(n).toContain('_combined/002_devices_top_390x844.png')
    expect(n.some((x) => x.startsWith('dashboard/') || x.startsWith('devices/'))).toBe(false)
  })

  it("'both' (default) writes foldered AND _combined/ copies", async () => {
    const n = await names(await buildSessionZip(session, captures))
    expect(n).toContain('dashboard/001_dashboard_top_390x844.png')
    expect(n).toContain('_combined/001_dashboard_top_390x844.png')
    expect(n).toContain('session.json')
  })
})
