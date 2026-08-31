import { Ref } from 'vue';
import { Router } from 'vue-router';
import { i as Navigator, c as VisualSuite, d as CaptureEngine, R as RunnerOptions, V as VisualSessionState } from '../gate-DxqC1h9r.js';
export { o as VisualGateInput, q as isVisualTestingAllowed } from '../gate-DxqC1h9r.js';

declare class RouterNavigator implements Navigator {
    private router;
    constructor(router: Router);
    goto(route: string): Promise<void>;
    currentRoute(): string;
    settle(): Promise<void>;
}

interface CreateVisualTestingOptions {
    router: Router;
    /** One or more suites the user can pick from. */
    suites: VisualSuite[];
    /** Capture engine; defaults to the VoxIssue native-shutter engine. */
    engine?: CaptureEngine;
    env?: RunnerOptions['env'];
    defaultReadyTimeout?: number;
    stabilizeQuietMs?: number;
    postScrollSettleMs?: number;
    /** Auto-start the run when created inside the MIP capture web view (default true). */
    autoStartInMip?: boolean;
}
interface VisualTestingController {
    suites: VisualSuite[];
    selectedSuiteId: Ref<string>;
    state: Readonly<Ref<VisualSessionState | null>>;
    running: Readonly<Ref<boolean>>;
    start(): Promise<void>;
    pause(): void;
    resume(): void;
    stop(): void;
}
declare function createVisualTesting(opts: CreateVisualTestingOptions): VisualTestingController;
/**
 * Marks the mounting element ready for capture. Attach the returned ref to the
 * page root; when `ready` flips true the runner's waitForReady resolves.
 *
 *   const { readyEl } = useVisualReady('devices-page')
 *   <div ref="readyEl"> ... </div>
 *   // then, after data loads:
 *   markReady()
 */
declare function useVisualReady(id: string, autoOnMount?: boolean): {
    readyEl: Ref<HTMLElement | null, HTMLElement | null>;
    isReady: Readonly<Ref<boolean, boolean>>;
    markReady: () => void;
    clearReady: () => void;
};

export { type CreateVisualTestingOptions, RouterNavigator, type VisualTestingController, createVisualTesting, useVisualReady };
