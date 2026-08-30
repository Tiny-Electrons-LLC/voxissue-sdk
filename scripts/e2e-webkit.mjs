// Real end-to-end proof of the capture pipeline in the REAL Safari engine
// (Playwright WebKit) at iPhone 390x844. Loads the ACTUAL built library into a
// realistic multi-section page and runs the full VisualTestRunner through a
// stub Navigator (so this is hermetic - no dev server, no app data), producing
// real PNGs + a real ZIP on disk. This proves DomCaptureEngine + runner +
// IndexedDB + buildSessionZip work end-to-end on WebKit; the patchconsole MVP
// wires the same runner to vue-router.
//
// Run: node scripts/e2e-webkit.mjs
// playwright lives in the patchconsole www workspace; import it by absolute path
// so this hermetic proof runs regardless of cwd / this repo's node_modules.
import { webkit } from '/Users/jorge/code/patchconsole/www/node_modules/playwright/index.mjs'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const HERE = dirname(fileURLToPath(import.meta.url))
const OUT = join(HERE, '..', '.e2e-out')
const LIB_CORE = join(HERE, '..', 'dist', 'index.js')
const log = (...a) => console.log('[e2e-webkit]', ...a)

// Bundle the built core to a single IIFE we can inject (it has one dep chunk +
// modern-screenshot/jszip which are ESM). Easiest: serve via a data: module.
// Playwright can import ESM modules in the page via addScriptTag type=module,
// but relative chunk imports won't resolve. So we run an esbuild-free approach:
// load the library from a local file: URL the page can fetch. We host the dist
// dir over a tiny in-page import map instead - simplest is to read + eval the
// pre-bundled single-file build. We build that on the fly with tsup's output by
// concatenating; but core imports modern-screenshot/jszip from node_modules.
//
// Pragmatic path: use Playwright's module loading by serving dist + node_modules
// over a file server. We start Playwright with a route handler that serves them.

const browser = await webkit.launch()
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 3,
  ignoreHTTPSErrors: true,
  isMobile: true,
  hasTouch: true,
})
const page = await context.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()) })

// A realistic mobile page (sticky header, KPI cards, long table, footer, plus a
// redacted secret) served from a real https origin so IndexedDB works. 40 table
// rows are baked in so the page is tall enough to exercise scroll checkpoints.
const ROWS = Array.from({ length: 40 }, (_, i) => {
  const pkgs = ['Google Chrome', '7-Zip', 'Firefox', 'Node.js', 'Git', 'VS Code', 'Zoom', 'Slack', 'Docker', 'Python']
  return `<tr><td>${pkgs[i % pkgs.length]}</td><td>1.${i}.0</td><td><span class=badge>OK</span></td></tr>`
}).join('')
const PROOF_HTML = `<!doctype html><html><head><meta name=viewport content="width=device-width,initial-scale=1"><style>
    *{box-sizing:border-box;margin:0;padding:0;font-family:-apple-system,system-ui,sans-serif}
    body{background:#f4f6f8;color:#1a1f26}
    header{position:sticky;top:0;background:#0f1419;color:#fff;padding:14px 16px;font-weight:600;font-size:18px}
    .kpis{display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:16px}
    .card{background:#fff;border-radius:12px;padding:16px;box-shadow:0 1px 3px rgba(0,0,0,.1)}
    .card .n{font-size:28px;font-weight:700;color:#2563eb}
    .card .l{color:#6b7280;font-size:13px;margin-top:4px}
    table{width:100%;border-collapse:collapse;background:#fff}
    th,td{text-align:left;padding:12px 16px;border-bottom:1px solid #eef1f4;font-size:14px}
    th{background:#fafbfc;color:#6b7280;font-size:12px;text-transform:uppercase}
    .badge{display:inline-block;padding:2px 8px;border-radius:999px;font-size:12px;background:#dcfce7;color:#166534}
    footer{padding:24px 16px;color:#9ca3af;text-align:center;font-size:12px}
    .secret{font-family:monospace}
  </style></head><body>
    <header id=app-header>Patch Console (capture proof)</header>
    <section class=kpis>
      <div class=card><div class=n>1,248</div><div class=l>Devices</div></div>
      <div class=card><div class=n>96%</div><div class=l>Patched</div></div>
      <div class=card><div class=n>17</div><div class=l>Critical</div></div>
      <div class=card><div class=n>4</div><div class=l>Groups</div></div>
    </section>
    <table><thead><tr><th>Package</th><th>Version</th><th>Status</th></tr></thead><tbody id=rows>${ROWS}</tbody></table>
    <div class=card style="margin:16px">API key: <span class="secret" data-visual-redact>sk_live_9f2b8c1a2233ee</span></div>
    <footer>Generated for visual-capture e2e proof</footer>
    <div data-visual-ready="proof-page"></div>
  </body></html>`

// Serve the page + dist/ + bundled lib via routing on a real https origin.
const ROOT = join(HERE, '..')
await context.route('**/*', async (route) => {
  const url = new URL(route.request().url())
  if (url.protocol === 'https:' && url.hostname === 'vc.local') {
    // The proof page itself is served here so it gets a real secure origin
    // (IndexedDB is blocked on about:blank / opaque origins from setContent).
    if (url.pathname === '/' || url.pathname === '/proof.html') {
      return route.fulfill({ status: 200, contentType: 'text/html', body: PROOF_HTML })
    }
    try {
      const rel = decodeURIComponent(url.pathname)
      const file = join(ROOT, rel)
      const body = readFileSync(file)
      const ct = (file.endsWith('.js') || file.endsWith('.mjs')) ? 'text/javascript' : file.endsWith('.json') ? 'application/json' : 'text/html'
      return route.fulfill({ status: 200, contentType: ct, body })
    } catch (e) {
      return route.fulfill({ status: 404, body: 'not found: ' + url.pathname })
    }
  }
  return route.continue()
})

try {
  mkdirSync(OUT, { recursive: true })

  // Navigate to the served page (real https origin => IndexedDB works).
  await page.goto('https://vc.local/proof.html', { waitUntil: 'domcontentloaded' })
  log('page rendered; loading built library + driving the runner...')

  const result = await page.evaluate(async () => {
    const mod = await import('https://vc.local/.e2e-out/lib-bundled.mjs')
    const { VisualTestRunner, DomCaptureEngine, buildSessionZip } = mod

    // Stub navigator: no routing - each "scenario" is the same page at different
    // scroll positions. This exercises the real runner + real capture engine.
    const nav = {
      _r: '/proof',
      async goto(r) { this._r = r; window.scrollTo(0, 0) },
      currentRoute() { return this._r },
      async settle() { await new Promise((r) => requestAnimationFrame(() => r())) },
    }
    const suite = {
      id: 'proof', name: 'Capture Proof',
      scenarios: [{
        id: 'proof', name: 'Proof', route: '/proof', waitFor: 'proof-page',
        captures: [
          { id: 'top', label: 'Top / KPIs', scroll: 'top' },
          { id: 'middle', label: 'Table', scrollPercent: 0.5 },
          { id: 'bottom', label: 'Footer', scroll: 'bottom' },
        ],
      }],
    }
    const runner = new VisualTestRunner({
      suite,
      engine: new DomCaptureEngine(),
      navigator: nav,
      stabilizeQuietMs: 100,
      defaultReadyTimeout: 5000,
      env: { appVersion: 'e2e', gitCommit: 'proof' },
    })
    const state = await runner.start()
    const captures = await runner.getStoredCaptures()
    const zipBlob = await buildSessionZip(state, captures)
    const ab = await zipBlob.arrayBuffer()
    // Report capture dimensions so we can assert real pixels.
    const dims = captures.map((c) => ({ id: c.meta.checkpoint, w: c.meta.width, h: c.meta.height, bytes: c.blob.size }))
    // hand the zip bytes back as base64
    const bytes = new Uint8Array(ab)
    let bin = ''
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
    return { status: state.status, failures: state.failures, captureIndex: state.captureIndex, dims, zipB64: btoa(bin) }
  })

  log('runner status:', result.status, '| captures:', result.captureIndex, '| failures:', result.failures.length)
  log('capture dims:', JSON.stringify(result.dims))
  if (result.failures.length) log('failures:', JSON.stringify(result.failures))

  const zipBuf = Buffer.from(result.zipB64, 'base64')
  writeFileSync(join(OUT, 'proof.zip'), zipBuf)
  log('ZIP saved:', join(OUT, 'proof.zip'), '(' + zipBuf.length + ' bytes)')
  log('page errors:', errors.length ? errors.slice(0, 3) : 'none')
} catch (e) {
  console.error('[e2e-webkit] FAILED:', e.message)
  writeFileSync(join(OUT, 'error.txt'), `${e.stack}\n\n${errors.join('\n')}`)
  process.exitCode = 1
} finally {
  await browser.close()
}
