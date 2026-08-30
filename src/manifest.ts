// Tiny typed helpers for authoring suites/scenarios. Pure identity functions that
// give editor autocomplete + type-checking without any runtime cost. Consumers
// define their manifest in their own app and pass it to the runner.

import type { VisualSuite, VisualScenario } from './types.js'

export function defineSuite(suite: VisualSuite): VisualSuite {
  return suite
}

export function defineScenario(scenario: VisualScenario): VisualScenario {
  return scenario
}
