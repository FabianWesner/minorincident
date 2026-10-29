# N28-01 / N28-02: L5 metro visual contacts

Base: main `ee620be74`, frozen QA build; WebGPU high and low, all three catalog zooms. Scene: `tests/scenes/catalog/collision-l5-metro-ingress.json` (five production aftermath followers, production queue coordinates, shutter closure, 720 fixed ticks).

Tracked as [GitHub #1](https://github.com/FabianWesner/minorincident/issues/1) (arm/wall) and [GitHub #2](https://github.com/FabianWesner/minorincident/issues/2) (cane/hand).

| Follow-up | Classification | Evidence | Scope of repair |
| --- | --- | --- | --- |
| N28-01: Dale's left forearm intersects the station rear surface | Real game visual bug | At z1 and z0.5, follower-0 / foreArmL crosses `bld.metro-entrance:225` at `(38.223,1.147,-51.760)`, frame 492, 20 sampled contacts. At z1.5 the same bone crosses at `(38.188,1.149,-51.760)`, frame 501, 16 contacts, plus two thigh clearance contacts. | Review posed arm clearance at the rear queue slot. A lane/slot move could affect the corgi's explicitly reserved 0.88 m lane and Q-215's ingress timing, so a safe fix requires targeted navigation/pose work. No geometry, collision or assertion threshold was changed. |
| N28-02: Mr Okafor's cane intersects his right hand while moving | Real held-prop visual bug | follower-2 handR/cane: 5–6 intersecting triangles, approximately 1–3 × 4 × 1–3 cm. Observed at frames 303 / 522 / 528 across the three zooms and LOD bands. | Refit the moving aftermath cane grip against the posed hand across LODs; preserve the existing cane floor contract and arm motion. A static prop offset would risk the planted tip and Q-205 fixes. |

[Exact per-row receipts](../evidence/l5-metro-clipping.json), [reviewed contact sheet](../evidence/l5-metro-sheet.jpg). Full local metrics and sheets remain under `test-results/scene-nightly/webgpu-high-23/collision-l5-metro-ingress@high-z*/`.

All six rows fail only `clippingMax: 0`. Their travel, body-overlap, collision-failure/pending, rendering and console gates pass. The low-tier run exactly reproduces the high-tier bone coordinates and frame counts. The same semantic contacts occur at all three zooms, so this is not classified as a flaky browser failure. These records do not claim a full campaign timing failure.

Reproduce (headless, shared pool, private port):

```sh
SCENE_PORT=4342 E2E_UNITS=1 npm run scene:catalog -- --matrix --jobs 1 --backend webgpu --tier high --filter collision-l5-metro-ingress --out test-results/nightly-28/repro-l5-metro
```
