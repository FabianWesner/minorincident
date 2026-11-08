# L9 long dark drive

Base: `0ad5a72b` · 2026-11-08 · implementation complete, performance qualification pending

## Changes

The ordinary objective-bearing drive crosses the open z=0 sightline between the three decorated routes. Existing flare, wreck, and verge-fire lines belong to those routes, so the direct crossing missed much of their content.

- `f780b141`: warm flare guidance every 17 m and small alternating brush fires every 68 m along the open crossing. Reuses the existing instanced emitters, light field, flame/smoke pools, and assets. Adds no solid props or colliders.
- `0cfe25ab`: quiet-interval patrols use two staggered rows of three runners and an eight-second minimum interval. Existing population caps, whole-silhouette offscreen admission, minimum distance, navigation clearance, chunk residency, persistent identities, and avoidable ramming remain in charge.
- QA tooling records projected content, actual ram contacts/knockdowns/permanent kills, and frame/render counters through the existing real keyboard/mouse driver. Screenshot pauses explicitly separate frame intervals; captures default to 45-second spacing.

Only `src/render/NightAccents.ts` and `src/sim/missions/LevelNineEncounters.ts` change runtime behavior. Route geometry, vehicle tuning, recovery rules, bridge/crash/crawl, and other levels are unchanged. There are no new assets, dependencies, or material/shader paths.

## Matched content results

All eight runs finish L9 and hand over to L10. Each cell uses real keyboard/mouse input, the female L9 progressed preset, headless native Metal WebGL2, 1280×720, and identical physical steering waypoints. Courier god mode is enabled; APC durability and ramming are live. The logged map assist bends around existing field bushes, adding 2.8 m to the 1,020 m objective-bearing comparison path. It does not write positions or skip objectives.

Values below are **before → after**:

| Quality / zoom | Drive seconds | Empty seconds | Longest empty stretch | Ram knockdowns | Visible encounter bouts |
| --- | ---: | ---: | ---: | ---: | ---: |
| Low / 1 | 95.7 → 86.4 | 54.9 → 7.9 | 10.3 → 3.4 | 15 → 40 | 9 → 11 |
| Low / 1.5 | 86.6 → 113.9 | 31.4 → 3.2 | 6.1 → 1.7 | 16 → 37 | 11 → 14 |
| High / 1 | 85.7 → 89.5 | 51.2 → 11.0 | 9.9 → 5.1 | 14 → 42 | 10 → 13 |
| High / 1.5 | 87.5 → 86.8 | 29.2 → 0.9 | 6.0 → 0.9 | 13 → 39 | 13 → 14 |

HUD kills and permanent vehicle kills remain **zero in both builds**. Rams knock infected down under the existing recovery rules; the mission HUD credits courier-source kills. The change supplies more visible/reactive ram encounters without changing those semantics.

The longer low/1.5 run stays in the table. Its trace spends extra time turning near x=373–375 m, z=9–12 m; the opened 91-second capture shows the APC facing away from the objective. An unchanged small bush is nearby at (371.39, 12.92), but the capture alone does not establish a collision with it. High/1 also wanders off the common line near the existing pickup. These are physical driver runs, not fixed-speed replays; route length and speed tuning are unchanged.

### Measurement contract

The observer samples every 0.5 seconds while the drive objective is active. “Empty” means no submitted on-screen living infected, non-stud practical, fire, or vehicle/building/kit landmark projected into the central frame. The APC, minimap dots, headlights, insects, bare terrain, and downed bodies do not count. Practical/landmark projections also require visibility and a 35 m distance cap. This is a sampled geometric estimate checked against opened captures, not pixel classification. An encounter bout begins when at least one living infected becomes visible after none were visible; it need not be a distinct group.

[Matched summaries and served-bundle identities](../../../test-results/r10-l9/matrix.json) · [Runtime scope and common route](../../../test-results/r10-l9/scope-and-route.json)

## Opened visual evidence

[Single comparison sheet](../../../test-results/r10-l9/before-after.jpg), 274 KB. Every source capture used in it was opened, and the assembled sheet was opened again.

- Initial low/1, about 30 and 40 seconds: baseline central frames contain the APC, headlights, insects, and bare terrain. Afterward a flare casts a warm pool; the later frame shows the ram aftermath, another flare, and a brush fire.
- Matched low/1 at 45 seconds: a warm flare/pool is visible on the left, with blood impacts and 770/1000 armor. Matched high/1 shows warm points on both verges; the baseline high/1 frame has bare central ground and only a faint warm glow at the top edge.
- Matched low/1.5 at 45–46 seconds: the baseline already shows infected, a verge fire, and a water tower at the edge. The changed frame adds closer flares around a visible pursuer; armor is 700/1000. Wider views already included some decorated-lane content.
- Matched high/1.5 at 45 seconds: both builds show an existing encounter. The changed frame has a larger ram aftermath and blood trail, a flare close behind the APC, and the existing verge fire/pursuer farther away; armor is 710/1000 versus 890/1000 before.
- The low/1.5 recovery frame at 91 seconds shows nearby infected, flares and two fires while the APC turns away from the objective. Dark terrain remains between the light pools.

[Detailed capture descriptions, exploratory summaries and exclusions](../../../test-results/r10-l9/reviewed-evidence.json)

## Checks and performance

| Check | Result |
| --- | --- |
| Typecheck / full lint | Pass, including final QA-tool changes |
| Unit suite / E31 verification | 107 tests in 27 files pass; registry stays at 150/150; `npm run verify -- E31` exits 0 |
| L9 native acceptance (`--skip-browser`) | All low/high completion, stationary, fixture and checkpoint runs complete; zero current failing rows; eight current incomplete rows remain as on the base |
| Scoped L9 threat audit | Both policies complete, zero L9 passive flags; overall exit 1 is `PARTIAL_LEVEL_SELECTION`, so this is scoped evidence rather than a full campaign gate |
| Full threat sweep | Exceeded the 600-second cap under concurrent host load; not a pass |
| Scene gate | 48 rows pass; last two waiting for browser admission |
| Cold load ≤6 s | Pending exclusive quiet measurement |
| No new gameplay frame >66 ms | Pending exclusive quiet comparison |

Acceptance retains a **historical stale FAIL for L9-03**, whose current status is NOT CHECKED. L9-08 currently passes; the other eight current rows require fresh browser/manual evidence. Native completion is not represented as full acceptance signoff. [Compact check receipt](../../../test-results/r10-l9/checks.json)

The shared content matrix cannot qualify frame budgets: both builds stall while the host runs concurrent jobs. Baseline maxima reach 0.75–5.03 seconds; changed maxima reach 0.40–2.72 seconds. High/1 has more >66 ms frames after the change despite a lower maximum, so a clean timing pass is not inferred from these runs.

Observed changed-build peaks are 88–93 draws / 108–111k triangles on low, and 105–114 draws / 182–198k triangles on high, below E31's 300/600 draws and 500k/1.5M triangle ceilings. Population caps are unchanged. The page-reported heap figure is constant throughout each run and differs between shared browser contexts; it is not a reliable collected-heap budget proof. [Early shader-build diagnostic](../../../test-results/r10-l9/after-guard-build-summary.json) records 15 Alpha node builds in ticks 321–461 of an exploratory run; it does not establish a new regression or a clean compile gate.

## Reproduction and retention

Build with `MI_BUILD_CACHE=off npm run build:qa`. Serve the base and changed builds on separate preview origins. The recorded base bundle is `index-BoRx-SN5.js`; the changed bundle is `index-AXN2AXqb.js`. Run one cell with:

```sh
L9_DRIVE_ORIGIN=http://127.0.0.1:4843 sh tools/e2e-lock.sh node --import tsx tools/qa/r10-l9-drive.ts candidate low 1
```

Use `tools/perf/quiet-run.sh` for timing, with `PLAYTEST_SHOT_SECONDS=9999` and the same input plan. The runner's `pair` mode accepts `L9_BEFORE_ORIGIN` and `L9_AFTER_ORIGIN` and serializes both builds inside one reservation. Shared runs are content/completion diagnostics.

Reviewed raw captures, browser/CPU profiles, telemetry, redundant sheets and obsolete receipts were removed for disk pressure. The linked compact receipts and one comparison sheet remain. The [temporary baseline runtime](../../../test-results/r10-l9/before-dist/index.html) shares unchanged asset files with the current build until paired checks finish. No push or deployment.
