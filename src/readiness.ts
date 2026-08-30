// ─────────────────────────────────────────────────────────────────────────────
// Application-readiness + stabilization. Instead of arbitrary sleeps, the runner
// waits for: (a) a data-visual-ready signal, (b) no outstanding tracked network
// requests, (c) a framework render settle, then (d) a short quiet period. This is
// far more reliable than fixed delays for capturing a stable frame.
// ─────────────────────────────────────────────────────────────────────────────

const READY_ATTR = 'data-visual-ready'

/**
 * Tracks in-flight fetch/XHR requests so the runner can wait for the network to
 * go quiet. Installed once, idempotently, when visual mode is enabled. Only
 * counts app requests; it patches window.fetch and XMLHttpRequest send/loadend.
 */
export class NetworkTracker {
  pending = 0
  private installed = false
  private origFetch?: typeof window.fetch

  install(): void {
    if (this.installed || typeof window === 'undefined') return
    this.installed = true

    // fetch
    this.origFetch = window.fetch.bind(window)
    const self = this
    window.fetch = function patchedFetch(...args: Parameters<typeof fetch>) {
      self.pending++
      return self
        .origFetch!(...args)
        .finally(() => { self.pending = Math.max(0, self.pending - 1) })
    }

    // XHR
    const origSend = XMLHttpRequest.prototype.send
    XMLHttpRequest.prototype.send = function patchedSend(this: XMLHttpRequest, ...a: unknown[]) {
      self.pending++
      const done = () => { self.pending = Math.max(0, self.pending - 1) }
      this.addEventListener('loadend', done, { once: true })
      // @ts-expect-error passthrough
      return origSend.apply(this, a)
    }
  }

  /** Resolves when pending === 0 for `quietMs`, or after `timeout`. */
  async waitQuiet(quietMs: number, timeout: number): Promise<boolean> {
    const start = Date.now()
    let quietSince = this.pending === 0 ? Date.now() : 0
    return new Promise((resolve) => {
      const tick = () => {
        if (this.pending === 0) {
          if (quietSince === 0) quietSince = Date.now()
          if (Date.now() - quietSince >= quietMs) return resolve(true)
        } else {
          quietSince = 0
        }
        if (Date.now() - start >= timeout) return resolve(false)
        setTimeout(tick, 50)
      }
      tick()
    })
  }
}

/** Await a `[data-visual-ready="<id>"]` element to exist in the DOM. */
export function waitForReady(id: string, timeout: number): Promise<boolean> {
  if (typeof document === 'undefined') return Promise.resolve(false)
  const sel = `[${READY_ATTR}="${cssEscape(id)}"]`
  if (document.querySelector(sel)) return Promise.resolve(true)
  return new Promise((resolve) => {
    const start = Date.now()
    const obs = new MutationObserver(() => {
      if (document.querySelector(sel)) { obs.disconnect(); resolve(true) }
    })
    obs.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: [READY_ATTR] })
    const poll = () => {
      if (document.querySelector(sel)) { obs.disconnect(); return resolve(true) }
      if (Date.now() - start >= timeout) { obs.disconnect(); return resolve(false) }
      setTimeout(poll, 100)
    }
    poll()
  })
}

/** Await fonts + in-viewport images so text/imagery aren't captured half-loaded. */
export async function waitForAssets(timeout: number): Promise<void> {
  if (typeof document === 'undefined') return
  const deadline = Date.now() + timeout
  try {
    if ('fonts' in document) {
      await Promise.race([
        (document as unknown as { fonts: { ready: Promise<unknown> } }).fonts.ready,
        delay(Math.max(0, deadline - Date.now())),
      ])
    }
  } catch { /* fonts API best-effort */ }
  const imgs = Array.from(document.images).filter((i) => !i.complete && inViewport(i))
  if (imgs.length) {
    await Promise.race([
      Promise.all(imgs.map((i) => new Promise<void>((r) => {
        i.addEventListener('load', () => r(), { once: true })
        i.addEventListener('error', () => r(), { once: true })
      }))),
      delay(Math.max(0, deadline - Date.now())),
    ])
  }
}

// ── Animation / motion freeze (so we never capture mid-transition) ───────────

const FREEZE_STYLE_ID = 'vc-freeze-motion'
export const VISUAL_MODE_CLASS = 'visual-test-mode'

export function enableVisualMode(): void {
  if (typeof document === 'undefined') return
  document.documentElement.classList.add(VISUAL_MODE_CLASS)
  if (document.getElementById(FREEZE_STYLE_ID)) return
  const style = document.createElement('style')
  style.id = FREEZE_STYLE_ID
  style.textContent = `
    .${VISUAL_MODE_CLASS} *,
    .${VISUAL_MODE_CLASS} *::before,
    .${VISUAL_MODE_CLASS} *::after {
      animation-duration: 0s !important;
      animation-delay: 0s !important;
      transition-duration: 0s !important;
      transition-delay: 0s !important;
      caret-color: transparent !important;
      scroll-behavior: auto !important;
    }
  `
  document.head.appendChild(style)
}

export function disableVisualMode(): void {
  if (typeof document === 'undefined') return
  document.documentElement.classList.remove(VISUAL_MODE_CLASS)
  document.getElementById(FREEZE_STYLE_ID)?.remove()
}

// ── small helpers ─────────────────────────────────────────────────────────────

export function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

function inViewport(el: Element): boolean {
  const r = el.getBoundingClientRect()
  return r.bottom > 0 && r.right > 0 && r.top < window.innerHeight && r.left < window.innerWidth
}

function cssEscape(s: string): string {
  // Minimal escape for attribute-value use; CSS.escape when available.
  if (typeof CSS !== 'undefined' && CSS.escape) return CSS.escape(s)
  return s.replace(/["\\]/g, '\\$&')
}
