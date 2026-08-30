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
        .catch(() => this.queue.push(cap)) // requeue on hard failure
        .finally(() => { this.active--; this.pump() })
    }
  }

  private async send(cap: StoredCapture, attempt = 1): Promise<void> {
    try {
      const form = new FormData()
      form.append('meta', JSON.stringify(cap.meta))
      form.append('image', cap.blob, cap.meta.filename)
      const res = await fetch(this.opts.endpoint, { method: 'POST', headers: this.opts.headers, body: form })
      if (!res.ok) throw new Error(`upload ${res.status}`)
    } catch (e) {
      if (attempt >= this.opts.maxRetries) throw e
      await new Promise((r) => setTimeout(r, 500 * attempt))
      return this.send(cap, attempt + 1)
    }
  }

  async flush(): Promise<void> {
    while (this.active > 0 || this.queue.length > 0) {
      await new Promise((r) => setTimeout(r, 100))
    }
  }
}
