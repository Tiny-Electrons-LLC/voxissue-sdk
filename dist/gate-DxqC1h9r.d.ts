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
    /** Human-readable engine id (e.g. "native:voxissue"). */
    readonly id: string;
    capture(req: CaptureRequest): Promise<CaptureResult>;
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
}
interface Navigator {
    goto(route: string): Promise<void>;
    currentRoute(): string;
    /** Await the framework's render settle (e.g. Vue nextTick). */
    settle(): Promise<void>;
}
interface RunnerOptions {
    suite: VisualSuite;
    engine: CaptureEngine;
    navigator: Navigator;
    /** Environment metadata for records. */
    env?: {
        appVersion?: string;
        gitCommit?: string;
    };
    /** Default ready-timeout (ms) when a scenario doesn't set one. */
    defaultReadyTimeout?: number;
    /** Quiet-period (ms) after network idle + settle before capturing. */
    stabilizeQuietMs?: number;
    /**
     * Extra pause (ms) after a scroll, before capturing, so smooth-scroll
     * momentum + repaint settle (a scroll causes no network activity, so the
     * network-quiet wait can't cover it). Default 400. Raise if scrolled captures
     * look blurry / half-painted on slower devices.
     */
    postScrollSettleMs?: number;
    /** Called on every session-state change (drives the UI panel). */
    onState?: (state: VisualSessionState) => void;
}

interface VisualGateInput {
    /** import.meta.env.DEV (or a dev/staging flag). Opens the gate outright. */
    isDev?: boolean;
    /**
     * Explicit opt-in flag, e.g. import.meta.env.VITE_VISUAL_TESTING === 'true'.
     * REQUIRED in production - it's the only thing that can enable the tool there.
     */
    featureFlag?: boolean;
    /**
     * Whether the current user is internal STAFF (superadmin / allowlisted). This
     * is NOT a tenant role: in a multi-tenant SaaS, a tenant "owner" is a paying
     * customer, so passing isOwner here would expose the tool - which screenshots
     * live tenant data - to every customer. `isStaff` only NARROWS access; it can
     * never open the gate on its own (the feature flag must also be on).
     */
    isStaff?: boolean;
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
declare function isVisualTestingAllowed(g: VisualGateInput): boolean;

export { type CaptureAction as C, type NavigateAction as N, type RunnerOptions as R, type ScrollAction as S, type VisualSessionState as V, type WaitAction as W, type Viewport as a, type VisualScenario as b, type VisualSuite as c, type CaptureEngine as d, type CapturePoint as e, type CaptureRequest as f, type CaptureResult as g, type ClickAction as h, type Navigator as i, type Selector as j, type SessionFailure as k, type SessionStatus as l, type SetStateAction as m, type VisualAction as n, type VisualGateInput as o, type WaitReadyAction as p, isVisualTestingAllowed as q };
