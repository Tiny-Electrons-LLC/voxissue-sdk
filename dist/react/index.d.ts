import * as react from 'react';
import { c as VisualSuite, d as CaptureEngine, R as RunnerOptions, V as VisualSessionState, i as Navigator } from '../gate-DxqC1h9r.js';
export { o as VisualGateInput, q as isVisualTestingAllowed } from '../gate-DxqC1h9r.js';
export { M as MipCaptureEngine, i as isMipHost } from '../MipCaptureEngine-ttRmz0EH.js';

/** Navigator over any router: pass the app's navigate + current-path readers. */
declare class FunctionNavigator implements Navigator {
    private navigate;
    private getPath;
    constructor(navigate: (route: string) => void | Promise<void>, getPath: () => string);
    goto(route: string): Promise<void>;
    currentRoute(): string;
    settle(): Promise<void>;
}
interface CreateVisualTestingReactOptions {
    /** e.g. react-router's navigate function. */
    navigate: (route: string) => void | Promise<void>;
    /** e.g. () => window.location.pathname + window.location.search */
    currentPath?: () => string;
    suites: VisualSuite[];
    engine?: CaptureEngine;
    env?: RunnerOptions['env'];
    defaultReadyTimeout?: number;
    stabilizeQuietMs?: number;
    postScrollSettleMs?: number;
    /** Auto-start the run when created inside the VoxIssue capture web view (default true). */
    autoStartInMip?: boolean;
    onState?: (s: VisualSessionState) => void;
}
interface VisualTestingReactController {
    suites: VisualSuite[];
    selectSuite(id: string): void;
    getState(): VisualSessionState | null;
    start(): Promise<void>;
    pause(): void;
    resume(): void;
    stop(): void;
}
declare function createVisualTesting(opts: CreateVisualTestingReactOptions): VisualTestingReactController;
/**
 * Marks the element ready for capture. Attach the returned ref to the page
 * root; when `ready` is true the runner's waitForReady resolves.
 *
 *   const readyRef = useVisualReady('devices-page', !loading)
 *   <div ref={readyRef}> ... </div>
 */
declare function useVisualReady(id: string, ready: boolean): react.RefObject<HTMLElement | null>;

export { type CreateVisualTestingReactOptions, FunctionNavigator, type VisualTestingReactController, createVisualTesting, useVisualReady };
