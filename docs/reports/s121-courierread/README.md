# s121 · Courier readability

## Delivered

- Existing warm gold foreground contour strengthened in `PaletteMaterial` (.25 → .55). No new render pass.
- Healthy ordinary attacker bars limited to the six closest within six metres. Player-damaged and mandatory special-enemy bars retain eligibility.
- Ordinary infected bars crossing the courier silhouette are suppressed instead of piling into a shared row above her head. Mandatory special-enemy and follower information remains available.
- Simulation stats/behavior, crowd density and corpse persistence are unchanged.

Main revision `2815e0d5` was merged without conflicts. Its all-level interaction sweep moved unchanged into nightly; this lane did not trim tests. Per orchestrator direction, the west-breach dark courier is ordinary building shadow, correct lighting. Investigation is stopped; no lighting-floor or shadow change was retained.

## Reviewed sheet

`contact.jpg` is the one committed small sheet. Four matched moving-crowd before/after pairs show L4 HIGH z1, LOW z1, HIGH z1.5 and L6 HIGH z1 at 30 HP, plus a current open-street L1 control with foreground off. Before uses the render source from merged main `2815e0d5`; after uses this lane's contour/bar changes. Both advance the same 48-infected Scene Lab fixtures to frame 60. These are labeled fixture views, not production-route acceptance footage.

I looked at the courier's body/edge, bars crossing or accumulating above her, the HUD HP readout, and the open-street appearance. Before has a broad red/white bar thicket; after removes most of it around the courier. The warm edge remains visible in the plaza and dark tunnel. The HUD reads 30/100; the L1 control retains ordinary appearance with no foreground contour. At sheet size the bar reduction is the clearest improvement; the contour is subtler. No new courier geometry defect is visible in these reviewed frames.

## Validation

- Typecheck and lint passed after implementation and capture-tool changes.
- Existing L4 contract asserts healthy-attacker selection, ordinary-bar suppression at the courier, mandatory Alpha preservation and follower placement.
- Reproducible 30-HP moving-crowd matrix: 48 samples across L4/L6, HIGH/LOW, zoom 1/1.5 and WebGL2/WebGPU, frames 1/30/60. Minimum courier ID-mask body visibility: 0.999611 WebGL2 / 0.999029 WebGPU. Zero console errors. All 16 clipping reports have zero courier-versus-prop, gun/body and held-prop hits. Infected/scenery warnings are separate and do not establish a courier defect.
- HIGH WebGL2 L1/open-street foreground-off controls and native title-menu check passed. The exit/retreat probe did not reach clear space because infected followed; it is not transition/popping clearance.
- Final remote `sh tools/remote/run.sh "$PWD" -- npm test` passed on 46.225.66.90 after merge and bar suppression: 105 passed, 1 skipped, 27 files, 121.4 seconds within 240 seconds, exit 0.

Reproduce:

```sh
SCENE_PORT=4980 E2E_PORT=4979 MI_BROWSER_POOL=1 sh tools/e2e-lock.sh npx tsx tools/scenelab/courier-readability.ts webgl2 --motion
# repeat with webgpu
```

Raw captures/metrics: `test-results/s121-courierread/final-before`, `final-after`, `repro-{webgl2,webgpu}-motion`, `controls`, `menu-control`. Additional production hold/retreat probes are retained under `production*` and `west-*`; they did not establish a 40+ production surround, so no full production-play signoff is claimed.

## Handoff

**Perf pending:** orchestrator measures native L4 LOW against 11 ms p95. This patch adds a bounded six-ID selection scan and adjusts existing fragment arithmetic; it adds no full-scene pass. No measured frame-time claim is made. Long production-route/transition review remains outside the demonstrated isolated captures. Work is wrapped at the orchestrator's explicit request; no deploy, push or main movement.
