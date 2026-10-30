# q249 verification

Runtime/source revision: `aa4c28ce1` (later commits contain only reports and capture/audit tools). No acceptance thresholds or scene specifications were changed.

| Check | Result | Evidence |
| --- | --- | --- |
| Exported geometry | 394 files, 65 adult variants / 68 adult figures, zero errors; both head caps pass | [audit](export-audit.json) |
| Body preservation | shoulder envelopes unchanged within 0.01 mm; body joint positions and leg lengths retained; heroine and children unchanged | [audit](export-audit.json) |
| Textures/topology | original image bytes retained; no triangle growth; no added crowd draws or shader attributes | [audit](export-audit.json) |
| `npm test` | 110/110, 26 files | [log](qa/npm-test.log) |
| `npm run typecheck` | pass | [log](qa/typecheck.log) |
| `npm run lint` | pass | [log](qa/lint.log) |
| `npm run scene:gate` | **48/48**, zero known failures, zero not run | [summary](qa/scene-gate-summary.md), [log](qa/scene-gate.log) |
| `npm run test:smoke` | **7/7** (6 QA + 1 public), 138.6 s / 240 s budget; no shader builds after warm-up | [log](qa/smoke.log) |
| GPU program limits | WebGL 472 programs / 66 crowd; WebGPU 713 / 81 crowd; max attributes 13, varyings 14, crowd buffers 5 / all 8 | [WebGL](qa/crowd-gpu-limits-webgl.json), [WebGPU](qa/crowd-gpu-limits-webgpu.json) |

## Seating correction

The first full gate exposed seven collisions during the elderly figure's chair entry. The renderer had overridden the sitting animation with a walking clip while navigation speed decayed. Settling sitters now retain their seat animation; a once-per-batch pelvis-height measurement aligns each rig to the existing seat anchor. The bench, lawn chair A and lawn chair B pass with no clipping at both tiers. [High sheet](qa/sit-all-high-sheet.jpg), [low sheet](qa/sit-all-low-sheet.jpg), [high metrics](qa/sit-all-high-metrics.json), [low metrics](qa/sit-all-low-metrics.json).

## Visual inspection record

Inspected studio pages `studio-01.jpg` through `studio-17.jpg`, high game-camera pages `game15-01.jpg` through `game15-17.jpg`, and low pages `low-game15-01.jpg` through `low-game15-17.jpg` and `low-game1-01.jpg` through `low-game1-17.jpg`. Studio pairs use the same actual game metres; game sheets preserve native screenshot scale. Low zoom 1 retains distinguishable hats, hair, glasses and face contrast; no face repaint was used. The actual skinned male courier, rather than his legacy rigid prop, is included.

Inspected both final L1 contact sheets and their full bench/depot captures. The yellow cap has a seated crown, mugs are hand-sized and held, and the production bench sitter starts seated at the paused intro. The depot comparison includes both complete figures.

Inspected all 24 final high/low infected/corpse grid images (`0,4,...,44`) and both original-main corpse comparison frames. Existing folded corpse poses are retained in both versions; head/hair changes follow their body poses. The measurement audit covers the remaining static/group human meshes.

The lineup baseline is approved pilot-2 checkpoint `168a33a1e` (blue man already fixed); its earlier before/after remains in pilot-2. L1 and cold-load baselines use original main `4698e5aa0`. Captures ran headlessly through the shared browser pool using Metal. Only one baseline copy was used.

## Paired L1 cold-load timing

Ten alternating baseline/current pairs, fresh profile and disk cache for every sample, public builds, native WebGPU low, exclusive pool admission. Median **2.128 → 2.134 s (+0.006 s)**; p90 **2.145 → 2.144 s (−0.001 s)**; worst sample **2.160 → 2.193 s (+0.032 s)**. All are within the 0.3 s allowance. Every sample used a native adapter without fallback or console errors. [Summary and adapter receipts](load/summary.json), [raw samples](load/samples/).

The single `/tmp/q249-baseline` copy and the timing run’s browser caches were removed after completion. No task-owned server or validation check is left running. The initial final-smoke retry hit an occupied default preview port before tests started; the complete passing rerun used private port 3373.
