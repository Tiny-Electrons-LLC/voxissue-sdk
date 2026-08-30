import { R as RunnerOptions, V as VisualSessionState, S as StoredCapture, C as CaptureEngine, a as CaptureRequest, b as CaptureResult, U as Uploader, c as Viewport, d as CaptureMetadata, e as VisualScenario, f as VisualSuite } from './zip-C5dXTyFt.js';
export { g as CaptureAction, h as CapturePoint, i as ClickAction, N as NavigateAction, j as Navigator, k as ScrollAction, l as Selector, m as SessionFailure, n as SessionStatus, o as SetStateAction, p as VisualAction, W as WaitAction, q as WaitReadyAction, Z as ZipLayout, r as buildSessionZip, s as downloadBlob } from './zip-C5dXTyFt.js';

declare class VisualTestRunner {
    private opts;
    private engine;
    private nav;
    private uploader;
    private storage;
    private net;
    private state;
    private pauseGate;
    private resumeFn;
    private stopped;
    private readyTimeout;
    private quietMs;
    constructor(opts: RunnerOptions);
    getState(): VisualSessionState;
    private freshState;
    private emit;
    start(): Promise<VisualSessionState>;
    pause(): void;
    resume(): void;
    stop(): void;
    private gate;
    private runScenario;
    private runAction;
    private runCheckpoint;
    /** Wait for network quiet + assets + a short settle so the frame is stable. */
    private stabilize;
    private captureNow;
    private recordFailure;
    getStoredCaptures(): Promise<StoredCapture[]>;
}

interface DomCaptureOptions {
    /** Solid backdrop so transparent bodies don't render black. */
    backgroundColor?: string;
    /** Extra work per clone (e.g. app-specific scrubbing). */
    onClone?: (doc: Document) => void;
}
declare class DomCaptureEngine implements CaptureEngine {
    readonly id = "dom:modern-screenshot";
    private opts;
    constructor(opts?: DomCaptureOptions);
    capture(req: CaptureRequest): Promise<CaptureResult>;
}

declare class VisualStorage {
    private dbP;
    saveCapture(sessionId: string, capture: StoredCapture): Promise<void>;
    markUploaded(sessionId: string, index: number): Promise<void>;
    listCaptures(sessionId: string): Promise<StoredCapture[]>;
    saveSession(state: VisualSessionState): Promise<void>;
    getSession(sessionId: string): Promise<VisualSessionState | undefined>;
    latestSession(): Promise<VisualSessionState | undefined>;
    clearSession(sessionId: string): Promise<void>;
    /**
     * Prune every session EXCEPT `keepSessionId`, so IndexedDB doesn't grow
     * unbounded across runs (each run is ~11 PNGs at DPR 3 = tens of MB). On iOS
     * Safari an over-quota origin gets its whole storage evicted, so keeping only
     * the current run's captures is deliberate. (H5)
     */
    pruneOldSessions(keepSessionId: string): Promise<void>;
}

declare class NoopUploader implements Uploader {
    upload(_capture: StoredCapture): Promise<void>;
    flush(): Promise<void>;
}
interface HttpUploaderOptions {
    /** POST endpoint receiving multipart { meta, image }. */
    endpoint: string;
    /** Extra headers (auth, CSRF). */
    headers?: Record<string, string>;
    concurrency?: number;
    maxRetries?: number;
    /** Called after each successful upload (e.g. mark stored capture uploaded). */
    onUploaded?: (capture: StoredCapture) => void;
}
/**
 * Bounded async upload queue. The runner adds captures via upload() without
 * awaiting network; a temporary failure retries and never aborts the run. Phase
 * 2 wires this in place of NoopUploader.
 */
declare class HttpUploader implements Uploader {
    private queue;
    private active;
    private opts;
    /** Captures that exhausted their retries; they stay in IDB (uploaded:false). */
    readonly failed: StoredCapture[];
    private readonly rawFetch;
    constructor(opts: HttpUploaderOptions);
    upload(capture: StoredCapture): Promise<void>;
    private pump;
    private send;
    flush(timeoutMs?: number): Promise<void>;
}

declare class NetworkTracker {
    get pending(): number;
    install(): void;
    /** Resolves when pending === 0 for `quietMs`, or after `timeout`. */
    waitQuiet(quietMs: number, timeout: number): Promise<boolean>;
}
/** Await a `[data-visual-ready="<id>"]` element to exist in the DOM. */
declare function waitForReady(id: string, timeout: number): Promise<boolean>;
/** Await fonts + in-viewport images so text/imagery aren't captured half-loaded. */
declare function waitForAssets(timeout: number): Promise<void>;
declare const VISUAL_MODE_CLASS = "visual-test-mode";
declare function enableVisualMode(): void;
declare function disableVisualMode(): void;
declare function delay(ms: number): Promise<void>;

declare function currentViewport(): Viewport;
declare function orientation(): 'portrait' | 'landscape';
/** Best-effort browser + platform label (viewport/DPR matter more for diffing). */
declare function browserPlatform(): {
    browser: string;
    platform: string;
};
/** Stable, sortable filename: 001_scenario_checkpoint_390x844.png */
declare function buildFilename(index: number, scenario: string, checkpoint: string, vp: Viewport): string;
declare function buildMetadata(args: {
    sessionId: string;
    index: number;
    scenario: string;
    checkpoint: string;
    label?: string;
    route: string;
    engine: string;
    appVersion?: string;
    gitCommit?: string;
}): CaptureMetadata;

declare function defineSuite(suite: VisualSuite): VisualSuite;
declare function defineScenario(scenario: VisualScenario): VisualScenario;

export { CaptureEngine, CaptureMetadata, CaptureRequest, CaptureResult, DomCaptureEngine, type DomCaptureOptions, HttpUploader, type HttpUploaderOptions, NetworkTracker, NoopUploader, RunnerOptions, StoredCapture, Uploader, VISUAL_MODE_CLASS, Viewport, VisualScenario, VisualSessionState, VisualStorage, VisualSuite, VisualTestRunner, browserPlatform, buildFilename, buildMetadata, currentViewport, defineScenario, defineSuite, delay, disableVisualMode, enableVisualMode, orientation, waitForAssets, waitForReady };
