import { describe, it, expect } from 'vitest'
import { buildFilename } from '../dom.js'
import { defineSuite, defineScenario } from '../manifest.js'
import type { Viewport } from '../types.js'

const vp: Viewport = { width: 390, height: 844, devicePixelRatio: 3 }

describe('buildFilename', () => {
  it('produces a stable, sortable, slugged name', () => {
    expect(buildFilename(1, 'inventory-devices', 'devices-top', vp))
      .toBe('001_inventory-devices_devices-top_390x844.png')
    expect(buildFilename(42, 'Settings Security', 'General View', vp))
      .toBe('042_settings-security_general-view_390x844.png')
  })
  it('zero-pads the index to 3 digits', () => {
    expect(buildFilename(7, 'a', 'b', vp)).toMatch(/^007_/)
    expect(buildFilename(123, 'a', 'b', vp)).toMatch(/^123_/)
  })
})

describe('manifest helpers', () => {
  it('defineSuite/defineScenario are identity (type-only) helpers', () => {
    const s = defineScenario({ id: 'x', name: 'X', route: '/x', captures: [{ id: 'top', scroll: 'top' }] })
    expect(s.id).toBe('x')
    const suite = defineSuite({ id: 'm', name: 'M', scenarios: [s] })
    expect(suite.scenarios).toHaveLength(1)
    expect(suite.scenarios[0]!.captures![0]!.id).toBe('top')
  })
})
