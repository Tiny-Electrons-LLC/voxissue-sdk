// @tiny-electrons/voxissue-sdk/vue — Vue 3 adapter.
// Wires the framework-agnostic runner to a Vue app: a router-based Navigator,
// a gating helper for dev/staging/owner-only exposure, a reactive controller,
// and a `useVisualReady` composable for app pages to signal readiness.
// The SDK never takes screenshots — inside the VoxIssue iOS app the shutter is
// native; anywhere else a run is a dry-run (navigation + readiness only).

import { ref, shallowRef, readonly, onMounted, onBeforeUnmount, type Ref } from 'vue'
import type { Router } from 'vue-router'
import { VisualTestRunner } from '../index.js'
export { isVisualTestingAllowed } from '../gate.js'
export type { VisualGateInput } from '../gate.js'
import type {
  VisualSuite, VisualSessionState, RunnerOptions, CaptureEngine,
} from '../types.js'
import { RouterNavigator } from './RouterNavigator.js'
import { MipCaptureEngine, isMipHost } from '../capture/MipCaptureEngine.js'

export { RouterNavigator }

// ── Controller (reactive facade the panel binds to) ──────────────────────────

export interface CreateVisualTestingOptions {
  router: Router
  /** One or more suites the user can pick from. */
  suites: VisualSuite[]
  /** Capture engine; defaults to the VoxIssue native-shutter engine. */
  engine?: CaptureEngine
  env?: RunnerOptions['env']
  defaultReadyTimeout?: number
  stabilizeQuietMs?: number
  postScrollSettleMs?: number
  /** Auto-start the run when created inside the MIP capture web view (default true). */
  autoStartInMip?: boolean
}

export interface VisualTestingController {
  suites: VisualSuite[]
  selectedSuiteId: Ref<string>
  state: Readonly<Ref<VisualSessionState | null>>
  running: Readonly<Ref<boolean>>
  start(): Promise<void>
  pause(): void
  resume(): void
  stop(): void
}

export function createVisualTesting(opts: CreateVisualTestingOptions): VisualTestingController {
  // The shutter is always native: inside the VoxIssue iOS app, capture()
  // signals a real WKWebView snapshot; outside it, calls are no-ops (dry-run).
  const engine = opts.engine ?? new MipCaptureEngine()
  const navigator = new RouterNavigator(opts.router)

  const suites = opts.suites
  const selectedSuiteId = ref(suites[0]?.id ?? '')
  const state = shallowRef<VisualSessionState | null>(null)
  const running = ref(false)
  let runner: VisualTestRunner | null = null

  function makeRunner(): VisualTestRunner {
    const suite = suites.find((s) => s.id === selectedSuiteId.value) ?? suites[0]!
    return new VisualTestRunner({
      suite,
      engine,
      navigator,
      env: opts.env,
      defaultReadyTimeout: opts.defaultReadyTimeout,
      stabilizeQuietMs: opts.stabilizeQuietMs,
      postScrollSettleMs: opts.postScrollSettleMs,
      onState: (s) => { state.value = s },
    })
  }

  // MIP host: the whole run is unattended — start as soon as the controller
  // exists (the app decides when that is, e.g. once auth/allowlist resolves).
  // Guarded to ONCE per capture session: MIP loads every pages.json URL and each
  // load boots the app — without the guard the suite (which navigates the SPA
  // itself, usually starting at /dashboard) would re-run on every single page.
  if ((opts.autoStartInMip ?? true) && isMipHost()) {
    const RAN_KEY = 'vc-mip-autorun-done'
    let alreadyRan = false
    try { alreadyRan = sessionStorage.getItem(RAN_KEY) === '1' } catch { /* private mode */ }
    if (!alreadyRan) {
      try { sessionStorage.setItem(RAN_KEY, '1') } catch { /* ignore */ }
      setTimeout(() => { void start() }, 800)
    }
  }

  async function start(): Promise<void> {
    if (running.value) return
    runner = makeRunner()
    running.value = true
    try {
      await runner.start()
    } catch (e) {
      // Swallow here so a runner throw doesn't become an app-level unhandled
      // rejection (some apps have a global handler for auth recovery). The
      // runner already emitted status:'error'; surface a message on state.
      const s = runner.getState()
      s.failures.push({ scenario: '(runner)', message: String((e as Error)?.message ?? e).slice(0, 300), timestamp: new Date().toISOString() })
      state.value = { ...s }
    } finally {
      running.value = false
      // MIP host: the run is done — let the app advance to its next page.
      if (engine instanceof MipCaptureEngine) engine.finishRun()
    }
  }

  function pause(): void { runner?.pause() }
  function resume(): void { runner?.resume() }
  function stop(): void { runner?.stop() }

  return { suites, selectedSuiteId, state: readonly(state) as Readonly<Ref<VisualSessionState | null>>, running: readonly(running), start, pause, resume, stop }
}

// ── useVisualReady: app pages call this to emit their readiness signal ────────

/**
 * Marks the mounting element ready for capture. Attach the returned ref to the
 * page root; when `ready` flips true the runner's waitForReady resolves.
 *
 *   const { readyEl } = useVisualReady('devices-page')
 *   <div ref="readyEl"> ... </div>
 *   // then, after data loads:
 *   markReady()
 */
export function useVisualReady(id: string, autoOnMount = false) {
  const readyEl = ref<HTMLElement | null>(null)
  const isReady = ref(false)

  function markReady(): void {
    isReady.value = true
    readyEl.value?.setAttribute('data-visual-ready', id)
  }
  function clearReady(): void {
    isReady.value = false
    readyEl.value?.removeAttribute('data-visual-ready')
  }

  onMounted(() => { if (autoOnMount) markReady() })
  onBeforeUnmount(clearReady)

  return { readyEl, isReady: readonly(isReady), markReady, clearReady }
}
