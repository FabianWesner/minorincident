# Batch 6 merge validation

Base: `3883a1679` (deployed batch 5). On `lane/merge-batch6`, merged `lane/telegraph-vfx` first (`d3db6d381`), then `lane/interior-cull` (`04753927d`). The only textual conflict was the matrix script: keep every batch 5 filter and add `telegraph-*` / `interior-cull-*`. No additional gameplay/render fix was needed. `src/assets/staticCollision.ts`, specs and protected reference directories were not changed. No deployment or merge into main was performed.

## Validation

- TypeScript (both projects), lint and fresh production build pass.
- Full Hetzner unit + levels: **1,854 passed, 11 skipped, one production-validator timeout**. All **19/19** tests in the isolated static/build, validator and L10-completion files pass under their original deadlines. The full run independently passes L10 completion, both continuous L1→L9/L1→L10 campaigns, L6 complete/newbie campaigns and `T-CONT-01S` (the lanes' old continuity failure). [Full run](unit-levels.log), [isolated results](unit-isolated.json).
- Full Hetzner sim: **1,061 passed, 18 timing/load failures**. One-worker retry: **66/79 passed**, clearing the NPC, Alpha-support, L9 handover, L5 shotgun and campus-route failures; The remaining **13/13 pass with both runner slots exclusively locked**, under the original deadlines and p95 limits. All 18 initial failures are cleared; no functional sim failure remains. The intermediate one-worker run was not an exclusive reservation. [Initial run](sim.log), [shared retry](sim-retry-shared.json), [exclusive result](sim-exclusive.json), [exclusive output](sim-exclusive.log).
- Original browser gate: **120/120 passed**, **650/650** WebGPU matrix cases, smoke **6 Node + 31 browser** checks. [Gate output](gate.log), [browser result](deploy-browser.json), [matrix](deploy-matrix.json).
- Focused Alpha/interior matrix: **96/96**, both actual backends, both tiers, zoom 0.5/1/1.5, no console errors. Supplemental Mega WebGL2 matrix: **18/18**; the matching Mega WebGPU cases pass in the 650-case matrix. The additional Mega pass completes the telegraph lane's original six-fixture backend coverage. [WebGL2](webgl2-matrix.json), [WebGPU](webgpu-matrix.json), [visual review](review.md).
- Targeted physical/animated telegraph browser tests: **9/9** (three desktop/phone aspect ratios, both mixed-horde tiers, warning birth/animation/persistence/settings). All changed unit files pass, including interior ownership/reveal, see-through, static equivalence, the 142 shipped bake comparisons and RGB telegraph restoration. [Browser output](telegraph-browser.log).

The initial focused WebGL pass overlapped the gate script's production rebuild, causing transient asset/layout 404s. The entire pass was rerun against stable output and passed 48/48. No assertions, thresholds or budgets were changed.

## Native performance

One quiet reservation, one headless native Metal Chrome worker, no other headless Chrome or local Vitest at preflight (load 2.48). Preflight was **04:07:43 UTC**, all locks released by **04:15:28 UTC**. The deploy browser suite still held the slots at 04:05:44, so even the earliest possible reservation start gives **less than ten minutes held**, below the 20-minute cap. The initial timer included waiting; its replacement enforced a fixed 04:24 UTC cutoff, also less than 20 minutes from that earliest possible start. There was no second quiet batch. [Conditions](perf/conditions.jsonl), [batch output](native-batch.log), [release](reservation-finish.log).

All **9 merged native tests and the 1 main-control test pass**, with one existing manual WebGPU-only desktop case skipped. The eight full-level interior A/B probes also pass. The low horde and L4/L5 phone profiles use 4× CPU throttling; these are emulated proxies, not physical-device recordings.

| Fixture | High | Low |
| --- | --- | --- |
| Desktop E18 horde frame p95 | 5.9 ms / 16.7 ms limit | — |
| Horde + 40 live civilians frame p95 | 6.5 ms / 14 ms limit | 11.4 ms / 33.3 ms limit |
| Alpha/dog mixed horde frame / sim p95 | 6.2 / 1.1 ms | 4.6 / 0.8 ms |
| Alpha/dog retained heap | 110.3 MB | 75.6 MB |
| L4 war / collapse frame measurement | p95 10.4 / 9.4 ms | p50 28.1 / 26.9 ms |
| L4 worst turn / tank / line-break hitch | 18.7 ms / 50 ms limit | 65.6 ms / 80 ms limit |
| L5 group walk frame measurement | p95 10.2 ms / 14 ms limit | p50 22.3 ms / 33.33 ms limit |
| L5 worst frame | 14.5 ms / 50 ms limit | 48.3 ms / 80 ms limit |

The existing L4/L5 low-tier tests gate p50 at phone throttle, not p95. For completeness, their measured p95 values are **L4 war 35.6 / collapse 37.6 ms; L5 34.3 ms**. This report does not claim those level samples meet a 33.3 ms p95 target. The strict E18 low horde p95 check passes at 11.4 ms. No test mode or threshold was altered.

Draws and triangles remain inside 600/1.5M high and 300/500k low in every tested pose. Peak Alpha/dog timing counters are 68 draws / 1,178,346 triangles high and 50 / 220,942 low. L4 war/collapse peaks at 365 / 575,843 high and 278 / 310,693 low; L5 pair camera is 324 / 641,735 high and 237 / 299,626 low. [Core output](native-budgets.log), [level output](level-native-budgets.log), raw JSON in [perf/](perf/).

The eight L4/L5 PO/street A/B poses all satisfy unchanged draw/triangle budgets and the probe's 0.1 ms interior CPU ceiling. At the L5 PO high camera, culling changes submitted geometry from **493,179 to 305,293 triangles**; low is **179,461 to 158,415**. The tool advances the simulation while sampling, so dynamic actors can change draw counts between the two culling states; it is not a frozen-frame image diff. [Raw A/B samples](perf/interior-ab.json).

## Interior lane's open E18 items

- **L4-low 91 ms hitch:** does not reproduce in this quiet run. Untouched batch 5/main passes: turn **61.6**, tank **43.4**, line break **64.2 ms**. Merged code passes: **60.8 / 51.2 / 65.6 ms**, all within 80 ms. [Main control](perf/main-l4-low.json), [merged](perf/l4-low.json).
- **Mobile L6 fixtures:** both Android/iOS WebGL proxies fail before measurement on untouched main and merged code with the same undefined `.origin` error. `tests/fixtures/scenarios/performance.ts` selects `D-MAIN`, absent in current L6; the relevant source is identical to the base commit. This is a baseline fixture issue and was left unchanged as requested. Three manual/WebGPU-only cases skip. No L6 mobile FPS result is claimed. [Main control](baseline-mobile.log), [merged](merged-mobile.log).

## Captures

The [review](review.md) describes opened charge/slam/grab sheets at zoom 0.5/1.5 and both-tier/backend zoom-1 views, plus the interior entry/reveal/exit sequence. Persistent sheets are in [captures/](captures/).

I also opened the native captures: the high horde shows a dense 200-infected cluster with warning decals beneath it and a separate row of civilians; the phone view crops that cluster at the left while retaining touch controls. The L4 phone war view shows firing soldiers, the green market stall and its open stock, civilians and an approaching Alpha. The L5 phone walk retains five follower health bars, corpses/street furniture and a clear guidance arrow through the red ash haze. The full-level shop before/after captures retain the same roof, red façade, windows, fence, courier and shadows; moving NPCs/ash differ because the probe advances the sim between samples. These views support the culling review without asserting pixel identity between advancing simulations.
