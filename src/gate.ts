// Exposure gate: dev/staging/staff-only — shared by the Vue and React adapters.


export interface VisualGateInput {
  /** import.meta.env.DEV (or a dev/staging flag). Opens the gate outright. */
  isDev?: boolean
  /**
   * Explicit opt-in flag, e.g. import.meta.env.VITE_VISUAL_TESTING === 'true'.
   * REQUIRED in production - it's the only thing that can enable the tool there.
   */
  featureFlag?: boolean
  /**
   * Whether the current user is internal STAFF (superadmin / allowlisted). This
   * is NOT a tenant role: in a multi-tenant SaaS, a tenant "owner" is a paying
   * customer, so passing isOwner here would expose the tool - which screenshots
   * live tenant data - to every customer. `isStaff` only NARROWS access; it can
   * never open the gate on its own (the feature flag must also be on).
   */
  isStaff?: boolean
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
export function isVisualTestingAllowed(g: VisualGateInput): boolean {
  if (g.isDev) return true
  if (!g.featureFlag) return false
  // Flag is on. If a staff signal is supplied, require it too; otherwise the
  // flag alone (a deliberate prod opt-in) is sufficient.
  return g.isStaff === undefined ? true : g.isStaff === true
}

