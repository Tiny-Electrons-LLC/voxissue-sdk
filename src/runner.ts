// ─────────────────────────────────────────────────────────────────────────────
// The runner: the deliberately-boring, deterministic engine that drives the app
// through a suite and fires the shutter at each checkpoint. The SDK never takes
// screenshots itself — the CaptureEngine only SIGNALS the VoxIssue iOS app,
// which snapshots natively. Flow per checkpoint: navigate -> waitForReady ->
// actions -> stabilize -> signal capture. Failing scenarios are recorded and
// skipped, not fatal.
// ─────────────────────────────────────────────────────────────────────────────

import type {
  RunnerOptions, VisualScenario, VisualAction, CapturePoint,
  VisualSessionState, CaptureEngine, Navigator,
} from './types.js'
import {
  NetworkTracker, waitForReady, waitForAssets, enableVisualMode, disableVisualMode, delay,
} from './readiness.js'
import { performScroll } from './dom.js'

export class VisualTestRunner {
  private opts: RunnerOptions
  private engine: CaptureEngine
  private nav: Navigator
  private net = new NetworkTracker()

  private state: VisualSessionState
  private pauseGate: Promise<void> | null = null
  private resumeFn: (() => void) | null = null
  private stopped = false

  private readyTimeout: number
  private quietMs: number
  private postScrollSettleMs: number

  constructor(opts: RunnerOptions) {
    this.opts = opts
    this.engine = opts.engine
    this.nav = opts.navigator
    this.readyTimeout = opts.defaultReadyTimeout ?? 10000
    this.quietMs = opts.stabilizeQuietMs ?? 300
    // Extra pause AFTER a scroll, before capturing. A scroll triggers no
    // network activity, so waitQuiet returns immediately and we'd shoot
    // mid-momentum - on iOS Safari that yields a visibly blurry / half-painted
    // frame. This gives smooth-scroll inertia, sticky repaint, and lazy content
    // time to settle. Two animation frames + this delay.
    this.postScrollSettleMs = opts.postScrollSettleMs ?? 400
    this.state = this.freshState()
  }

  getState(): VisualSessionState { return this.state }

  private freshState(): VisualSessionState {
    return {
      sessionId: newId(),
      suiteId: this.opts.suite.id,
      suiteName: this.opts.suite.name,
      status: 'idle',
      startedAt: new Date().toISOString(),
      captureIndex: 0,
      totalCaptures: countCaptures(this.opts.suite.scenarios),
      failures: [],
    }
  }

  private emit(patch: Partial<VisualSessionState>): void {
    this.state = { ...this.state, ...patch }
    this.opts.onState?.(this.state)
  }

  // ── lifecycle ────────────────────────────────────────────────────────────

  async start(): Promise<VisualSessionState> {
    this.stopped = false
    // Clear any stale pause gate from a prior run so a reused runner can't
    // deadlock at the first gate() (H4).
    this.pauseGate = null
    this.resumeFn = null
    this.state = this.freshState()
    this.net.install()
    enableVisualMode()
    this.emit({ status: 'running' })

    try {
      for (const scenario of this.opts.suite.scenarios) {
        if (this.stopped) break
        await this.gate()
        await this.runScenario(scenario)
      }
      this.emit({ status: this.stopped ? 'stopped' : 'complete', finishedAt: new Date().toISOString() })
    } catch (e) {
      this.emit({ status: 'error', finishedAt: new Date().toISOString() })
      throw e
    } finally {
      disableVisualMode()
    }
    return this.state
  }

  pause(): void {
    if (this.state.status !== 'running') return
    this.pauseGate = new Promise((res) => { this.resumeFn = res })
    this.emit({ status: 'paused' })
  }

  resume(): void {
    if (this.state.status !== 'paused') return
    this.emit({ status: 'running' })
    this.resumeFn?.()
    this.pauseGate = null
    this.resumeFn = null
  }

  stop(): void {
    this.stopped = true
    this.resumeFn?.() // unblock a paused run so it can exit
  }

  private async gate(): Promise<void> { if (this.pauseGate) await this.pauseGate }

  // ── scenario execution ─────────────────────────────────────────────────────

  private async runScenario(scenario: VisualScenario): Promise<void> {
    this.emit({ currentScenarioId: scenario.id, currentScenarioName: scenario.name, currentCheckpointId: undefined })
    try {
      await this.nav.goto(scenario.route)
      await this.nav.settle()
      if (scenario.waitFor) {
        const ok = await waitForReady(scenario.waitFor, scenario.waitTimeout ?? this.readyTimeout)
        // A missing ready signal is NOT fatal: a slow-loading or legitimately
        // empty page (no data seeded) should still be captured - that rendered
        // state is often exactly what you want to see. Record a soft failure for
        // visibility, then proceed to capture the checkpoints anyway rather than
        // aborting the whole scenario to a single error-state frame.
        if (!ok) this.recordFailure(scenario.id, undefined, new Error(`ready signal "${scenario.waitFor}" not seen within timeout (captured anyway)`))
      }
      await this.stabilize()

      // Explicit action list takes precedence; else fall back to `captures`.
      if (scenario.actions?.length) {
        for (const action of scenario.actions) {
          if (this.stopped) break
          await this.gate()
          await this.runAction(scenario, action)
        }
      }
      if (scenario.captures?.length) {
        for (const cp of scenario.captures) {
          if (this.stopped) break
          await this.gate()
          await this.runCheckpoint(scenario, cp)
        }
      }
    } catch (e) {
      this.recordFailure(scenario.id, undefined, e)
      // Best-effort error-state capture so failures are still visible.
      try { await this.captureNow(scenario, `error-${scenario.id}`, 'error state') } catch { /* ignore */ }
    }
  }

  private async runAction(scenario: VisualScenario, action: VisualAction): Promise<void> {
    switch (action.type) {
      case 'navigate':
        await this.nav.goto(action.route); await this.nav.settle(); await this.stabilize(); break
      case 'click': {
        const el = document.querySelector<HTMLElement>(action.target)
        if (!el) throw new Error(`click target not found: ${action.target}`)
        el.click(); await this.nav.settle(); await this.stabilize(); break
      }
      case 'scroll':
        await performScroll(action.to); await this.stabilize(); break
      case 'waitForReady': {
        const ok = await waitForReady(action.id, action.timeout ?? this.readyTimeout)
        if (!ok) throw new Error(`ready "${action.id}" not seen`); break
      }
      case 'wait':
        await delay(action.ms); break
      case 'setState':
        window.dispatchEvent(new CustomEvent('voxissue:setState', { detail: { name: action.name, payload: action.payload } }))
        await this.nav.settle(); await this.stabilize(); break
      case 'capture':
        await this.captureNow(scenario, action.id, action.label); break
    }
  }

  private async runCheckpoint(scenario: VisualScenario, cp: CapturePoint): Promise<void> {
    let scrolled = false
    if (cp.scroll) { await performScroll(cp.scroll); scrolled = true }
    else if (cp.scrollTo) { await performScroll({ selector: cp.scrollTo }); scrolled = true }
    else if (typeof cp.scrollPercent === 'number') { await performScroll({ percent: cp.scrollPercent }); scrolled = true }
    await this.stabilize()
    // After a scroll, wait out momentum/repaint so the frame isn't blurry.
    if (scrolled) await this.settleAfterScroll()
    await this.captureNow(scenario, cp.id, cp.label)
  }

  /** Two animation frames + a delay so a scrolled viewport is fully painted. */
  private async settleAfterScroll(): Promise<void> {
    if (typeof requestAnimationFrame === 'function') {
      await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))
    }
    await delay(this.postScrollSettleMs)
  }

  // ── capture + stabilization ─────────────────────────────────────────────────

  /** Wait for network quiet + assets + a short settle so the frame is stable. */
  private async stabilize(): Promise<void> {
    await this.net.waitQuiet(this.quietMs, this.readyTimeout)
    await waitForAssets(2000)
    await this.nav.settle()
    await delay(this.quietMs)
  }

  /** Signal the shutter — no pixels are produced or stored in the SDK. */
  private async captureNow(scenario: VisualScenario, checkpointId: string, label?: string): Promise<void> {
    const index = this.state.captureIndex + 1
    this.emit({ captureIndex: index, currentCheckpointId: checkpointId })
    void label
    await this.engine.capture({
      scenarioId: scenario.id,
      checkpointId,
      viewportOnly: true,
    })
  }

  private recordFailure(scenario: string, checkpoint: string | undefined, err: unknown): void {
    this.emit({
      failures: [
        ...this.state.failures,
        { scenario, checkpoint, message: String((err as Error)?.message ?? err).slice(0, 300), timestamp: new Date().toISOString() },
      ],
    })
  }

}

function countCaptures(scenarios: VisualScenario[]): number {
  let n = 0
  for (const s of scenarios) {
    n += (s.actions ?? []).filter((a) => a.type === 'capture').length
    n += (s.captures ?? []).length
  }
  return n
}

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return 'vc-' + Math.random().toString(36).slice(2) + Date.now().toString(36)
}
