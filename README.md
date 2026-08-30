# @tiny-electrons/visual-capture

Self-driving in-SPA visual capture + regression runner. Runs **inside your app on the real device** (iPhone/iPad/desktop Safari, Chrome), auto-navigates a manifest of routes/states/scroll positions, and captures the rendered DOM to PNG. No native iOS automation required.

The **capture engine is swappable**: DOM→PNG today (via `modern-screenshot` — validated at 0.09–0.82% pixel diff vs native WebKit), native iOS/Playwright engines later, without touching your manifest or the runner.

Used by patchconsole, elevateiq, itfolder.

## Install (git dependency)

```jsonc
// package.json
"dependencies": {
  "@tiny-electrons/visual-capture": "github:Tiny-Electrons-LLC/visual-capture#v0.1.0"
}
```

The `prepare` hook builds `dist/` on install.

## Architecture

```
        Test Manifest (yours)
                │
                ▼
        VisualTestRunner  ── framework-agnostic core, zero Vue
        ┌───────┴────────┐
   Navigator          CaptureEngine
 (RouterNavigator)   (DomCaptureEngine → modern-screenshot)
```

Only `@tiny-electrons/visual-capture/vue` imports Vue. The core (`@tiny-electrons/visual-capture`) is framework-agnostic.

## Wire it up (Vue)

```ts
import { defineSuite } from '@tiny-electrons/visual-capture'
import { createVisualTesting, isVisualTestingAllowed, VisualTestPanel } from '@tiny-electrons/visual-capture/vue'
import router from '@/router'

// 1. Manifest — stable data-visual-id / data-visual-ready attrs, not button text
export const mobileSuite = defineSuite({
  id: 'mobile-full',
  name: 'Full Mobile UI',
  scenarios: [
    {
      id: 'devices', name: 'Inventory · Devices', route: '/devices',
      waitFor: 'devices-page',
      captures: [
        { id: 'top', scroll: 'top' },
        { id: 'table', scrollTo: "[data-visual-id='device-row-20']" },
        { id: 'bottom', scroll: 'bottom' },
      ],
    },
  ],
})

// 2. Controller (dev-gated)
const allowed = isVisualTestingAllowed({
  isDev: import.meta.env.DEV,
  featureFlag: import.meta.env.VITE_VISUAL_TESTING === 'true',
  isPrivileged: auth.isOwner.value,
})

const controller = createVisualTesting({
  router,
  suites: [mobileSuite],
  env: { appVersion: import.meta.env.VITE_APP_VERSION, gitCommit: import.meta.env.VITE_GIT_COMMIT },
})
```

```vue
<!-- Settings → Developer → Visual Testing -->
<VisualTestPanel v-if="allowed" :controller="controller" />
```

## Signal readiness from your pages

Instead of arbitrary sleeps, tell the runner when a page is actually ready:

```ts
import { useVisualReady } from '@tiny-electrons/visual-capture/vue'

const { readyEl, markReady } = useVisualReady('devices-page')
// <div ref="readyEl"> ... </div>
onDataLoaded(() => markReady())
```

The runner waits for: the `data-visual-ready` signal → tracked network quiet → fonts/images → framework settle → a short quiet period. Animations are frozen while capturing.

## Redaction & ignore

- `data-visual-redact` — blurred before pixels are produced (passwords, secrets).
- `data-visual-ignore` — dropped from the capture (volatile timestamps, live counters) so diffs don't churn.

## Output

Each run persists to IndexedDB (survives a Safari reload) and exports a ZIP:

```
visual-capture-2026-08-30/
  session.json
  devices/
    001_devices_top_390x844.png
    002_devices_table_390x844.png
    003_devices_bottom_390x844.png
```

Every PNG has a metadata record (route, checkpoint, viewport, DPR, browser, platform, engine, appVersion, gitCommit, timestamp).

## Roadmap

- **MVP (now):** manifest, navigate/waitForReady/click/scrollTo/capture, DOM→PNG, IndexedDB, ZIP, dev panel.
- **Phase 2:** server upload (`HttpUploader`), baseline diffing, ignore-regions, resume.
- **Phase 3:** native iOS capture engine (same manifest/runner, swap only the engine).
