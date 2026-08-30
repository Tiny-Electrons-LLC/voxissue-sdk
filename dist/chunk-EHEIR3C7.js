// src/readiness.ts
var READY_ATTR = "data-visual-ready";
var sharedPending = 0;
var installedOnce = false;
var NetworkTracker = class {
  get pending() {
    return sharedPending;
  }
  install() {
    if (installedOnce || typeof window === "undefined") return;
    installedOnce = true;
    const origFetch = window.fetch.bind(window);
    window.fetch = function patchedFetch(...args) {
      sharedPending++;
      return origFetch(...args).finally(() => {
        sharedPending = Math.max(0, sharedPending - 1);
      });
    };
    const origSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.send = function patchedSend(...a) {
      sharedPending++;
      const done = () => {
        sharedPending = Math.max(0, sharedPending - 1);
      };
      this.addEventListener("loadend", done, { once: true });
      try {
        return origSend.apply(this, a);
      } catch (e) {
        sharedPending = Math.max(0, sharedPending - 1);
        throw e;
      }
    };
  }
  /** Resolves when pending === 0 for `quietMs`, or after `timeout`. */
  async waitQuiet(quietMs, timeout) {
    const start = Date.now();
    let quietSince = this.pending === 0 ? Date.now() : 0;
    return new Promise((resolve) => {
      const tick = () => {
        if (this.pending === 0) {
          if (quietSince === 0) quietSince = Date.now();
          if (Date.now() - quietSince >= quietMs) return resolve(true);
        } else {
          quietSince = 0;
        }
        if (Date.now() - start >= timeout) return resolve(false);
        setTimeout(tick, 50);
      };
      tick();
    });
  }
};
function waitForReady(id, timeout) {
  if (typeof document === "undefined") return Promise.resolve(false);
  const sel = `[${READY_ATTR}="${cssEscape(id)}"]`;
  if (document.querySelector(sel)) return Promise.resolve(true);
  return new Promise((resolve) => {
    const start = Date.now();
    const obs = new MutationObserver(() => {
      if (document.querySelector(sel)) {
        obs.disconnect();
        resolve(true);
      }
    });
    obs.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: [READY_ATTR] });
    const poll = () => {
      if (document.querySelector(sel)) {
        obs.disconnect();
        return resolve(true);
      }
      if (Date.now() - start >= timeout) {
        obs.disconnect();
        return resolve(false);
      }
      setTimeout(poll, 100);
    };
    poll();
  });
}
async function waitForAssets(timeout) {
  if (typeof document === "undefined") return;
  const deadline = Date.now() + timeout;
  try {
    if ("fonts" in document) {
      await Promise.race([
        document.fonts.ready,
        delay(Math.max(0, deadline - Date.now()))
      ]);
    }
  } catch {
  }
  const imgs = Array.from(document.images).filter((i) => !i.complete && inViewport(i));
  if (imgs.length) {
    await Promise.race([
      Promise.all(imgs.map((i) => new Promise((r) => {
        i.addEventListener("load", () => r(), { once: true });
        i.addEventListener("error", () => r(), { once: true });
      }))),
      delay(Math.max(0, deadline - Date.now()))
    ]);
  }
}
var FREEZE_STYLE_ID = "vc-freeze-motion";
var VISUAL_MODE_CLASS = "visual-test-mode";
function enableVisualMode() {
  if (typeof document === "undefined") return;
  document.documentElement.classList.add(VISUAL_MODE_CLASS);
  if (document.getElementById(FREEZE_STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = FREEZE_STYLE_ID;
  style.textContent = `
    .${VISUAL_MODE_CLASS} *,
    .${VISUAL_MODE_CLASS} *::before,
    .${VISUAL_MODE_CLASS} *::after {
      /* pause (not 0s duration): 0s on an infinite animation can spam
         animationiteration; paused freezes cleanly. */
      animation-play-state: paused !important;
      animation-delay: 0s !important;
      transition-duration: 0s !important;
      transition-delay: 0s !important;
      caret-color: transparent !important;
      scroll-behavior: auto !important;
    }
  `;
  document.head.appendChild(style);
}
function disableVisualMode() {
  if (typeof document === "undefined") return;
  document.documentElement.classList.remove(VISUAL_MODE_CLASS);
  document.getElementById(FREEZE_STYLE_ID)?.remove();
}
function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
function inViewport(el) {
  const r = el.getBoundingClientRect();
  return r.bottom > 0 && r.right > 0 && r.top < window.innerHeight && r.left < window.innerWidth;
}
function cssEscape(s) {
  if (typeof CSS !== "undefined" && CSS.escape) return CSS.escape(s);
  return s.replace(/["\\]/g, "\\$&");
}

// src/dom.ts
async function performScroll(to) {
  if (typeof window === "undefined") return;
  const doc = document.scrollingElement || document.documentElement;
  if (to === "top") {
    window.scrollTo({ top: 0, behavior: "auto" });
  } else if (to === "bottom") {
    window.scrollTo({ top: doc.scrollHeight, behavior: "auto" });
  } else if ("selector" in to) {
    const el = document.querySelector(to.selector);
    el?.scrollIntoView({ block: "start", behavior: "auto" });
  } else if ("percent" in to) {
    const max = doc.scrollHeight - window.innerHeight;
    window.scrollTo({ top: Math.max(0, Math.round(max * to.percent)), behavior: "auto" });
  }
  await delay(120);
}
function currentViewport() {
  return {
    width: window.innerWidth,
    height: window.innerHeight,
    devicePixelRatio: window.devicePixelRatio || 1
  };
}
function orientation() {
  return window.innerHeight >= window.innerWidth ? "portrait" : "landscape";
}
function browserPlatform() {
  const ua = navigator.userAgent;
  let browser = "Unknown";
  if (/CriOS|Chrome/.test(ua)) browser = "Chrome";
  else if (/Firefox|FxiOS/.test(ua)) browser = "Firefox";
  else if (/Edg/.test(ua)) browser = "Edge";
  else if (/Safari/.test(ua)) browser = "Safari";
  let platform = "Unknown";
  if (/iPhone/.test(ua)) platform = "iOS";
  else if (/iPad/.test(ua)) platform = "iPadOS";
  else if (/Android/.test(ua)) platform = "Android";
  else if (/Mac/.test(ua)) platform = "macOS";
  else if (/Windows/.test(ua)) platform = "Windows";
  else if (/Linux/.test(ua)) platform = "Linux";
  return { browser, platform };
}
function buildFilename(index, scenario, checkpoint, vp) {
  const n = String(index).padStart(3, "0");
  const slug = (s) => s.replace(/[^a-z0-9-]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase();
  return `${n}_${slug(scenario)}_${slug(checkpoint)}_${vp.width}x${vp.height}.png`;
}
function buildMetadata(args) {
  const vp = currentViewport();
  const { browser, platform } = browserPlatform();
  return {
    sessionId: args.sessionId,
    index: args.index,
    scenario: args.scenario,
    checkpoint: args.checkpoint,
    label: args.label,
    route: args.route,
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    viewport: vp,
    orientation: orientation(),
    browser,
    platform,
    engine: args.engine,
    appVersion: args.appVersion,
    gitCommit: args.gitCommit,
    filename: buildFilename(args.index, args.scenario, args.checkpoint, vp)
  };
}

// src/storage.ts
var DB_NAME = "visual-capture";
var DB_VERSION = 1;
var CAPTURES = "captures";
var SESSIONS = "sessions";
function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(CAPTURES)) {
        const store = db.createObjectStore(CAPTURES, { keyPath: "key" });
        store.createIndex("bySession", "sessionId", { unique: false });
      }
      if (!db.objectStoreNames.contains(SESSIONS)) {
        db.createObjectStore(SESSIONS, { keyPath: "sessionId" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
function tx(db, store, mode, fn) {
  return new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const req = fn(t.objectStore(store));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function toRow(sessionId, c) {
  const bytes = await c.blob.arrayBuffer();
  return { key: `${sessionId}:${c.meta.index}`, sessionId, meta: c.meta, uploaded: c.uploaded, bytes, mime: c.blob.type || "image/png" };
}
function fromRow(row) {
  return { meta: row.meta, uploaded: row.uploaded, blob: new Blob([row.bytes], { type: row.mime }) };
}
var VisualStorage = class {
  constructor() {
    this.dbP = openDb();
  }
  async saveCapture(sessionId, capture) {
    const db = await this.dbP;
    const row = await toRow(sessionId, capture);
    await tx(db, CAPTURES, "readwrite", (s) => s.put(row));
  }
  async markUploaded(sessionId, index) {
    const db = await this.dbP;
    const key = `${sessionId}:${index}`;
    const row = await tx(db, CAPTURES, "readonly", (s) => s.get(key));
    if (row) {
      row.uploaded = true;
      await tx(db, CAPTURES, "readwrite", (s) => s.put(row));
    }
  }
  async listCaptures(sessionId) {
    const db = await this.dbP;
    const rows = await tx(db, CAPTURES, "readonly", (s) => s.index("bySession").getAll(sessionId));
    return rows.sort((a, b) => a.meta.index - b.meta.index).map(fromRow);
  }
  async saveSession(state) {
    const db = await this.dbP;
    await tx(db, SESSIONS, "readwrite", (s) => s.put(state));
  }
  async getSession(sessionId) {
    const db = await this.dbP;
    return tx(db, SESSIONS, "readonly", (s) => s.get(sessionId));
  }
  async latestSession() {
    const db = await this.dbP;
    const all = await tx(db, SESSIONS, "readonly", (s) => s.getAll());
    return all.sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0];
  }
  async clearSession(sessionId) {
    const db = await this.dbP;
    const rows = await tx(db, CAPTURES, "readonly", (s) => s.index("bySession").getAll(sessionId));
    for (const r of rows) await tx(db, CAPTURES, "readwrite", (s) => s.delete(r.key));
    await tx(db, SESSIONS, "readwrite", (s) => s.delete(sessionId));
  }
  /**
   * Prune every session EXCEPT `keepSessionId`, so IndexedDB doesn't grow
   * unbounded across runs (each run is ~11 PNGs at DPR 3 = tens of MB). On iOS
   * Safari an over-quota origin gets its whole storage evicted, so keeping only
   * the current run's captures is deliberate. (H5)
   */
  async pruneOldSessions(keepSessionId) {
    const db = await this.dbP;
    const sessions = await tx(db, SESSIONS, "readonly", (s) => s.getAll());
    for (const s of sessions) {
      if (s.sessionId !== keepSessionId) await this.clearSession(s.sessionId);
    }
  }
};

// src/uploader.ts
var NoopUploader = class {
  async upload(_capture) {
  }
  async flush() {
  }
};
var HttpUploader = class {
  constructor(opts) {
    this.queue = [];
    this.active = 0;
    /** Captures that exhausted their retries; they stay in IDB (uploaded:false). */
    this.failed = [];
    // Use the ORIGINAL fetch (captured at construction, before NetworkTracker may
    // have wrapped it) so uploads don't count as "pending" network and stall the
    // runner's stabilize() on every subsequent scenario.
    this.rawFetch = typeof window !== "undefined" ? window.fetch.bind(window) : fetch;
    this.opts = { concurrency: 2, maxRetries: 3, ...opts };
  }
  async upload(capture) {
    this.queue.push(capture);
    this.pump();
  }
  pump() {
    while (this.active < this.opts.concurrency && this.queue.length) {
      const cap = this.queue.shift();
      this.active++;
      this.send(cap).then(() => this.opts.onUploaded?.(cap)).catch(() => {
        this.failed.push(cap);
      }).finally(() => {
        this.active--;
        this.pump();
      });
    }
  }
  async send(cap, attempt = 1) {
    try {
      const form = new FormData();
      form.append("meta", JSON.stringify(cap.meta));
      form.append("image", cap.blob, cap.meta.filename);
      const res = await this.rawFetch(this.opts.endpoint, { method: "POST", headers: this.opts.headers, body: form });
      if (!res.ok) throw new Error(`upload ${res.status}`);
    } catch (e) {
      if (attempt >= this.opts.maxRetries) throw e;
      await new Promise((r) => setTimeout(r, 500 * attempt));
      return this.send(cap, attempt + 1);
    }
  }
  async flush(timeoutMs = 3e4) {
    const deadline = Date.now() + timeoutMs;
    while ((this.active > 0 || this.queue.length > 0) && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 100));
    }
  }
};

// src/runner.ts
var VisualTestRunner = class {
  constructor(opts) {
    this.storage = new VisualStorage();
    this.net = new NetworkTracker();
    this.pauseGate = null;
    this.resumeFn = null;
    this.stopped = false;
    this.opts = opts;
    this.engine = opts.engine;
    this.nav = opts.navigator;
    this.uploader = opts.uploader ?? new NoopUploader();
    this.readyTimeout = opts.defaultReadyTimeout ?? 1e4;
    this.quietMs = opts.stabilizeQuietMs ?? 300;
    this.postScrollSettleMs = opts.postScrollSettleMs ?? 400;
    this.state = this.freshState();
  }
  getState() {
    return this.state;
  }
  freshState() {
    return {
      sessionId: newId(),
      suiteId: this.opts.suite.id,
      suiteName: this.opts.suite.name,
      status: "idle",
      startedAt: (/* @__PURE__ */ new Date()).toISOString(),
      captureIndex: 0,
      totalCaptures: countCaptures(this.opts.suite.scenarios),
      failures: [],
      uploaded: 0
    };
  }
  emit(patch) {
    this.state = { ...this.state, ...patch };
    this.opts.onState?.(this.state);
    void this.storage.saveSession(this.state);
  }
  // ── lifecycle ────────────────────────────────────────────────────────────
  async start() {
    this.stopped = false;
    this.pauseGate = null;
    this.resumeFn = null;
    this.state = this.freshState();
    void this.storage.pruneOldSessions(this.state.sessionId).catch(() => {
    });
    this.net.install();
    enableVisualMode();
    this.emit({ status: "running" });
    try {
      for (const scenario of this.opts.suite.scenarios) {
        if (this.stopped) break;
        await this.gate();
        await this.runScenario(scenario);
      }
      await this.uploader.flush();
      this.emit({ status: this.stopped ? "stopped" : "complete", finishedAt: (/* @__PURE__ */ new Date()).toISOString() });
    } catch (e) {
      this.emit({ status: "error", finishedAt: (/* @__PURE__ */ new Date()).toISOString() });
      throw e;
    } finally {
      disableVisualMode();
    }
    return this.state;
  }
  pause() {
    if (this.state.status !== "running") return;
    this.pauseGate = new Promise((res) => {
      this.resumeFn = res;
    });
    this.emit({ status: "paused" });
  }
  resume() {
    if (this.state.status !== "paused") return;
    this.emit({ status: "running" });
    this.resumeFn?.();
    this.pauseGate = null;
    this.resumeFn = null;
  }
  stop() {
    this.stopped = true;
    this.resumeFn?.();
  }
  async gate() {
    if (this.pauseGate) await this.pauseGate;
  }
  // ── scenario execution ─────────────────────────────────────────────────────
  async runScenario(scenario) {
    this.emit({ currentScenarioId: scenario.id, currentScenarioName: scenario.name, currentCheckpointId: void 0 });
    try {
      await this.nav.goto(scenario.route);
      await this.nav.settle();
      if (scenario.waitFor) {
        const ok = await waitForReady(scenario.waitFor, scenario.waitTimeout ?? this.readyTimeout);
        if (!ok) this.recordFailure(scenario.id, void 0, new Error(`ready signal "${scenario.waitFor}" not seen within timeout (captured anyway)`));
      }
      await this.stabilize();
      if (scenario.actions?.length) {
        for (const action of scenario.actions) {
          if (this.stopped) break;
          await this.gate();
          await this.runAction(scenario, action);
        }
      }
      if (scenario.captures?.length) {
        for (const cp of scenario.captures) {
          if (this.stopped) break;
          await this.gate();
          await this.runCheckpoint(scenario, cp);
        }
      }
    } catch (e) {
      this.recordFailure(scenario.id, void 0, e);
      try {
        await this.captureNow(scenario, `error-${scenario.id}`, "error state");
      } catch {
      }
    }
  }
  async runAction(scenario, action) {
    switch (action.type) {
      case "navigate":
        await this.nav.goto(action.route);
        await this.nav.settle();
        await this.stabilize();
        break;
      case "click": {
        const el = document.querySelector(action.target);
        if (!el) throw new Error(`click target not found: ${action.target}`);
        el.click();
        await this.nav.settle();
        await this.stabilize();
        break;
      }
      case "scroll":
        await performScroll(action.to);
        await this.stabilize();
        break;
      case "waitForReady": {
        const ok = await waitForReady(action.id, action.timeout ?? this.readyTimeout);
        if (!ok) throw new Error(`ready "${action.id}" not seen`);
        break;
      }
      case "wait":
        await delay(action.ms);
        break;
      case "setState":
        window.dispatchEvent(new CustomEvent("visual-capture:setState", { detail: { name: action.name, payload: action.payload } }));
        await this.nav.settle();
        await this.stabilize();
        break;
      case "capture":
        await this.captureNow(scenario, action.id, action.label);
        break;
    }
  }
  async runCheckpoint(scenario, cp) {
    let scrolled = false;
    if (cp.scroll) {
      await performScroll(cp.scroll);
      scrolled = true;
    } else if (cp.scrollTo) {
      await performScroll({ selector: cp.scrollTo });
      scrolled = true;
    } else if (typeof cp.scrollPercent === "number") {
      await performScroll({ percent: cp.scrollPercent });
      scrolled = true;
    }
    await this.stabilize();
    if (scrolled) await this.settleAfterScroll();
    await this.captureNow(scenario, cp.id, cp.label);
  }
  /** Two animation frames + a delay so a scrolled viewport is fully painted. */
  async settleAfterScroll() {
    if (typeof requestAnimationFrame === "function") {
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
    }
    await delay(this.postScrollSettleMs);
  }
  // ── capture + stabilization ─────────────────────────────────────────────────
  /** Wait for network quiet + assets + a short settle so the frame is stable. */
  async stabilize() {
    await this.net.waitQuiet(this.quietMs, this.readyTimeout);
    await waitForAssets(2e3);
    await this.nav.settle();
    await delay(this.quietMs);
  }
  async captureNow(scenario, checkpointId, label) {
    const index = this.state.captureIndex + 1;
    this.emit({ captureIndex: index, currentCheckpointId: checkpointId });
    const result = await this.engine.capture({
      scenarioId: scenario.id,
      checkpointId,
      viewportOnly: true
    });
    const meta = buildMetadata({
      sessionId: this.state.sessionId,
      index,
      scenario: scenario.id,
      checkpoint: checkpointId,
      label,
      route: this.nav.currentRoute(),
      engine: this.engine.id,
      appVersion: this.opts.env?.appVersion,
      gitCommit: this.opts.env?.gitCommit
    });
    const stored = { meta, blob: result.blob, uploaded: false };
    await this.storage.saveCapture(this.state.sessionId, stored);
    void this.uploader.upload(stored).then(() => {
      void this.storage.markUploaded(this.state.sessionId, index);
      this.emit({ uploaded: this.state.uploaded + 1 });
    }).catch(() => {
    });
  }
  recordFailure(scenario, checkpoint, err) {
    this.emit({
      failures: [
        ...this.state.failures,
        { scenario, checkpoint, message: String(err?.message ?? err).slice(0, 300), timestamp: (/* @__PURE__ */ new Date()).toISOString() }
      ]
    });
  }
  // ── export ──────────────────────────────────────────────────────────────────
  async getStoredCaptures() {
    return this.storage.listCaptures(this.state.sessionId);
  }
};
function countCaptures(scenarios) {
  let n = 0;
  for (const s of scenarios) {
    n += (s.actions ?? []).filter((a) => a.type === "capture").length;
    n += (s.captures ?? []).length;
  }
  return n;
}
function newId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return "vc-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// src/capture/DomCaptureEngine.ts
import { domToBlob } from "modern-screenshot";
var REDACT_ATTR = "data-visual-redact";
var IGNORE_ATTR = "data-visual-ignore";
var DomCaptureEngine = class {
  constructor(opts = {}) {
    this.id = "dom:modern-screenshot";
    this.opts = opts;
  }
  async capture(req) {
    if (typeof window === "undefined") throw new Error("DomCaptureEngine requires a DOM");
    const dpr = window.devicePixelRatio || 1;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const target = req.target || document.documentElement;
    const captureWidth = req.viewportOnly ? vw : target.scrollWidth;
    const captureHeight = req.viewportOnly ? vh : target.scrollHeight;
    const blob = await domToBlob(target, {
      // Capture the viewport box at real DPR (matches the native screenshot).
      width: captureWidth,
      height: captureHeight,
      scale: dpr,
      backgroundColor: this.opts.backgroundColor ?? "#ffffff",
      // CRITICAL: pin the cloned root to the real layout width. Without this,
      // modern-screenshot renders <html> into a foreignObject that reflows to a
      // content-driven (narrower) width, so text wraps differently than on the
      // real device - the capture came out as if the viewport were much
      // narrower. Forcing width/min/max to the live viewport makes the clone lay
      // out identically to the screen. (When viewport-only we also translate to
      // the current scroll position.)
      style: {
        width: `${captureWidth}px`,
        minWidth: `${captureWidth}px`,
        maxWidth: `${captureWidth}px`,
        // THE FIX for "capture wraps more than the real screen at the same
        // width": the clone renders inside an SVG image document that has NO
        // <meta viewport>, so iOS WebKit re-enables text auto-sizing and inflates
        // px-sized UI text ~20%, forcing extra line-wraps + overlap. On the live
        // page the computed value is 'auto' (== the default), so modern-screenshot
        // never carries an opt-out into the clone. Pin it explicitly here; it
        // inherits to the whole tree. (Both spellings for Safari + spec.)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ...{ webkitTextSizeAdjust: "100%", textSizeAdjust: "100%" },
        ...req.viewportOnly ? { transform: `translate(${-window.scrollX}px, ${-window.scrollY}px)`, transformOrigin: "top left" } : {}
      },
      filter: (node) => {
        if (node instanceof Element && node.hasAttribute(IGNORE_ATTR)) return false;
        return true;
      },
      onCloneNode: (cloned) => {
        if (cloned instanceof Element) {
          cloned.querySelectorAll?.(`[${REDACT_ATTR}]`).forEach((el) => {
            el.style.filter = "blur(8px)";
            el.setAttribute("aria-hidden", "true");
          });
          const doc = cloned.ownerDocument;
          if (doc && cloned instanceof HTMLElement && !doc.getElementById("vc-text-size-fix")) {
            const s = doc.createElement("style");
            s.id = "vc-text-size-fix";
            s.textContent = "*{-webkit-text-size-adjust:100%!important;text-size-adjust:100%!important;}";
            cloned.prepend(s);
          }
        }
        if (cloned.ownerDocument && this.opts.onClone) this.opts.onClone(cloned.ownerDocument);
      }
      // KNOWN LIMITATION (M2): the flattened foreignObject clone has no
      // scrollport, so on a SCROLLED viewport capture, position:fixed elements
      // render at their document position (translated off-screen) and
      // position:sticky headers unstick. Top-of-page captures are faithful
      // (the spike's 0.09-0.82% numbers). For scrolled sticky/fixed fidelity,
      // prefer top-anchored checkpoints, or a future native capture engine.
    });
    return {
      blob,
      width: Math.round(captureWidth * dpr),
      height: Math.round(captureHeight * dpr)
    };
  }
};

// src/zip.ts
import JSZip from "jszip";
async function buildSessionZip(session, captures, layout = "both") {
  const zip = new JSZip();
  zip.file(
    "session.json",
    JSON.stringify(
      { session, captures: captures.map((c) => c.meta) },
      null,
      2
    )
  );
  const wantFolder = layout === "folder" || layout === "both";
  const wantCombined = layout === "combined" || layout === "both";
  for (const c of captures) {
    if (wantFolder) {
      zip.file(`${c.meta.scenario}/${c.meta.filename}`, c.blob);
    }
    if (wantCombined) {
      zip.file(`_combined/${c.meta.filename}`, c.blob);
    }
  }
  return zip.generateAsync({ type: "blob" });
}
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1e3);
}

// src/manifest.ts
function defineSuite(suite) {
  return suite;
}
function defineScenario(scenario) {
  return scenario;
}

export {
  NetworkTracker,
  waitForReady,
  waitForAssets,
  VISUAL_MODE_CLASS,
  enableVisualMode,
  disableVisualMode,
  delay,
  currentViewport,
  orientation,
  browserPlatform,
  buildFilename,
  buildMetadata,
  VisualStorage,
  NoopUploader,
  HttpUploader,
  VisualTestRunner,
  DomCaptureEngine,
  buildSessionZip,
  downloadBlob,
  defineSuite,
  defineScenario
};
//# sourceMappingURL=chunk-EHEIR3C7.js.map