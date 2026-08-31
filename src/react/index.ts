// @tiny-electrons/voxissue-sdk/react — React adapter.
// Same contract as the Vue adapter: a Navigator over the app's router, the
// dev/staging/staff gate, a controller, and a `useVisualReady` hook for pages
// to signal readiness. The SDK never takes screenshots — inside the VoxIssue
// iOS app the shutter is native; anywhere else a run is a dry-run.

import { useEffect, useRef, useState } from 'react'
import { VisualTestRunner } from '../index.js'
import type {
  VisualSuite, VisualSessionState, RunnerOptions, CaptureEngine, Navigator,
} from '../types.js'
import { MipCaptureEngine, isMipHost } from '../capture/MipCaptureEngine.js'
export { isVisualTestingAllowed } from '../gate.js'
export type { VisualGateInput } from '../gate.js'

/** Navigator over any router: pass the app's navigate + current-path readers. */
export class FunctionNavigator implements Navigator {
  constructor(
    private navigate: (route: string) => void | Promise<void>,
    private getPath: () => string,
  ) {}
  async goto(route: string): Promise<void> { await this.navigate(route) }
  currentRoute(): string { return this.getPath() }
  async settle(): Promise<void> {
    await new Promise<void>((r) => {
      if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(() => requestAnimationFrame(() => r()))
      } else { setTimeout(r, 0) }
    })
  }
}

export interface CreateVisualTestingReactOptions {
  /** e.g. react-router's navigate function. */
  navigate: (route: string) => void | Promise<void>
  /** e.g. () => window.location.pathname + window.location.search */
  currentPath?: () => string
  suites: VisualSuite[]
  engine?: CaptureEngine
  env?: RunnerOptions['env']
  defaultReadyTimeout?: number
  stabilizeQuietMs?: number
  postScrollSettleMs?: number
  /** Auto-start the run when created inside the VoxIssue capture web view (default true). */
  autoStartInMip?: boolean
  onState?: (s: VisualSessionState) => void
}

export interface VisualTestingReactController {
  suites: VisualSuite[]
  selectSuite(id: string): void
  getState(): VisualSessionState | null
  start(): Promise<void>
  pause(): void
  resume(): void
  stop(): void
}

export function createVisualTesting(opts: CreateVisualTestingReactOptions): VisualTestingReactController {
  const engine = opts.engine ?? new MipCaptureEngine()
  const navigator = new FunctionNavigator(
    opts.navigate,
    opts.currentPath ?? (() => (typeof location !== 'undefined' ? location.pathname + location.search : '/')),
  )
  let selected = opts.suites[0]?.id ?? ''
  let runner: VisualTestRunner | null = null
  let state: VisualSessionState | null = null

  function makeRunner(): VisualTestRunner {
    const suite = opts.suites.find((s) => s.id === selected) ?? opts.suites[0]!
    return new VisualTestRunner({
      suite, engine, navigator,
      env: opts.env,
      defaultReadyTimeout: opts.defaultReadyTimeout,
      stabilizeQuietMs: opts.stabilizeQuietMs,
      postScrollSettleMs: opts.postScrollSettleMs,
      onState: (s) => { state = s; opts.onState?.(s) },
    })
  }

  async function start(): Promise<void> {
    runner = makeRunner()
    try {
      await runner.start()
    } finally {
      // VoxIssue host: the run is done — let the app advance to its next page.
      if (engine instanceof MipCaptureEngine) engine.finishRun()
    }
  }

  // VoxIssue host: the whole run is unattended — start once per capture
  // session (the app loads every pages.json URL; without the guard the suite
  // would re-run on every page).
  if ((opts.autoStartInMip ?? true) && isMipHost()) {
    const RAN_KEY = 'vc-mip-autorun-done'
    let alreadyRan = false
    try { alreadyRan = sessionStorage.getItem(RAN_KEY) === '1' } catch { /* private mode */ }
    if (!alreadyRan) {
      try { sessionStorage.setItem(RAN_KEY, '1') } catch { /* ignore */ }
      setTimeout(() => { void start() }, 800)
    }
  }

  return {
    suites: opts.suites,
    selectSuite: (id) => { selected = id },
    getState: () => state,
    start,
    pause: () => runner?.pause(),
    resume: () => runner?.resume(),
    stop: () => runner?.stop(),
  }
}

/**
 * Marks the element ready for capture. Attach the returned ref to the page
 * root; when `ready` is true the runner's waitForReady resolves.
 *
 *   const readyRef = useVisualReady('devices-page', !loading)
 *   <div ref={readyRef}> ... </div>
 */
export function useVisualReady(id: string, ready: boolean) {
  const ref = useRef<HTMLElement | null>(null)
  const [el, setEl] = useState<HTMLElement | null>(null)
  useEffect(() => { setEl(ref.current) })
  useEffect(() => {
    if (!el) return
    if (ready) el.setAttribute('data-visual-ready', id)
    else el.removeAttribute('data-visual-ready')
  }, [el, ready, id])
  return ref
}

export { isMipHost, MipCaptureEngine }
