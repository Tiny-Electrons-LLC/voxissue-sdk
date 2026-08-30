// @tiny-electrons/visual-capture — framework-agnostic core.
// The Vue adapter is a separate entry: import from '@tiny-electrons/visual-capture/vue'.

export * from './types.js'
export { VisualTestRunner } from './runner.js'
export { DomCaptureEngine } from './capture/DomCaptureEngine.js'
export type { DomCaptureOptions } from './capture/DomCaptureEngine.js'
export { VisualStorage } from './storage.js'
export { NoopUploader, HttpUploader } from './uploader.js'
export type { HttpUploaderOptions } from './uploader.js'
export { buildSessionZip, downloadBlob } from './zip.js'
export type { ZipLayout } from './zip.js'
export {
  NetworkTracker, waitForReady, waitForAssets,
  enableVisualMode, disableVisualMode, VISUAL_MODE_CLASS, delay,
} from './readiness.js'
export { currentViewport, orientation, browserPlatform, buildFilename, buildMetadata } from './dom.js'
export { defineSuite, defineScenario } from './manifest.js'
