// Uploaders. The MVP ships with a NoopUploader (local-only + ZIP). Phase 2 adds
// a real HTTP uploader with a bounded queue + retry; both satisfy the Uploader
// interface so the runner is unchanged.

import type { StoredCapture, Uploader } from './types.js'

export class NoopUploader implements Uploader {
  async upload(_capture: StoredCapture): Promise<void> { /* local-only */ }
  async flush(): Promise<void> { /* nothing to flush */ }
}

export interface HttpUploaderOptions {
  /** POST endpoint receiving multipart { meta, image }. */
  endpoint: string
  /** Extra headers (auth, CSRF). */
  headers?: Record<string, string>
  concurrency?: number
  maxRetries?: number
  /** Called after each successful upload (e.g. mark stored capture uploaded). */
  onUploaded?: (capture: StoredCapture) => void
}

/**
 * Bounded async upload queue. The runner adds captures via upload() without
 * awaiting network; a temporary failure retries and never aborts the run. Phase
 * 2 wires this in place of NoopUploader.
 */
export class HttpUploader implements Uploader {
  private queue: StoredCapture[] = []
  private active = 0
  private opts: Required<Omit<HttpUploaderOptions, 'headers' | 'onUploaded'>> & HttpUploaderOptions
  /** Captures that exhausted their retries; they stay in IDB (uploaded:false). */
  readonly failed: StoredCapture[] = []
  // Use the ORIGINAL fetch (captured at construction, before NetworkTracker may
  // have wrapped it) so uploads don't count as "pending" network and stall the
  // runner's stabilize() on every subsequent scenario.
  private readonly rawFetch = (typeof window !== 'undefined' ? window.fetch.bind(window) : fetch)

  constructor(opts: HttpUploaderOptions) {
    this.opts = { concurrency: 2, maxRetries: 3, ...opts }
  }

  async upload(capture: StoredCapture): Promise<void> {
    this.queue.push(capture)
    this.pump()
  }

  private pump(): void {
    while (this.active < this.opts.concurrency && this.queue.length) {
      const cap = this.queue.shift()!
      this.active++
      this.send(cap)
        .then(() => this.opts.onUploaded?.(cap))
        // Hard failure after maxRetries: DROP it (do NOT requeue - that loops
        // forever and deadlocks flush()). It's retained in IDB, so a later run
        // or manual retry can re-send it. (H2)
        .catch(() => { this.failed.push(cap) })
        .finally(() => { this.active--; this.pump() })
    }
  }

  private async send(cap: StoredCapture, attempt = 1): Promise<void> {
    try {
      const form = new FormData()
      form.append('meta', JSON.stringify(cap.meta))
      form.append('image', cap.blob, cap.meta.filename)
      const res = await this.rawFetch(this.opts.endpoint, { method: 'POST', headers: this.opts.headers, body: form })
      if (!res.ok) throw new Error(`upload ${res.status}`)
    } catch (e) {
      if (attempt >= this.opts.maxRetries) throw e
      await new Promise((r) => setTimeout(r, 500 * attempt))
      return this.send(cap, attempt + 1)
    }
  }

  async flush(timeoutMs = 30000): Promise<void> {
    // Deadline so a stuck queue can never hang the caller (the run awaits this).
    const deadline = Date.now() + timeoutMs
    while ((this.active > 0 || this.queue.length > 0) && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 100))
    }
  }
}
