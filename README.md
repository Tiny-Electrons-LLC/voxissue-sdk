# @tiny-electrons/voxissue-sdk

Drives a web app suite-by-suite and signals the [VoxIssue iOS app](https://github.com/Tiny-Electrons-LLC/VoxIssue) when to take screenshots.

**The SDK never takes screenshots itself.** Capture is native: the VoxIssue app snapshots its WKWebView when the SDK fires the shutter hooks (`window.vi.capture()` / `window.vi.done()`). Outside the VoxIssue app a run is a dry-run — navigation and readiness checks only.

## Install

```json
"@tiny-electrons/voxissue-sdk": "git+https://github.com/Tiny-Electrons-LLC/voxissue-sdk.git#v0.3.0"
```

Private git dependency — CI needs a read token for this repo.

## What it does

- **Suites** (`defineSuite`): declarative scenarios — route, readiness signal, actions, capture checkpoints.
- **Runner**: navigates the app through each scenario, waits for real readiness (`data-visual-ready`, network quiet, asset settle), and signals the native shutter at each checkpoint.
- **VoxIssue host detection** (`isMipHost()`): inside the app's capture web view the run auto-starts once per capture session, headless, and signals `done()` at the end so the app advances.
- **Gate** (`isVisualTestingAllowed`): dev/staging/staff-only exposure so the tool never reaches customers.

## Vue

```js
import { createVisualTesting, isVisualTestingAllowed, useVisualReady } from '@tiny-electrons/voxissue-sdk/vue'

const controller = createVisualTesting({ router, suites })
```

Pages signal readiness by binding the marker to their loading state:

```html
<div :data-visual-ready="loading ? null : 'devices-page'">
```

## React

```jsx
import { createVisualTesting, useVisualReady } from '@tiny-electrons/voxissue-sdk/react'

const controller = createVisualTesting({
  navigate: (route) => router.navigate(route),   // e.g. react-router
  suites,
})

function DevicesPage({ loading }) {
  const readyRef = useVisualReady('devices-page', !loading)
  return <div ref={readyRef}>…</div>
}
```

## Suites

```js
import { defineSuite } from '@tiny-electrons/voxissue-sdk'

export const mobileSuite = defineSuite({
  id: 'mobile-full',
  name: 'Full Mobile UI',
  scenarios: [
    {
      id: 'devices',
      name: 'Devices',
      route: '/devices',
      waitFor: 'devices-page',
      captures: [
        { id: 'top', scroll: 'top' },
        { id: 'middle', scrollPercent: 0.5 },
        { id: 'bottom', scroll: 'bottom' },
      ],
    },
  ],
})
```

A scenario whose ready signal never fires is still captured after a soft timeout, so an empty tenant can't blank a run.
