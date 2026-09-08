import { describe, it, expect, vi, afterEach } from 'vitest'
import { isMipHost, listenToHostControls } from '../capture/MipCaptureEngine.js'

type W = typeof globalThis & { window?: unknown }

function withWindow(hooks: unknown, run: () => void) {
  const g = globalThis as W
  const listeners = new Map<string, Array<() => void>>()
  const win = {
    vi: hooks,
    addEventListener: (t: string, fn: () => void) => { listeners.set(t, [...(listeners.get(t) ?? []), fn]) },
    removeEventListener: (t: string, fn: () => void) => { listeners.set(t, (listeners.get(t) ?? []).filter((f) => f !== fn)) },
    dispatchEvent: (e: { type: string }) => { for (const fn of listeners.get(e.type) ?? []) fn(); return true },
  }
  const prev = g.window
  g.window = win
  try { run() } finally { g.window = prev }
  return listeners
}

afterEach(() => { vi.restoreAllMocks() })

describe('host controls', () => {
  it('do nothing outside a VoxIssue host', () => {
    const pause = vi.fn()
    const listeners = withWindow(undefined, () => {
      expect(isMipHost()).toBe(false)
      const off = listenToHostControls({ pause, resume: vi.fn(), stop: vi.fn() })
      off()
    })
    expect(listeners.size).toBe(0)
    expect(pause).not.toHaveBeenCalled()
  })

  it('route vi:pause / vi:resume / vi:stop to the controller inside a host, and detach', () => {
    const controls = { pause: vi.fn(), resume: vi.fn(), stop: vi.fn() }
    withWindow({ capture() {}, done() {} }, () => {
      expect(isMipHost()).toBe(true)
      const off = listenToHostControls(controls)
      const w = (globalThis as W).window as { dispatchEvent(e: { type: string }): boolean }
      w.dispatchEvent({ type: 'vi:pause' })
      w.dispatchEvent({ type: 'vi:resume' })
      w.dispatchEvent({ type: 'vi:stop' })
      expect(controls.pause).toHaveBeenCalledTimes(1)
      expect(controls.resume).toHaveBeenCalledTimes(1)
      expect(controls.stop).toHaveBeenCalledTimes(1)
      off()
      w.dispatchEvent({ type: 'vi:pause' })
      expect(controls.pause).toHaveBeenCalledTimes(1)
    })
  })
})
