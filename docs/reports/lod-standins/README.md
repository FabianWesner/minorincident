# L10 LOD stand-ins

Two delays caused stand-ins. Accelerated Scene Lab consumed the two-second
walking prefetch horizon inside one browser task, before downloads/decodes/swaps
could finish. Production also held warmed streamed swaps until four seconds of
play, so a correctly prefetched mesh still missed its selected band. Test mode
bypassed that hold: ordinary test-API real-time walks alone falsely looked clean.

Scene Lab now awaits the previous tick's pending district LOD/terrain work before
advancing another tick, using `DistrictView.ready()`. The renderer removes L10's
four-second startup hold from required tier swaps. Other levels retain their
startup admission. Shader warm-up and the load
gate remain; background route preparation retains its separate five-second
admission delay. LOD selection and the existing two-second prefetch horizon are
unchanged. A new production-mode unit test requires first-frame swap admission
through the existing gate, without advancing a startup timer.

The production-paced native check also exposed cold WebGL programs in hidden
movement/mission meshes: CPU profiling attributes 381.8 ms to program-link checks,
with `pal_picketWhite:mesh_0` and `keep_moveMarker:Mesh` newly built on approach.
L10 now uses the existing full hidden-object warm-up behind its loading card,
as earlier levels already do. Preparing all district tiers did not fix this and
that experiment was reverted. Neither residency limits nor the 50 ms desktop
streaming-hitch budget changed. The new native regression samples every RAF
and asserts that limit as well as zero stand-ins and the E18 counters/heap caps.

A cold accelerated WebGL baseline reproduces 45–101 high seam stand-in frames
and 45–73 low frames at zooms 1/1.5. The completed production-paced baseline
records 96/97 high console-approach tank frames and 28/29 high original-seam
lamp frames (WebGL/WebGPU); low stays zero. Those eight walks retain the 250 bad-frame counts and first offending draws in `evidence/production-pacing-before.json`. The original charge-radius
rows happened to pass in this cold baseline; their console race remains covered
by the charge fixture and the new console boundary walk. No gate, budget or spec
changed. Scene Lab never settles, rerenders or removes a bad measured frame.

The existing `lod-pop-probe.ts --walk` uses accelerated 20-tick steps. Its new
`--realtime` mode resumes the game clock, reads all drawn placement stand-ins
every browser frame, records movement/reversal, actual backend/quality/zoom and
start/mid/end game-camera captures. `--production-pacing` retains the inspection
API but removes the view's test flag, exercising production swap admission rather
than the test-mode bypass. Final walking evidence uses that option. Only initial
camera placement is teleported;
120 setup ticks and screenshot readiness settle that initial camera before the
measured walk. This is a walking/streaming check, not a first-playable-spawn test.

The missing-prefetch control disables velocity only on the existing district
LOD updater. On both qualities and backends it still records **two bad frames**,
including `bld.cure-security-post` and `veh.police-sedan` LOD1→LOD2. This proves
that awaiting existing requests does not hide a late first-visible request.

Two catalog fixtures are added to `scene:matrix`: `l10-lod-complex-seam` walks
forward/reverse across the production R6/R7 seam at x=3697;
`l10-lod-console-approach` walks across the production console's near/hero band
while retaining the console/platform in the camera. Both require actual movement
and zero stand-ins. The longer existing charge-radius and R1/R2 seam walks stay
in the matrix. The initial longer console fixture crossed empty asphalt and
failed the unchanged canvas-content gate; its final camera-visible boundary walk
covers the intended tier promotion without changing that gate.

## Reproduction

Run `npm run build` first. All browser commands are headless Metal on the Mac;
all unit/sim/levels work runs on Hetzner, at most four Vitest workers. Matrix
commands reserve two browser units and use at most two sessions.

```sh
SCENE_SERVER=preview SCENE_PORT=34973 npm run scene:matrix -- --jobs 2 --out test-results/lod-standins/matrix-webgpu
SCENE_SERVER=preview SCENE_PORT=34976 npm run scene:matrix -- --jobs 2 --backend webgl2 --out test-results/lod-standins/matrix-webgl2
SCENE_SERVER=preview SCENE_PORT=34967 E2E_UNITS=1 sh tools/e2e-lock.sh npx tsx tools/scenelab/catalog.ts --matrix --jobs 1 --backend webgl2 --throttle 4 --filter 'l10-region-seam,l10-lod-*,l10-cure-install-defend,qa-l10-charge-radius' --out test-results/lod-standins/throttle-webgl2
SCENE_SERVER=preview SCENE_PORT=34965 E2E_UNITS=1 sh tools/e2e-lock.sh npx tsx tools/qa/lod-standins-negative.ts webgl2
SCENE_SERVER=preview SCENE_PORT=34968 E2E_UNITS=1 sh tools/e2e-lock.sh npx tsx tools/qa/lod-pop-probe.ts --realtime --production-pacing --checkpoint cure-complex --from 3660,-25 --to 3730 --reverse --seconds 30 --zoom 0.5 --tier low --backend webgpu
```

For the console probe use `--checkpoint cure-disperse-ready --from 3960,-27
--to 3997 --reverse --seconds 20`; for the original seam use
`--checkpoint cure-residential --from 737,25 --to 817 --reverse --seconds 30`.
Final production-paced real-time coverage uses both qualities/backends and zooms 1/0.5 for the original seam, R6/R7 seam and console approach. Native
performance uses `tools/perf/quiet-run.sh` and one worker, with a 1,150 s process
group bound per batch; locks are released between batches.

## Results

Final full unit suite: **1,461 passed, 7 existing skipped**, including the new
production swap-admission regression. Focused renderer/catalog checks: **16/16**.
Typecheck, lint and the fresh production build pass.

The broad Hetzner unit/sim/levels sweep itself exits 1: **2,778 passed, 8 failed,
9 skipped**. Four shared-host CPU budgets and the L10 arrival timeout pass with
both runner slots reserved (the 23-test isolated batch is green; high arrival
117.936 s). An intermediate probe TypeScript duplicate-property error is fixed
and the final full unit/static checks above pass. Two unchanged L3 cases still
fail when rerun alone: `L3-route.test.ts` misses the required positive-X/south
waypoint; `ally-combat-feel.test.ts` reports stillness 0.201449 against `<0.2`
(10 fighters, movement share 0.916808, zero offscreen shots). Their thresholds
and gameplay are unchanged. The broad sweep is not represented as green.
Raw sweep/recheck logs and the L3 metric record are retained in `evidence/`.

Both complete matrices pass: **422/422 WebGPU and 422/422 WebGL2**. Across
their 528 L10 rows, stand-in frames are zero; peak view draws are 136 and peak
triangles are 277,203 high / 138,409 low (view counters exclude shadow passes).
The 4× CPU-throttled WebGL touched-scene matrix passes **30/30**.
These complete matrices ran after the barrier/admission fixes. The subsequent
full-warm-up change is guarded by the production `L10` scenario; Scene Lab loads
`scene-lab`, so its exercised path is unchanged. Production warm-up is covered
separately by the fresh game walks and native checks below.

Production-paced real-time walks pass **24/24**, with **38,424 sampled frames and
zero stand-ins**, covering the original seam, R6/R7 seam and console approach on
both backends, qualities and zooms 1/0.5. Every record verifies actual backend,
quality, zoom, forward arrival and reversal. A fresh negative-control repeat
still detects two bad frames in each of the four backend/quality combinations.

The exact E32 CPU selection passes **165 tests** on a timing-isolated Hetzner
runner; the functional browser selection passes **57/57** on the Mac. These are
component results, not an aggregate `npm run verify -- E32` success.

Game-camera contact sheets were opened and reviewed at both qualities, zooms
and backends. Road markings and courier contact remain continuous across the
seams. The console's cyan centre and warm side panels remain readable; low
quality intentionally simplifies its detail. At the closest approach the
existing cutaway briefly leaves a dark console base, then restores it. The
R6/R7 road crop is sparse and is not a full district art review. See
[capture review](evidence/review.md) and [contact sheets](evidence/captures.md).

The new first-play native regression passes **8/8** after the full L10 warm-up:
high frame maxima are **5.6–9.2 ms**, below the unchanged 50 ms desktop-profile
limit; both profiles meet their p95, sim, draw, triangle, residency and heap caps.
One low WebGL zoom-1 run still records a **198.8 ms** white-mesh shader spike;
its frame p95 is 3.7 ms. The low/mobile profile has a p95 gate, not that desktop
maximum assertion. This observed spike is retained rather than omitted from the
records.

All **8/8** epilogue/heap cases pass six warmed R1↔R7 cycles per case. Maximum
heap is **237.56 MB high / 183.56 MB low**, and the worst warmed heap/geometry/
texture drift is **1.83% / 2.36%**, within 10%. Maximum epilogue frame p95 is
**8.7 / 6.5 ms** and sim p95 **0.60 / 0.50 ms**. The combined startup/heap quiet
reservation held its first slot for **745 s**, then released all slots. Corridor/
finale checks and the canonical verifier are still running under bounded batches.
