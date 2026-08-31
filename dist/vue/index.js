import {
  MipCaptureEngine,
  VisualTestRunner,
  isMipHost,
  isVisualTestingAllowed
} from "../chunk-DBLNLZPI.js";

// src/vue/index.ts
import { ref, shallowRef, readonly, onMounted, onBeforeUnmount } from "vue";

// src/vue/RouterNavigator.ts
import { nextTick } from "vue";
var RouterNavigator = class {
  constructor(router) {
    this.router = router;
  }
  async goto(route) {
    if (this.router.currentRoute.value.fullPath === route) return;
    await this.router.push(route);
  }
  currentRoute() {
    return this.router.currentRoute.value.fullPath;
  }
  async settle() {
    await nextTick();
    await nextTick();
  }
};

// src/vue/index.ts
function createVisualTesting(opts) {
  const engine = opts.engine ?? new MipCaptureEngine();
  const navigator = new RouterNavigator(opts.router);
  const suites = opts.suites;
  const selectedSuiteId = ref(suites[0]?.id ?? "");
  const state = shallowRef(null);
  const running = ref(false);
  let runner = null;
  function makeRunner() {
    const suite = suites.find((s) => s.id === selectedSuiteId.value) ?? suites[0];
    return new VisualTestRunner({
      suite,
      engine,
      navigator,
      env: opts.env,
      defaultReadyTimeout: opts.defaultReadyTimeout,
      stabilizeQuietMs: opts.stabilizeQuietMs,
      postScrollSettleMs: opts.postScrollSettleMs,
      onState: (s) => {
        state.value = s;
      }
    });
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
  async function start() {
    if (running.value) return;
    runner = makeRunner();
    running.value = true;
    try {
      await runner.start();
    } catch (e) {
      const s = runner.getState();
      s.failures.push({ scenario: "(runner)", message: String(e?.message ?? e).slice(0, 300), timestamp: (/* @__PURE__ */ new Date()).toISOString() });
      state.value = { ...s };
    } finally {
      running.value = false;
      if (engine instanceof MipCaptureEngine) engine.finishRun();
    }
  }
  function pause() {
    runner?.pause();
  }
  function resume() {
    runner?.resume();
  }
  function stop() {
    runner?.stop();
  }
  return { suites, selectedSuiteId, state: readonly(state), running: readonly(running), start, pause, resume, stop };
}
function useVisualReady(id, autoOnMount = false) {
  const readyEl = ref(null);
  const isReady = ref(false);
  function markReady() {
    isReady.value = true;
    readyEl.value?.setAttribute("data-visual-ready", id);
  }
  function clearReady() {
    isReady.value = false;
    readyEl.value?.removeAttribute("data-visual-ready");
  }
  onMounted(() => {
    if (autoOnMount) markReady();
  });
  onBeforeUnmount(clearReady);
  return { readyEl, isReady: readonly(isReady), markReady, clearReady };
}
export {
  RouterNavigator,
  createVisualTesting,
  isVisualTestingAllowed,
  useVisualReady
};
//# sourceMappingURL=index.js.map