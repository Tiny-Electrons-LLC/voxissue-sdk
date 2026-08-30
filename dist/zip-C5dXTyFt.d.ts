/** A stable selector into the app. Prefer data-visual-id attributes over text. */
type Selector = string;
interface NavigateAction {
    type: 'navigate';
    /** App route path, e.g. "/inventory/devices". Driven via the Navigator. */
    route: string;
}
interface ClickAction {
    type: 'click';
    target: Selector;
}
interface ScrollAction {
    type: 'scroll';
    /** Named position, an anchor selector, or a 0..1 fraction of scroll height. */
    to: 'top' | 'bottom' | {
        selector: Selector;
    } | {
        percent: number;
    };
}
interface WaitReadyAction {
    type: 'waitForReady';
    /** data-visual-ready id to await, e.g. "devices-page". */
    id: string;
    timeout?: number;
}
interface WaitAction {
    type: 'wait';
    ms: number;
}
interface SetStateAction {
    type: 'setState';
    /** Escape hatch: run an app-registered named state setter (see registerState). */
    name: string;
    payload?: unknown;
}
interface CaptureAction {
    type: 'capture';
    /** Checkpoint id, unique within the scenario. */
    id: string;
    /** Optional label shown in metadata / filenames. */
    label?: string;
}
type VisualAction = NavigateAction | ClickAction | ScrollAction | WaitReadyAction | WaitAction | SetStateAction | CaptureAction;
interface CapturePoint {
    id: string;
    label?: string;
    /** Convenience: scroll before capturing. */
    scroll?: 'top' | 'bottom';
    scrollTo?: Selector;
    scrollPercent?: number;
}
interface VisualScenario {
    id: string;
    name: string;
    route: string;
    /** data-visual-ready id to await after navigation, before acting. */
    waitFor?: string;
    waitTimeout?: number;
    actions?: VisualAction[];
    /** Shorthand checkpoints captured after actions (or right after ready). */
    captures?: CapturePoint[];
}
interface VisualSuite {
    id: string;
    name: string;
    scenarios: VisualScenario[];
}
interface CaptureRequest {
    /** Checkpoint id being captured. */
    checkpointId: string;
    scenarioId: string;
    /** The element to capture. Defaults to the document element (viewport). */
    target?: Element;
    /** Capture only the visible viewport box (true) or the full element (false). */
    viewportOnly: boolean;
}
interface Viewport {
    width: number;
    height: number;
    devicePixelRatio: number;
}
interface CaptureResult {
    /** PNG bytes. */
    blob: Blob;
    width: number;
    height: number;
}
interface CaptureEngine {
    /** Human-readable engine id recorded in metadata (e.g. "dom:modern-screenshot"). */
    readonly id: string;
    capture(req: CaptureRequest): Promise<CaptureResult>;
}
interface CaptureMetadata {
    sessionId: string;
    index: number;
    scenario: string;
    checkpoint: string;
    label?: string;
    route: string;
    timestamp: string;
    viewport: Viewport;
    orientation: 'portrait' | 'landscape';
    browser: string;
    platform: string;
    engine: string;
    appVersion?: string;
    gitCommit?: string;
    /** Stable filename, e.g. 001_inventory-devices_devices-top_390x844.png */
    filename: string;
}
interface StoredCapture {
    meta: CaptureMetadata;
    blob: Blob;
    uploaded: boolean;
}
interface SessionFailure {
    scenario: string;
    checkpoint?: string;
    message: string;
    timestamp: string;
}
type SessionStatus = 'idle' | 'running' | 'paused' | 'complete' | 'stopped' | 'error';
interface VisualSessionState {
    sessionId: string;
    suiteId: string;
    suiteName: string;
    status: SessionStatus;
    startedAt: string;
    finishedAt?: string;
    /** 1-based index of the capture currently being produced. */
    captureIndex: number;
    /** Total planned captures across the suite (for progress). */
    totalCaptures: number;
    currentScenarioId?: string;
    currentScenarioName?: string;
    currentCheckpointId?: string;
    failures: SessionFailure[];
    /** Number of captures uploaded so far (Phase 2). */
    uploaded: number;
}
interface Navigator {
    goto(route: string): Promise<void>;
    currentRoute(): string;
    /** Await the framework's render settle (e.g. Vue nextTick). */
    settle(): Promise<void>;
}
interface Uploader {
    upload(capture: StoredCapture): Promise<void>;
    flush(): Promise<void>;
}
interface RunnerOptions {
    suite: VisualSuite;
    engine: CaptureEngine;
    navigator: Navigator;
    uploader?: Uploader;
    /** Environment metadata for records. */
    env?: {
        appVersion?: string;
        gitCommit?: string;
    };
    /** Default ready-timeout (ms) when a scenario doesn't set one. */
    defaultReadyTimeout?: number;
    /** Quiet-period (ms) after network idle + settle before capturing. */
    stabilizeQuietMs?: number;
    /** Called on every session-state change (drives the UI panel). */
    onState?: (state: VisualSessionState) => void;
}

/** Controls where capture PNGs land inside the ZIP. */
type ZipLayout = 'folder' | 'combined' | 'both';
declare function buildSessionZip(session: VisualSessionState, captures: StoredCapture[], layout?: ZipLayout): Promise<Blob>;
/** Trigger a browser download of a Blob. */
declare function downloadBlob(blob: Blob, filename: string): void;

export { type CaptureEngine as C, type NavigateAction as N, type RunnerOptions as R, type StoredCapture as S, type Uploader as U, type VisualSessionState as V, type WaitAction as W, type ZipLayout as Z, type CaptureRequest as a, type CaptureResult as b, type Viewport as c, type CaptureMetadata as d, type VisualScenario as e, type VisualSuite as f, type CaptureAction as g, type CapturePoint as h, type ClickAction as i, type Navigator as j, type ScrollAction as k, type Selector as l, type SessionFailure as m, type SessionStatus as n, type SetStateAction as o, type VisualAction as p, type WaitReadyAction as q, buildSessionZip as r, downloadBlob as s };
