import * as vue from 'vue';
import { PropType, Ref } from 'vue';
import { Router } from 'vue-router';
import { j as Navigator, f as VisualSuite, C as CaptureEngine, U as Uploader, R as RunnerOptions, V as VisualSessionState, Z as ZipLayout } from '../zip-XLfm8-A0.js';

declare class RouterNavigator implements Navigator {
    private router;
    constructor(router: Router);
    goto(route: string): Promise<void>;
    currentRoute(): string;
    settle(): Promise<void>;
}

declare const _default: vue.DefineComponent<vue.ExtractPropTypes<{
    controller: {
        type: PropType<VisualTestingController>;
        required: true;
    };
}>, (() => null) | (() => vue.VNode<vue.RendererNode, vue.RendererElement, {
    [key: string]: any;
}> | vue.VNode<vue.RendererNode, vue.RendererElement, {
    [key: string]: any;
}>[]), {}, {}, {}, vue.ComponentOptionsMixin, vue.ComponentOptionsMixin, {}, string, vue.PublicProps, Readonly<vue.ExtractPropTypes<{
    controller: {
        type: PropType<VisualTestingController>;
        required: true;
    };
}>> & Readonly<{}>, {}, {}, {}, {}, string, vue.ComponentProvideOptions, true, {}, any>;

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
interface CreateVisualTestingOptions {
    router: Router;
    /** One or more suites the user can pick from. */
    suites: VisualSuite[];
    /** Capture engine; defaults to DOM capture (modern-screenshot). */
    engine?: CaptureEngine;
    uploader?: Uploader;
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
    /** ZIP layout: foldered by scenario, flat in _combined/, or both. */
    zipLayout: Ref<ZipLayout>;
    start(): Promise<void>;
    pause(): void;
    resume(): void;
    stop(): void;
    downloadZip(): Promise<void>;
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

export { type CreateVisualTestingOptions, RouterNavigator, type VisualGateInput, _default as VisualTestPanel, type VisualTestingController, createVisualTesting, isVisualTestingAllowed, useVisualReady };
