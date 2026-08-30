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

    const captureWidth = req.viewportOnly ? vw : target.scrollWidth
    const captureHeight = req.viewportOnly ? vh : target.scrollHeight

    const blob = await domToBlob(target, {
      // Capture the viewport box at real DPR (matches the native screenshot).
      width: captureWidth,
      height: captureHeight,
      scale: dpr,
      backgroundColor: this.opts.backgroundColor ?? '#ffffff',
      // CRITICAL: pin the cloned root to the real layout width. Without this,
      // modern-screenshot renders <html> into a foreignObject that reflows to a
      // content-driven (narrower) width, so text wraps differently than on the
      // real device - the capture came out as if the viewport were much
      // narrower. Forcing width/min/max to the live viewport makes the clone lay
      // out identically to the screen. (When viewport-only we also translate to
      // the current scroll position.)
      style: {
        width: `${captureWidth}px`,
        minWidth: `${captureWidth}px`,
        maxWidth: `${captureWidth}px`,
        // THE FIX for "capture wraps more than the real screen at the same
        // width": the clone renders inside an SVG image document that has NO
        // <meta viewport>, so iOS WebKit re-enables text auto-sizing and inflates
        // px-sized UI text ~20%, forcing extra line-wraps + overlap. On the live
        // page the computed value is 'auto' (== the default), so modern-screenshot
        // never carries an opt-out into the clone. Pin it explicitly here; it
        // inherits to the whole tree. (Both spellings for Safari + spec.)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ...( { webkitTextSizeAdjust: '100%', textSizeAdjust: '100%' } as Record<string, string> ),
        ...(req.viewportOnly
          ? { transform: `translate(${-window.scrollX}px, ${-window.scrollY}px)`, transformOrigin: 'top left' }
          : {}),
      },
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
          // Belt-and-braces for the iOS text-autosizing fix above: force every
          // element in the clone to opt out, in case a descendant inlined
          // 'auto'. Inject once into the cloned root.
          const doc = cloned.ownerDocument
          if (doc && cloned instanceof HTMLElement && !doc.getElementById('vc-text-size-fix')) {
            const s = doc.createElement('style')
            s.id = 'vc-text-size-fix'
            s.textContent = '*{-webkit-text-size-adjust:100%!important;text-size-adjust:100%!important;}'
            ;(cloned as HTMLElement).prepend(s)
          }
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
      width: Math.round(captureWidth * dpr),
      height: Math.round(captureHeight * dpr),
    }
  }
}
