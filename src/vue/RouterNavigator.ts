// The Navigator implementation for Vue apps: change routes through vue-router
// (not synthetic <a> clicks) and settle via nextTick. This is the ONLY place the
// core touches Vue; everything upstream stays framework-agnostic.

import { nextTick } from 'vue'
import type { Router } from 'vue-router'
import type { Navigator } from '../types.js'

export class RouterNavigator implements Navigator {
  constructor(private router: Router) {}

  async goto(route: string): Promise<void> {
    if (this.router.currentRoute.value.fullPath === route) return
    await this.router.push(route)
  }

  currentRoute(): string {
    return this.router.currentRoute.value.fullPath
  }

  async settle(): Promise<void> {
    await nextTick()
    // A second microtask flush lets child components mounted during the first
    // tick (async setup, Suspense) also commit before we measure/capture.
    await nextTick()
  }
}
