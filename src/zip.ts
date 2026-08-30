// Bundle a completed session's captures + metadata into a downloadable ZIP.
// Layout: session.json at root, then PNGs written per the chosen ZipLayout:
//   'folder'   - PNGs foldered by scenario (dashboard/001_..._top.png)
//   'combined' - every PNG flat in one _combined/ folder, in run order
//   'both'     - both of the above in the same ZIP (default)

import JSZip from 'jszip'
import type { StoredCapture, VisualSessionState } from './types.js'

/** Controls where capture PNGs land inside the ZIP. */
export type ZipLayout = 'folder' | 'combined' | 'both'

export async function buildSessionZip(
  session: VisualSessionState,
  captures: StoredCapture[],
  layout: ZipLayout = 'both',
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
  const wantFolder = layout === 'folder' || layout === 'both'
  const wantCombined = layout === 'combined' || layout === 'both'
  for (const c of captures) {
    if (wantFolder) {
      // e.g. inventory-devices/001_inventory-devices_devices-top_390x844.png
      zip.file(`${c.meta.scenario}/${c.meta.filename}`, c.blob)
    }
    if (wantCombined) {
      // Every capture flat in one folder, in run order (filename is already
      // index-prefixed, so they sort correctly across scenarios).
      zip.file(`_combined/${c.meta.filename}`, c.blob)
    }
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
