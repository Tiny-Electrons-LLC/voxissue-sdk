import {
  DomCaptureEngine,
  MipCaptureEngine,
  VisualTestRunner,
  buildSessionZip,
  downloadBlob,
  isMipHost
} from "../chunk-APR47V5W.js";

// src/vue/index.ts
import { ref, shallowRef, readonly, onMounted as onMounted2, onBeforeUnmount } from "vue";

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

// src/vue/VisualTestPanel.ts
import { defineComponent, h, computed, onMounted } from "vue";
var STYLE_ID = "vc-panel-style";
var CSS = `
.vc-panel{font:13px/1.4 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;color:#e6e8eb;background:#1a1f26;border:1px solid #2a2f36;border-radius:10px;padding:14px;max-width:420px}
.vc-panel h3{margin:0 0 10px;font-size:15px}
.vc-row{display:flex;align-items:center;gap:8px;margin:6px 0}
.vc-row label{color:#9aa0a6;min-width:64px}
.vc-panel select{flex:1;background:#0f1419;color:#e6e8eb;border:1px solid #2a2f36;border-radius:6px;padding:6px 8px;min-height:36px}
.vc-btn{background:#0f1419;color:#e6e8eb;border:1px solid #2a2f36;border-radius:6px;padding:0 12px;min-height:36px;cursor:pointer;display:inline-flex;align-items:center;gap:6px}
.vc-btn:hover{background:#232a33}.vc-btn:disabled{opacity:.5;cursor:not-allowed}
.vc-btn-primary{background:#2563eb;border-color:#2563eb;color:#fff}
.vc-btn-danger{color:#f87171;border-color:#7f1d1d}
.vc-progress{height:6px;background:#0f1419;border-radius:4px;overflow:hidden;margin:8px 0}
.vc-progress-bar{height:100%;background:#3b82f6;transition:width .2s}
.vc-muted{color:#9aa0a6}
.vc-fail{color:#f87171;font-size:12px}
.vc-overlay{position:fixed;inset:0;z-index:2147483000;background:rgba(0,0,0,.35);display:flex;align-items:flex-start;justify-content:center;pointer-events:auto;touch-action:none;overscroll-behavior:contain}
.vc-overlay-card{margin-top:16px;background:#1a1f26;color:#e6e8eb;border:1px solid #2a2f36;border-radius:10px;padding:10px 14px;display:flex;align-items:center;gap:12px;box-shadow:0 8px 24px rgba(0,0,0,.4)}
.vc-dot{width:8px;height:8px;border-radius:50%;background:#3b82f6;animation:vc-pulse 1s infinite}
@keyframes vc-pulse{0%,100%{opacity:.4}50%{opacity:1}}
`;
function injectStyle() {
  if (typeof document === "undefined" || document.getElementById(STYLE_ID)) return;
  const s = document.createElement("style");
  s.id = STYLE_ID;
  s.textContent = CSS;
  document.head.appendChild(s);
}
var VisualTestPanel_default = defineComponent({
  name: "VisualTestPanel",
  props: {
    controller: { type: Object, required: true }
  },
  setup(props) {
    onMounted(injectStyle);
    const c = props.controller;
    const st = computed(() => c.state.value);
    const status = computed(() => st.value?.status ?? "idle");
    const total = computed(() => st.value?.totalCaptures ?? 0);
    const done = computed(() => st.value?.captureIndex ?? 0);
    const pct = computed(() => total.value ? Math.min(100, Math.round(done.value / total.value * 100)) : 0);
    const isRunning = computed(() => status.value === "running");
    const isPaused = computed(() => status.value === "paused");
    const isComplete = computed(() => status.value === "complete" || status.value === "stopped" || status.value === "error");
    return () => {
      const children = [
        h("h3", "Visual Testing"),
        h("div", { class: "vc-row" }, [
          h("label", "Suite"),
          h("select", {
            value: c.selectedSuiteId.value,
            disabled: c.running.value,
            onChange: (e) => {
              c.selectedSuiteId.value = e.target.value;
            }
          }, c.suites.map((s) => h("option", { value: s.id }, s.name)))
        ])
      ];
      if (st.value) {
        children.push(
          h("div", { class: "vc-progress" }, [h("div", { class: "vc-progress-bar", style: { width: pct.value + "%" } })]),
          h("div", { class: "vc-row vc-muted" }, `${done.value} / ${total.value}  \xB7  ${status.value}` + (st.value.uploaded ? `  \xB7  ${st.value.uploaded} uploaded` : ""))
        );
        if (st.value.currentScenarioName) {
          children.push(h("div", { class: "vc-row vc-muted" }, `${st.value.currentScenarioName}${st.value.currentCheckpointId ? " \u2192 " + st.value.currentCheckpointId : ""}`));
        }
        if (st.value.failures.length) {
          children.push(h("div", { class: "vc-fail" }, `${st.value.failures.length} failure(s): ` + st.value.failures.slice(-2).map((f) => f.scenario).join(", ")));
        }
      }
      const controls = [];
      if (!isRunning.value && !isPaused.value) {
        controls.push(h("button", { class: "vc-btn vc-btn-primary", onClick: () => c.start() }, "Start"));
      }
      if (isRunning.value) controls.push(h("button", { class: "vc-btn", onClick: () => c.pause() }, "Pause"));
      if (isPaused.value) controls.push(h("button", { class: "vc-btn vc-btn-primary", onClick: () => c.resume() }, "Resume"));
      if (isRunning.value || isPaused.value) controls.push(h("button", { class: "vc-btn vc-btn-danger", onClick: () => c.stop() }, "Stop"));
      if (isComplete.value) {
        children.push(h("div", { class: "vc-row" }, [
          h("label", "ZIP"),
          h("select", {
            value: c.zipLayout.value,
            onChange: (e) => {
              c.zipLayout.value = e.target.value;
            }
          }, [
            h("option", { value: "both" }, "Both"),
            h("option", { value: "combined" }, "All (one folder)"),
            h("option", { value: "folder" }, "In folders")
          ])
        ]));
        controls.push(h("button", { class: "vc-btn vc-btn-primary", onClick: () => c.downloadZip() }, "Download ZIP"));
        controls.push(h("button", { class: "vc-btn", onClick: () => c.start() }, "Run again"));
      }
      children.push(h("div", { class: "vc-row" }, controls));
      const panel = h("div", { class: "vc-panel", "data-visual-ignore": "" }, children);
      if (isRunning.value || isPaused.value) {
        return [
          panel,
          h("div", { class: "vc-overlay", "data-visual-ignore": "" }, [
            h("div", { class: "vc-overlay-card" }, [
              h("span", { class: "vc-dot" }),
              h("span", `Visual Test ${isPaused.value ? "Paused" : "Running"}  ${done.value} / ${total.value}`),
              h("button", { class: "vc-btn", onClick: () => isPaused.value ? c.resume() : c.pause() }, isPaused.value ? "Resume" : "Pause"),
              h("button", { class: "vc-btn vc-btn-danger", onClick: () => c.stop() }, "Stop")
            ])
          ])
        ];
      }
      return panel;
    };
  }
});

// src/vue/index.ts
function isVisualTestingAllowed(g) {
  if (g.isDev) return true;
  if (!g.featureFlag) return false;
  return g.isStaff === void 0 ? true : g.isStaff === true;
}
function createVisualTesting(opts) {
  const engine = opts.engine ?? (isMipHost() ? new MipCaptureEngine() : new DomCaptureEngine());
  const navigator = new RouterNavigator(opts.router);
  const suites = opts.suites;
  const selectedSuiteId = ref(suites[0]?.id ?? "");
  const state = shallowRef(null);
  const running = ref(false);
  const zipLayout = ref("both");
  let runner = null;
  function makeRunner() {
    const suite = suites.find((s) => s.id === selectedSuiteId.value) ?? suites[0];
    return new VisualTestRunner({
      suite,
      engine,
      navigator,
      uploader: opts.uploader,
      env: opts.env,
      defaultReadyTimeout: opts.defaultReadyTimeout,
      stabilizeQuietMs: opts.stabilizeQuietMs,
      postScrollSettleMs: opts.postScrollSettleMs,
      onState: (s) => {
        state.value = s;
      }
    });
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
  async function downloadZip() {
    if (!runner || !state.value) return;
    const captures = await runner.getStoredCaptures();
    const zip = await buildSessionZip(state.value, captures, zipLayout.value);
    const day = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
    downloadBlob(zip, `visual-capture-${day}.zip`);
  }
  return { suites, selectedSuiteId, state: readonly(state), running: readonly(running), zipLayout, start, pause, resume, stop, downloadZip };
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
  onMounted2(() => {
    if (autoOnMount) markReady();
  });
  onBeforeUnmount(clearReady);
  return { readyEl, isReady: readonly(isReady), markReady, clearReady };
}
export {
  RouterNavigator,
  VisualTestPanel_default as VisualTestPanel,
  createVisualTesting,
  isVisualTestingAllowed,
  useVisualReady
};
//# sourceMappingURL=index.js.map