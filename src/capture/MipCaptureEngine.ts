// ─────────────────────────────────────────────────────────────────────────────
// Native capture via the VoxIssue iOS app. Inside the app's capture web view,
// `window.vi` (capture/done hooks, `window.mip` legacy alias) is injected —
// the phone takes a REAL WKWebView snapshot, pixel-identical to what a user
// sees. The runner keeps its whole navigate → waitForReady → actions →
// stabilize flow; only the shutter changes: this engine says "now", and the
// app imports the shot as a ticket on-device.
//
// The SDK never captures pixels: the returned blob is a 1x1 placeholder, and
// outside the VoxIssue app capture() is a dry-run no-op.
// ─────────────────────────────────────────────────────────────────────────────

import type { CaptureEngine, CaptureRequest, CaptureResult } from '../types.js'

type MipHooks = { capture(): void; done(): void }

function hooks(): MipHooks | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as { vi?: MipHooks; mip?: MipHooks }
  const h = w.vi ?? w.mip
  return typeof h?.capture === 'function' ? (h as MipHooks) : null
}

/** True when running inside the MIP capture web view. */
export function isMipHost(): boolean {
  return hooks() !== null
}

// Smallest valid transparent PNG (1x1) — placeholder for the stored record.
const PLACEHOLDER_PNG = Uint8Array.from(atob(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
), (c) => c.charCodeAt(0))

export class MipCaptureEngine implements CaptureEngine {
  readonly id = 'native:mip'

  async capture(_req: CaptureRequest): Promise<CaptureResult> {
    const mip = hooks()
    if (!mip) {
      // Outside the VoxIssue app there is nothing to shoot — the SDK never
      // captures pixels itself. Treat the run as a dry-run.
      return { blob: new Blob([PLACEHOLDER_PNG], { type: 'image/png' }), width: 0, height: 0 }
    }
    mip.capture()
    // WKWebView snapshots asynchronously on the native side; give it a beat so
    // the next action/navigation doesn't mutate the page mid-shot.
    await new Promise((r) => setTimeout(r, 350))
    return {
      blob: new Blob([PLACEHOLDER_PNG], { type: 'image/png' }),
      width: window.innerWidth,
      height: window.innerHeight,
    }
  }

  /** Signal MIP that the whole run is over (it advances to the next pages.json URL). */
  finishRun(): void {
    hooks()?.done()
  }
}
