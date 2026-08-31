import { R as RunnerOptions, V as VisualSessionState, a as Viewport, b as VisualScenario, c as VisualSuite } from './gate-DxqC1h9r.js';
export { C as CaptureAction, d as CaptureEngine, e as CapturePoint, f as CaptureRequest, g as CaptureResult, h as ClickAction, N as NavigateAction, i as Navigator, S as ScrollAction, j as Selector, k as SessionFailure, l as SessionStatus, m as SetStateAction, n as VisualAction, o as VisualGateInput, W as WaitAction, p as WaitReadyAction, q as isVisualTestingAllowed } from './gate-DxqC1h9r.js';
export { M as MipCaptureEngine, i as isMipHost } from './MipCaptureEngine-ttRmz0EH.js';

declare class VisualTestRunner {
    private opts;
    private engine;
    private nav;
    private net;
    private state;
    private pauseGate;
    private resumeFn;
    private stopped;
    private readyTimeout;
    private quietMs;
    private postScrollSettleMs;
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
    /** Two animation frames + a delay so a scrolled viewport is fully painted. */
    private settleAfterScroll;
    /** Wait for network quiet + assets + a short settle so the frame is stable. */
    private stabilize;
    /** Signal the shutter — no pixels are produced or stored in the SDK. */
    private captureNow;
    private recordFailure;
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

declare function defineSuite(suite: VisualSuite): VisualSuite;
declare function defineScenario(scenario: VisualScenario): VisualScenario;

export { NetworkTracker, RunnerOptions, VISUAL_MODE_CLASS, Viewport, VisualScenario, VisualSessionState, VisualSuite, VisualTestRunner, browserPlatform, currentViewport, defineScenario, defineSuite, delay, disableVisualMode, enableVisualMode, orientation, waitForAssets, waitForReady };
