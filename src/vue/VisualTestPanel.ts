// Dev-only Visual Testing panel + running overlay. Written as a render-function
// component (not an SFC) so the library builds with plain tsup - no vue SFC
// compiler needed in the package toolchain. Styles are injected once, scoped by
// a vc- prefix. The consuming app mounts <VisualTestPanel :controller="..."/>
// somewhere dev-gated (e.g. Settings -> Developer).

import { defineComponent, h, computed, onMounted, type PropType } from 'vue'
import type { VisualTestingController } from './index.js'

const STYLE_ID = 'vc-panel-style'
const CSS = `
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
.vc-overlay{position:fixed;inset:0;z-index:2147483000;background:rgba(0,0,0,.35);display:flex;align-items:flex-start;justify-content:center;pointer-events:auto}
.vc-overlay-card{margin-top:16px;background:#1a1f26;color:#e6e8eb;border:1px solid #2a2f36;border-radius:10px;padding:10px 14px;display:flex;align-items:center;gap:12px;box-shadow:0 8px 24px rgba(0,0,0,.4)}
.vc-dot{width:8px;height:8px;border-radius:50%;background:#3b82f6;animation:vc-pulse 1s infinite}
@keyframes vc-pulse{0%,100%{opacity:.4}50%{opacity:1}}
`

function injectStyle(): void {
  if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) return
  const s = document.createElement('style')
  s.id = STYLE_ID
  s.textContent = CSS
  document.head.appendChild(s)
}

export default defineComponent({
  name: 'VisualTestPanel',
  props: {
    controller: { type: Object as PropType<VisualTestingController>, required: true },
  },
  setup(props) {
    onMounted(injectStyle)
    const c = props.controller
    const st = computed(() => c.state.value)
    const status = computed(() => st.value?.status ?? 'idle')
    const total = computed(() => st.value?.totalCaptures ?? 0)
    const done = computed(() => st.value?.captureIndex ?? 0)
    const pct = computed(() => total.value ? Math.round((done.value / total.value) * 100) : 0)
    const isRunning = computed(() => status.value === 'running')
    const isPaused = computed(() => status.value === 'paused')
    const isComplete = computed(() => status.value === 'complete' || status.value === 'stopped')

    return () => {
      const children = [
        h('h3', 'Visual Testing'),
        h('div', { class: 'vc-row' }, [
          h('label', 'Suite'),
          h('select', {
            value: c.selectedSuiteId.value,
            disabled: c.running.value,
            onChange: (e: Event) => { c.selectedSuiteId.value = (e.target as HTMLSelectElement).value },
          }, c.suites.map((s) => h('option', { value: s.id }, s.name))),
        ]),
      ]

      if (st.value) {
        children.push(
          h('div', { class: 'vc-progress' }, [h('div', { class: 'vc-progress-bar', style: { width: pct.value + '%' } })]),
          h('div', { class: 'vc-row vc-muted' }, `${done.value} / ${total.value}  ·  ${status.value}` + (st.value.uploaded ? `  ·  ${st.value.uploaded} uploaded` : '')),
        )
        if (st.value.currentScenarioName) {
          children.push(h('div', { class: 'vc-row vc-muted' }, `${st.value.currentScenarioName}${st.value.currentCheckpointId ? ' → ' + st.value.currentCheckpointId : ''}`))
        }
        if (st.value.failures.length) {
          children.push(h('div', { class: 'vc-fail' }, `${st.value.failures.length} failure(s): ` + st.value.failures.slice(-2).map((f) => f.scenario).join(', ')))
        }
      }

      // Controls
      const controls: ReturnType<typeof h>[] = []
      if (!isRunning.value && !isPaused.value) {
        controls.push(h('button', { class: 'vc-btn vc-btn-primary', onClick: () => c.start() }, 'Start'))
      }
      if (isRunning.value) controls.push(h('button', { class: 'vc-btn', onClick: () => c.pause() }, 'Pause'))
      if (isPaused.value) controls.push(h('button', { class: 'vc-btn vc-btn-primary', onClick: () => c.resume() }, 'Resume'))
      if (isRunning.value || isPaused.value) controls.push(h('button', { class: 'vc-btn vc-btn-danger', onClick: () => c.stop() }, 'Stop'))
      if (isComplete.value) {
        controls.push(h('button', { class: 'vc-btn vc-btn-primary', onClick: () => c.downloadZip() }, 'Download ZIP'))
        controls.push(h('button', { class: 'vc-btn', onClick: () => c.start() }, 'Run again'))
      }
      children.push(h('div', { class: 'vc-row' }, controls))

      const panel = h('div', { class: 'vc-panel' }, children)

      // While running, an overlay blocks stray taps that would corrupt the run.
      if (isRunning.value || isPaused.value) {
        return [
          panel,
          h('div', { class: 'vc-overlay' }, [
            h('div', { class: 'vc-overlay-card' }, [
              h('span', { class: 'vc-dot' }),
              h('span', `Visual Test ${isPaused.value ? 'Paused' : 'Running'}  ${done.value} / ${total.value}`),
              h('button', { class: 'vc-btn', onClick: () => (isPaused.value ? c.resume() : c.pause()) }, isPaused.value ? 'Resume' : 'Pause'),
              h('button', { class: 'vc-btn vc-btn-danger', onClick: () => c.stop() }, 'Stop'),
            ]),
          ]),
        ]
      }
      return panel
    }
  },
})
