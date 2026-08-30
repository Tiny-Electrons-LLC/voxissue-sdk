// @tiny-electrons/visual-capture/vue — Vue 3 adapter.
// Wires the framework-agnostic runner to a Vue app: a router-based Navigator, a
// gating helper for dev/staging/owner-only exposure, a reactive controller for
// the dev panel, and a `useVisualReady` composable for app pages to signal
// readiness. The <VisualTestPanel> component is exported separately.

import { ref, shallowRef, readonly, onMounted, onBeforeUnmount, type Ref } from 'vue'
import type { Router } from 'vue-router'
import {
  VisualTestRunner, DomCaptureEngine, buildSessionZip, downloadBlob,
} from '../index.js'
import type {
  VisualSuite, VisualSessionState, RunnerOptions, CaptureEngine, Uploader,
} from '../types.js'
import { RouterNavigator } from './RouterNavigator.js'

export { RouterNavigator }
export { default as VisualTestPanel } from './VisualTestPanel.js'

// ── Gating ────────────────────────────────────────────────────────────────────

export interface VisualGateInput {
  /** import.meta.env.DEV, or a computed dev/staging flag. */
  isDev?: boolean
  /** An explicit feature flag, e.g. import.meta.env.VITE_VISUAL_TESTING === 'true'. */
  featureFlag?: boolean
  /** Whether the current user is an owner/admin (app-provided). */
  isPrivileged?: boolean
}

/**
 * Visual testing is available only in dev/staging, behind a feature flag, OR to a
 * privileged (owner/admin) user. Never expose to ordinary production users.
 */
export function isVisualTestingAllowed(g: VisualGateInput): boolean {
  return Boolean(g.isDev || g.featureFlag || g.isPrivileged)
}

// ── Controller (reactive facade the panel binds to) ──────────────────────────

export interface CreateVisualTestingOptions {
  router: Router
  /** One or more suites the user can pick from. */
  suites: VisualSuite[]
  /** Capture engine; defaults to DOM capture (modern-screenshot). */
  engine?: CaptureEngine
  uploader?: Uploader
  env?: RunnerOptions['env']
  defaultReadyTimeout?: number
  stabilizeQuietMs?: number
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
  downloadZip(): Promise<void>
}

export function createVisualTesting(opts: CreateVisualTestingOptions): VisualTestingController {
  const engine = opts.engine ?? new DomCaptureEngine()
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
      uploader: opts.uploader,
      env: opts.env,
      defaultReadyTimeout: opts.defaultReadyTimeout,
      stabilizeQuietMs: opts.stabilizeQuietMs,
      onState: (s) => { state.value = s },
    })
  }

  async function start(): Promise<void> {
    if (running.value) return
    runner = makeRunner()
    running.value = true
    try {
      await runner.start()
    } finally {
      running.value = false
    }
  }

  function pause(): void { runner?.pause() }
  function resume(): void { runner?.resume() }
  function stop(): void { runner?.stop() }

  async function downloadZip(): Promise<void> {
    if (!runner || !state.value) return
    const captures = await runner.getStoredCaptures()
    const zip = await buildSessionZip(state.value, captures)
    const day = new Date().toISOString().slice(0, 10)
    downloadBlob(zip, `visual-capture-${day}.zip`)
  }

  return { suites, selectedSuiteId, state: readonly(state) as Readonly<Ref<VisualSessionState | null>>, running: readonly(running), start, pause, resume, stop, downloadZip }
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
