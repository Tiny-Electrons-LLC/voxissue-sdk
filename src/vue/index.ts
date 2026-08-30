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
import type { ZipLayout } from '../zip.js'
import type {
  VisualSuite, VisualSessionState, RunnerOptions, CaptureEngine, Uploader,
} from '../types.js'
import { RouterNavigator } from './RouterNavigator.js'

export { RouterNavigator }
export { default as VisualTestPanel } from './VisualTestPanel.js'

// ── Gating ────────────────────────────────────────────────────────────────────

export interface VisualGateInput {
  /** import.meta.env.DEV (or a dev/staging flag). Opens the gate outright. */
  isDev?: boolean
  /**
   * Explicit opt-in flag, e.g. import.meta.env.VITE_VISUAL_TESTING === 'true'.
   * REQUIRED in production - it's the only thing that can enable the tool there.
   */
  featureFlag?: boolean
  /**
   * Whether the current user is internal STAFF (superadmin / allowlisted). This
   * is NOT a tenant role: in a multi-tenant SaaS, a tenant "owner" is a paying
   * customer, so passing isOwner here would expose the tool - which screenshots
   * live tenant data - to every customer. `isStaff` only NARROWS access; it can
   * never open the gate on its own (the feature flag must also be on).
   */
  isStaff?: boolean
}

/**
 * Access rules (deliberately conservative - this tool captures live DOM/tenant
 * data to images + IndexedDB + a downloadable ZIP):
 *   - dev/staging (isDev): allowed.
 *   - production: allowed ONLY when the feature flag is on. If isStaff is
 *     provided, the flag AND isStaff are both required (so a leaked flag alone
 *     doesn't expose it to a customer). isStaff by itself never grants access.
 * Never pass a tenant role (owner/admin) as isStaff.
 */
export function isVisualTestingAllowed(g: VisualGateInput): boolean {
  if (g.isDev) return true
  if (!g.featureFlag) return false
  // Flag is on. If a staff signal is supplied, require it too; otherwise the
  // flag alone (a deliberate prod opt-in) is sufficient.
  return g.isStaff === undefined ? true : g.isStaff === true
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
  /** ZIP layout: foldered by scenario, flat in _combined/, or both. */
  zipLayout: Ref<ZipLayout>
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
  const zipLayout = ref<ZipLayout>('both')
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
    } catch (e) {
      // Swallow here so a runner throw doesn't become an app-level unhandled
      // rejection (some apps have a global handler for auth recovery). The
      // runner already emitted status:'error'; surface a message on state.
      const s = runner.getState()
      s.failures.push({ scenario: '(runner)', message: String((e as Error)?.message ?? e).slice(0, 300), timestamp: new Date().toISOString() })
      state.value = { ...s }
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
    const zip = await buildSessionZip(state.value, captures, zipLayout.value)
    const day = new Date().toISOString().slice(0, 10)
    downloadBlob(zip, `visual-capture-${day}.zip`)
  }

  return { suites, selectedSuiteId, state: readonly(state) as Readonly<Ref<VisualSessionState | null>>, running: readonly(running), zipLayout, start, pause, resume, stop, downloadZip }
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
