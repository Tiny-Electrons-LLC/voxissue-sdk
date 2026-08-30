// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import 'fake-indexeddb/auto'
import { VisualTestRunner } from '../runner.js'
import type { CaptureEngine, CaptureResult, Navigator, VisualSuite, Uploader, StoredCapture } from '../types.js'

// jsdom gives us document/window/XHR; fake-indexeddb/auto provides indexedDB. A
// data-visual-ready element is added so waitForReady resolves immediately.
beforeEach(() => {
  document.body.innerHTML = '<div data-visual-ready="a"></div><div data-visual-ready="b"></div>'
})

class FakeEngine implements CaptureEngine {
  id = 'fake'
  calls: string[] = []
  throwOnce = false
  async capture(req: { checkpointId: string }): Promise<CaptureResult> {
    if (this.throwOnce) { this.throwOnce = false; throw new Error('boom') }
    this.calls.push(req.checkpointId)
    return { blob: new Blob([]), width: 1, height: 1 }
  }
}
class FakeNav implements Navigator {
  route = '/'
  async goto(r: string) { this.route = r }
  currentRoute() { return this.route }
  async settle() {}
}
class FakeUploader implements Uploader {
  uploaded: StoredCapture[] = []
  async upload(c: StoredCapture) { this.uploaded.push(c) }
  async flush() {}
}

const suite: VisualSuite = {
  id: 's', name: 'S',
  scenarios: [
    { id: 'a', name: 'A', route: '/a', captures: [{ id: 'top' }, { id: 'bottom' }] },
    { id: 'b', name: 'B', route: '/b', captures: [{ id: 'only' }] },
  ],
}

function make(engine = new FakeEngine()) {
  return {
    engine,
    runner: new VisualTestRunner({
      suite, engine, navigator: new FakeNav(), uploader: new FakeUploader(),
      stabilizeQuietMs: 0, defaultReadyTimeout: 50,
    }),
  }
}

describe('VisualTestRunner', () => {
  it('counts total captures across scenarios up front', () => {
    expect(make().runner.getState().totalCaptures).toBe(3)
  })

  it('runs every checkpoint in order and ends complete', async () => {
    const { runner, engine } = make()
    const final = await runner.start()
    expect(engine.calls).toEqual(['top', 'bottom', 'only'])
    expect(final.status).toBe('complete')
    expect(final.captureIndex).toBe(3)
  })

  it('stop() aborts the run and marks it stopped', async () => {
    const engine = new FakeEngine()
    let stopped = false
    const r = new VisualTestRunner({
      suite, engine, navigator: new FakeNav(), uploader: new FakeUploader(),
      stabilizeQuietMs: 0, defaultReadyTimeout: 50,
      onState: (s) => { if (!stopped && s.captureIndex >= 1) { stopped = true; r.stop() } },
    })
    const final = await r.start()
    expect(final.status).toBe('stopped')
    expect(final.captureIndex).toBeGreaterThanOrEqual(1)
    expect(final.captureIndex).toBeLessThan(3)
  })

  it('can be re-run on the SAME instance without deadlocking (H4)', async () => {
    const { runner } = make()
    expect((await runner.start()).status).toBe('complete')
    const b = await runner.start()
    expect(b.status).toBe('complete')
    expect(b.captureIndex).toBe(3)
  })

  it('isolates a scenario failure and continues to completion', async () => {
    const engine = new FakeEngine()
    engine.throwOnce = true
    const { runner } = make(engine)
    const final = await runner.start()
    expect(final.status).toBe('complete')
    expect(final.failures.length).toBeGreaterThanOrEqual(1)
  })
})
