// ─────────────────────────────────────────────────────────────────────────────
// Public types for the visual-capture library. These are framework-agnostic:
// nothing here imports Vue. The runner, manifest, storage, and capture engine all
// speak in these shapes so the capture mechanism (DOM today, native iOS later)
// and the navigation mechanism (vue-router today) are swappable.
// ─────────────────────────────────────────────────────────────────────────────

/** A stable selector into the app. Prefer data-visual-id attributes over text. */
export type Selector = string

// ── Actions a scenario can perform before/around a capture ──────────────────

export interface NavigateAction {
  type: 'navigate'
  /** App route path, e.g. "/inventory/devices". Driven via the Navigator. */
  route: string
}

export interface ClickAction {
  type: 'click'
  target: Selector
}

export interface ScrollAction {
  type: 'scroll'
  /** Named position, an anchor selector, or a 0..1 fraction of scroll height. */
  to: 'top' | 'bottom' | { selector: Selector } | { percent: number }
}

export interface WaitReadyAction {
  type: 'waitForReady'
  /** data-visual-ready id to await, e.g. "devices-page". */
  id: string
  timeout?: number
}

export interface WaitAction {
  type: 'wait'
  ms: number
}

export interface SetStateAction {
  type: 'setState'
  /** Escape hatch: run an app-registered named state setter (see registerState). */
  name: string
  payload?: unknown
}

export interface CaptureAction {
  type: 'capture'
  /** Checkpoint id, unique within the scenario. */
  id: string
  /** Optional label shown in metadata / filenames. */
  label?: string
}

export type VisualAction =
  | NavigateAction
  | ClickAction
  | ScrollAction
  | WaitReadyAction
  | WaitAction
  | SetStateAction
  | CaptureAction

// ── A capture checkpoint (used by the shorthand `captures` array) ───────────

export interface CapturePoint {
  id: string
  label?: string
  /** Convenience: scroll before capturing. */
  scroll?: 'top' | 'bottom'
  scrollTo?: Selector
  scrollPercent?: number
}

// ── A scenario: one route + a sequence of actions + capture checkpoints ──────

export interface VisualScenario {
  id: string
  name: string
  route: string
  /** data-visual-ready id to await after navigation, before acting. */
  waitFor?: string
  waitTimeout?: number
  actions?: VisualAction[]
  /** Shorthand checkpoints captured after actions (or right after ready). */
  captures?: CapturePoint[]
}

export interface VisualSuite {
  id: string
  name: string
  scenarios: VisualScenario[]
}

// ── Capture engine contract (DOM now, native/Playwright later) ───────────────

export interface CaptureRequest {
  /** Checkpoint id being captured. */
  checkpointId: string
  scenarioId: string
  /** The element to capture. Defaults to the document element (viewport). */
  target?: Element
  /** Capture only the visible viewport box (true) or the full element (false). */
  viewportOnly: boolean
}

export interface Viewport {
  width: number
  height: number
  devicePixelRatio: number
}

export interface CaptureResult {
  /** PNG bytes. */
  blob: Blob
  width: number
  height: number
}

export interface CaptureEngine {
  /** Human-readable engine id recorded in metadata (e.g. "dom:modern-screenshot"). */
  readonly id: string
  capture(req: CaptureRequest): Promise<CaptureResult>
}

// ── Per-capture metadata (one JSON record per PNG) ───────────────────────────

export interface CaptureMetadata {
  sessionId: string
  index: number
  scenario: string
  checkpoint: string
  label?: string
  route: string
  timestamp: string
  viewport: Viewport
  orientation: 'portrait' | 'landscape'
  browser: string
  platform: string
  engine: string
  appVersion?: string
  gitCommit?: string
  /** Stable filename, e.g. 001_inventory-devices_devices-top_390x844.png */
  filename: string
}

export interface StoredCapture {
  meta: CaptureMetadata
  blob: Blob
  uploaded: boolean
}

// ── Session ──────────────────────────────────────────────────────────────────

export interface SessionFailure {
  scenario: string
  checkpoint?: string
  message: string
  timestamp: string
}

export type SessionStatus = 'idle' | 'running' | 'paused' | 'complete' | 'stopped' | 'error'

export interface VisualSessionState {
  sessionId: string
  suiteId: string
  suiteName: string
  status: SessionStatus
  startedAt: string
  finishedAt?: string
  /** 1-based index of the capture currently being produced. */
  captureIndex: number
  /** Total planned captures across the suite (for progress). */
  totalCaptures: number
  currentScenarioId?: string
  currentScenarioName?: string
  currentCheckpointId?: string
  failures: SessionFailure[]
  /** Number of captures uploaded so far (Phase 2). */
  uploaded: number
}

// ── Navigator (how the runner changes app route). vue-router adapter provides
//    the concrete implementation; core stays framework-agnostic. ──────────────

export interface Navigator {
  goto(route: string): Promise<void>
  currentRoute(): string
  /** Await the framework's render settle (e.g. Vue nextTick). */
  settle(): Promise<void>
}

// ── Uploader contract (Phase 2; a no-op default lets the MVP ship). ──────────

export interface Uploader {
  upload(capture: StoredCapture): Promise<void>
  flush(): Promise<void>
}

// ── Runner options ───────────────────────────────────────────────────────────

export interface RunnerOptions {
  suite: VisualSuite
  engine: CaptureEngine
  navigator: Navigator
  uploader?: Uploader
  /** Environment metadata for records. */
  env?: { appVersion?: string; gitCommit?: string }
  /** Default ready-timeout (ms) when a scenario doesn't set one. */
  defaultReadyTimeout?: number
  /** Quiet-period (ms) after network idle + settle before capturing. */
  stabilizeQuietMs?: number
  /**
   * Extra pause (ms) after a scroll, before capturing, so smooth-scroll
   * momentum + repaint settle (a scroll causes no network activity, so the
   * network-quiet wait can't cover it). Default 400. Raise if scrolled captures
   * look blurry / half-painted on slower devices.
   */
  postScrollSettleMs?: number
  /** Called on every session-state change (drives the UI panel). */
  onState?: (state: VisualSessionState) => void
}
