// Scroll positioning + environment/metadata helpers. Framework-agnostic.

import type { ScrollAction, Viewport, CaptureMetadata } from './types.js'
import { delay } from './readiness.js'

/** Move the viewport to a named position / anchor / fraction, then settle. */
export async function performScroll(to: ScrollAction['to']): Promise<void> {
  if (typeof window === 'undefined') return
  const doc = document.scrollingElement || document.documentElement
  if (to === 'top') {
    window.scrollTo({ top: 0, behavior: 'auto' })
  } else if (to === 'bottom') {
    window.scrollTo({ top: doc.scrollHeight, behavior: 'auto' })
  } else if ('selector' in to) {
    const el = document.querySelector(to.selector)
    el?.scrollIntoView({ block: 'start', behavior: 'auto' })
  } else if ('percent' in to) {
    const max = doc.scrollHeight - window.innerHeight
    window.scrollTo({ top: Math.max(0, Math.round(max * to.percent)), behavior: 'auto' })
  }
  // Let sticky headers / lazy content react to the new scroll position.
  await delay(120)
}

export function currentViewport(): Viewport {
  return {
    width: window.innerWidth,
    height: window.innerHeight,
    devicePixelRatio: window.devicePixelRatio || 1,
  }
}

export function orientation(): 'portrait' | 'landscape' {
  return window.innerHeight >= window.innerWidth ? 'portrait' : 'landscape'
}

/** Best-effort browser + platform label (viewport/DPR matter more for diffing). */
export function browserPlatform(): { browser: string; platform: string } {
  const ua = navigator.userAgent
  let browser = 'Unknown'
  if (/CriOS|Chrome/.test(ua)) browser = 'Chrome'
  else if (/Firefox|FxiOS/.test(ua)) browser = 'Firefox'
  else if (/Edg/.test(ua)) browser = 'Edge'
  else if (/Safari/.test(ua)) browser = 'Safari'
  let platform = 'Unknown'
  if (/iPhone/.test(ua)) platform = 'iOS'
  else if (/iPad/.test(ua)) platform = 'iPadOS'
  else if (/Android/.test(ua)) platform = 'Android'
  else if (/Mac/.test(ua)) platform = 'macOS'
  else if (/Windows/.test(ua)) platform = 'Windows'
  else if (/Linux/.test(ua)) platform = 'Linux'
  return { browser, platform }
}

/** Stable, sortable filename: 001_scenario_checkpoint_390x844.png */
export function buildFilename(index: number, scenario: string, checkpoint: string, vp: Viewport): string {
  const n = String(index).padStart(3, '0')
  const slug = (s: string) => s.replace(/[^a-z0-9-]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase()
  return `${n}_${slug(scenario)}_${slug(checkpoint)}_${vp.width}x${vp.height}.png`
}

export function buildMetadata(args: {
  sessionId: string
  index: number
  scenario: string
  checkpoint: string
  label?: string
  route: string
  engine: string
  appVersion?: string
  gitCommit?: string
}): CaptureMetadata {
  const vp = currentViewport()
  const { browser, platform } = browserPlatform()
  return {
    sessionId: args.sessionId,
    index: args.index,
    scenario: args.scenario,
    checkpoint: args.checkpoint,
    label: args.label,
    route: args.route,
    timestamp: new Date().toISOString(),
    viewport: vp,
    orientation: orientation(),
    browser,
    platform,
    engine: args.engine,
    appVersion: args.appVersion,
    gitCommit: args.gitCommit,
    filename: buildFilename(args.index, args.scenario, args.checkpoint, vp),
  }
}
