// @tiny-electrons/voxissue-sdk — framework-agnostic core.
// The Vue adapter is a separate entry: import from '@tiny-electrons/voxissue-sdk/vue'.

export * from './types.js'
export { VisualTestRunner } from './runner.js'
export {
  NetworkTracker, waitForReady, waitForAssets,
  enableVisualMode, disableVisualMode, VISUAL_MODE_CLASS, delay,
} from './readiness.js'
export { currentViewport, orientation, browserPlatform } from './dom.js'
export { defineSuite, defineScenario } from './manifest.js'
export { isVisualTestingAllowed } from './gate.js'
export type { VisualGateInput } from './gate.js'
export { MipCaptureEngine, isMipHost } from './capture/MipCaptureEngine.js'
