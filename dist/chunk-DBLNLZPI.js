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

// src/runner.ts
var VisualTestRunner = class {
  constructor(opts) {
    this.net = new NetworkTracker();
    this.pauseGate = null;
    this.resumeFn = null;
    this.stopped = false;
    this.opts = opts;
    this.engine = opts.engine;
    this.nav = opts.navigator;
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
      failures: []
    };
  }
  emit(patch) {
    this.state = { ...this.state, ...patch };
    this.opts.onState?.(this.state);
  }
  // ── lifecycle ────────────────────────────────────────────────────────────
  async start() {
    this.stopped = false;
    this.pauseGate = null;
    this.resumeFn = null;
    this.state = this.freshState();
    this.net.install();
    enableVisualMode();
    this.emit({ status: "running" });
    try {
      for (const scenario of this.opts.suite.scenarios) {
        if (this.stopped) break;
        await this.gate();
        await this.runScenario(scenario);
      }
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
        window.dispatchEvent(new CustomEvent("voxissue:setState", { detail: { name: action.name, payload: action.payload } }));
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
  /** Signal the shutter — no pixels are produced or stored in the SDK. */
  async captureNow(scenario, checkpointId, label) {
    const index = this.state.captureIndex + 1;
    this.emit({ captureIndex: index, currentCheckpointId: checkpointId });
    void label;
    await this.engine.capture({
      scenarioId: scenario.id,
      checkpointId,
      viewportOnly: true
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

// src/manifest.ts
function defineSuite(suite) {
  return suite;
}
function defineScenario(scenario) {
  return scenario;
}

// src/gate.ts
function isVisualTestingAllowed(g) {
  if (g.isDev) return true;
  if (!g.featureFlag) return false;
  return g.isStaff === void 0 ? true : g.isStaff === true;
}

// src/capture/MipCaptureEngine.ts
function hooks() {
  if (typeof window === "undefined") return null;
  const w = window;
  const h = w.vi ?? w.mip;
  return typeof h?.capture === "function" ? h : null;
}
function isMipHost() {
  return hooks() !== null;
}
var PLACEHOLDER_PNG = Uint8Array.from(atob(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="
), (c) => c.charCodeAt(0));
var MipCaptureEngine = class {
  constructor() {
    this.id = "native:mip";
  }
  async capture(_req) {
    const mip = hooks();
    if (!mip) {
      return { blob: new Blob([PLACEHOLDER_PNG], { type: "image/png" }), width: 0, height: 0 };
    }
    mip.capture();
    await new Promise((r) => setTimeout(r, 350));
    return {
      blob: new Blob([PLACEHOLDER_PNG], { type: "image/png" }),
      width: window.innerWidth,
      height: window.innerHeight
    };
  }
  /** Signal MIP that the whole run is over (it advances to the next pages.json URL). */
  finishRun() {
    hooks()?.done();
  }
};

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
  VisualTestRunner,
  defineSuite,
  defineScenario,
  isVisualTestingAllowed,
  isMipHost,
  MipCaptureEngine
};
//# sourceMappingURL=chunk-DBLNLZPI.js.map