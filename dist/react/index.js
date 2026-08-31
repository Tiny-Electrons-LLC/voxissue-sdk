import {
  MipCaptureEngine,
  VisualTestRunner,
  isMipHost,
  isVisualTestingAllowed
} from "../chunk-DBLNLZPI.js";

// src/react/index.ts
import { useEffect, useRef, useState } from "react";
var FunctionNavigator = class {
  constructor(navigate, getPath) {
    this.navigate = navigate;
    this.getPath = getPath;
  }
  async goto(route) {
    await this.navigate(route);
  }
  currentRoute() {
    return this.getPath();
  }
  async settle() {
    await new Promise((r) => {
      if (typeof requestAnimationFrame === "function") {
        requestAnimationFrame(() => requestAnimationFrame(() => r()));
      } else {
        setTimeout(r, 0);
      }
    });
  }
};
function createVisualTesting(opts) {
  const engine = opts.engine ?? new MipCaptureEngine();
  const navigator = new FunctionNavigator(
    opts.navigate,
    opts.currentPath ?? (() => typeof location !== "undefined" ? location.pathname + location.search : "/")
  );
  let selected = opts.suites[0]?.id ?? "";
  let runner = null;
  let state = null;
  function makeRunner() {
    const suite = opts.suites.find((s) => s.id === selected) ?? opts.suites[0];
    return new VisualTestRunner({
      suite,
      engine,
      navigator,
      env: opts.env,
      defaultReadyTimeout: opts.defaultReadyTimeout,
      stabilizeQuietMs: opts.stabilizeQuietMs,
      postScrollSettleMs: opts.postScrollSettleMs,
      onState: (s) => {
        state = s;
        opts.onState?.(s);
      }
    });
  }
  async function start() {
    runner = makeRunner();
    try {
      await runner.start();
    } finally {
      if (engine instanceof MipCaptureEngine) engine.finishRun();
    }
  }
  if ((opts.autoStartInMip ?? true) && isMipHost()) {
    const RAN_KEY = "vc-mip-autorun-done";
    let alreadyRan = false;
    try {
      alreadyRan = sessionStorage.getItem(RAN_KEY) === "1";
    } catch {
    }
    if (!alreadyRan) {
      try {
        sessionStorage.setItem(RAN_KEY, "1");
      } catch {
      }
      setTimeout(() => {
        void start();
      }, 800);
    }
  }
  return {
    suites: opts.suites,
    selectSuite: (id) => {
      selected = id;
    },
    getState: () => state,
    start,
    pause: () => runner?.pause(),
    resume: () => runner?.resume(),
    stop: () => runner?.stop()
  };
}
function useVisualReady(id, ready) {
  const ref = useRef(null);
  const [el, setEl] = useState(null);
  useEffect(() => {
    setEl(ref.current);
  });
  useEffect(() => {
    if (!el) return;
    if (ready) el.setAttribute("data-visual-ready", id);
    else el.removeAttribute("data-visual-ready");
  }, [el, ready, id]);
  return ref;
}
export {
  FunctionNavigator,
  MipCaptureEngine,
  createVisualTesting,
  isMipHost,
  isVisualTestingAllowed,
  useVisualReady
};
//# sourceMappingURL=index.js.map