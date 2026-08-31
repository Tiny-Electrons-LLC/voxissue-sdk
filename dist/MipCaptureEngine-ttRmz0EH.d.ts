import { d as CaptureEngine, f as CaptureRequest, g as CaptureResult } from './gate-DxqC1h9r.js';

/** True when running inside the MIP capture web view. */
declare function isMipHost(): boolean;
declare class MipCaptureEngine implements CaptureEngine {
    readonly id = "native:mip";
    capture(_req: CaptureRequest): Promise<CaptureResult>;
    /** Signal MIP that the whole run is over (it advances to the next pages.json URL). */
    finishRun(): void;
}

export { MipCaptureEngine as M, isMipHost as i };
