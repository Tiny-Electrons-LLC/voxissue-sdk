import { d as CaptureEngine, f as CaptureRequest, g as CaptureResult } from './gate-DxqC1h9r.js';

/** True when running inside the MIP capture web view. */
declare function isMipHost(): boolean;
type HostControls = {
    pause(): void;
    resume(): void;
    stop(): void;
};
/**
 * Host → runner controls. Inside a VoxIssue host (the app's web view, or the
 * browser relay extension's bridge) the person driving the run has Pause /
 * Resume / Stop buttons on the native side; the host fires these as window
 * events and the controller obeys, so a paused run really stops scrolling
 * and navigating instead of only skipping shots.
 *
 *   window.dispatchEvent(new CustomEvent('vi:pause'))   // 'vi:resume', 'vi:stop'
 *
 * Returns a function that removes the listeners. No-op outside a host.
 */
declare function listenToHostControls(controls: HostControls): () => void;
declare class MipCaptureEngine implements CaptureEngine {
    readonly id = "native:mip";
    capture(_req: CaptureRequest): Promise<CaptureResult>;
    /** Signal MIP that the whole run is over (it advances to the next pages.json URL). */
    finishRun(): void;
}

export { type HostControls as H, MipCaptureEngine as M, isMipHost as i, listenToHostControls as l };
