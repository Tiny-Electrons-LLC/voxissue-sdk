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

export type HostControls = { pause(): void; resume(): void; stop(): void }

/**
 * Host → runner controls. Inside a VoxIssue host (the app's web view, or the
 * browser relay extension's bridge) the person driving the run has Pause /
 * Resume / Stop buttons on the native side; the host fires these as window
 * events and the controller obeys, so a paused run really stops scrolling
 * and navigating instead of only skipping shots.
 *
 *   window.dispatchEvent(new CustomEvent('vi:pause'))   // 'vi:resume', 'vi:stop'
 *
 * Returns a function that removes the listeners. No-op outside a host.
 */
export function listenToHostControls(controls: HostControls): () => void {
  if (typeof window === 'undefined' || !isMipHost()) return () => {}
  const onPause = () => controls.pause()
  const onResume = () => controls.resume()
  const onStop = () => controls.stop()
  window.addEventListener('vi:pause', onPause)
  window.addEventListener('vi:resume', onResume)
  window.addEventListener('vi:stop', onStop)
  return () => {
    window.removeEventListener('vi:pause', onPause)
    window.removeEventListener('vi:resume', onResume)
    window.removeEventListener('vi:stop', onStop)
  }
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
