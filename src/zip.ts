// Bundle a completed session's captures + metadata into a downloadable ZIP.
// Layout mirrors the plan: session.json at root, PNGs foldered by scenario.

import JSZip from 'jszip'
import type { StoredCapture, VisualSessionState } from './types.js'

export async function buildSessionZip(
  session: VisualSessionState,
  captures: StoredCapture[],
): Promise<Blob> {
  const zip = new JSZip()
  zip.file(
    'session.json',
    JSON.stringify(
      { session, captures: captures.map((c) => c.meta) },
      null,
      2,
    ),
  )
  for (const c of captures) {
    // e.g. inventory-devices/001_inventory-devices_devices-top_390x844.png
    zip.file(`${c.meta.scenario}/${c.meta.filename}`, c.blob)
  }
  return zip.generateAsync({ type: 'blob' })
}

/** Trigger a browser download of a Blob. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
