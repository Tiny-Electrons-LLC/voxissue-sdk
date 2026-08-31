import { describe, it, expect } from 'vitest'
import { defineSuite, defineScenario } from '../manifest.js'
import type { Viewport } from '../types.js'

const vp: Viewport = { width: 390, height: 844, devicePixelRatio: 3 }


describe('manifest helpers', () => {
  it('defineSuite/defineScenario are identity (type-only) helpers', () => {
    const s = defineScenario({ id: 'x', name: 'X', route: '/x', captures: [{ id: 'top', scroll: 'top' }] })
    expect(s.id).toBe('x')
    const suite = defineSuite({ id: 'm', name: 'M', scenarios: [s] })
    expect(suite.scenarios).toHaveLength(1)
    expect(suite.scenarios[0]!.captures![0]!.id).toBe('top')
  })
})
