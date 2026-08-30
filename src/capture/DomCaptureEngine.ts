// ─────────────────────────────────────────────────────────────────────────────
// DOM -> PNG capture using modern-screenshot. Chosen by the WebKit spike: it
// reproduced real mobile Safari at 0.09-0.82% pixel diff (incl. SVG charts,
// fonts, avatars). We capture the VIEWPORT box at the device pixel ratio - what
// the developer actually sees - not the full scrollable document.
//
// This is one implementation of the CaptureEngine interface; the runner never
// depends on it directly, so a native iOS / Playwright engine can replace it
// later without touching the manifest or runner.
// ─────────────────────────────────────────────────────────────────────────────

import { domToBlob } from 'modern-screenshot'
import type { CaptureEngine, CaptureRequest, CaptureResult } from '../types.js'

const REDACT_ATTR = 'data-visual-redact'
const IGNORE_ATTR = 'data-visual-ignore'

export interface DomCaptureOptions {
  /** Solid backdrop so transparent bodies don't render black. */
  backgroundColor?: string
  /** Extra work per clone (e.g. app-specific scrubbing). */
  onClone?: (doc: Document) => void
}

export class DomCaptureEngine implements CaptureEngine {
  readonly id = 'dom:modern-screenshot'
  private opts: DomCaptureOptions

  constructor(opts: DomCaptureOptions = {}) {
    this.opts = opts
  }

  async capture(req: CaptureRequest): Promise<CaptureResult> {
    if (typeof window === 'undefined') throw new Error('DomCaptureEngine requires a DOM')
    const dpr = window.devicePixelRatio || 1
    const vw = window.innerWidth
    const vh = window.innerHeight
    const target = (req.target as HTMLElement) || document.documentElement

    const blob = await domToBlob(target, {
      // Capture the viewport box at real DPR (matches the native screenshot).
      width: req.viewportOnly ? vw : target.scrollWidth,
      height: req.viewportOnly ? vh : target.scrollHeight,
      scale: dpr,
      backgroundColor: this.opts.backgroundColor ?? '#ffffff',
      // When viewport-only, clip to the current scroll position.
      style: req.viewportOnly
        ? { transform: `translate(${-window.scrollX}px, ${-window.scrollY}px)`, transformOrigin: 'top left' }
        : undefined,
      filter: (node) => {
        // Drop elements marked ignore (they cause churn in diffs).
        if (node instanceof Element && node.hasAttribute(IGNORE_ATTR)) return false
        return true
      },
      onCloneNode: (cloned) => {
        if (cloned instanceof Element) {
          // Redact sensitive fields before the pixels are ever produced.
          cloned.querySelectorAll?.(`[${REDACT_ATTR}]`).forEach((el) => {
            (el as HTMLElement).style.filter = 'blur(8px)'
            el.setAttribute('aria-hidden', 'true')
          })
        }
        if (cloned.ownerDocument && this.opts.onClone) this.opts.onClone(cloned.ownerDocument)
      },
      // KNOWN LIMITATION (M2): the flattened foreignObject clone has no
      // scrollport, so on a SCROLLED viewport capture, position:fixed elements
      // render at their document position (translated off-screen) and
      // position:sticky headers unstick. Top-of-page captures are faithful
      // (the spike's 0.09-0.82% numbers). For scrolled sticky/fixed fidelity,
      // prefer top-anchored checkpoints, or a future native capture engine.
    })

    return {
      blob,
      width: Math.round((req.viewportOnly ? vw : target.scrollWidth) * dpr),
      height: Math.round((req.viewportOnly ? vh : target.scrollHeight) * dpr),
    }
  }
}
