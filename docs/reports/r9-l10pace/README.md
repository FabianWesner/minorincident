# r9-l10pace — L10 overland walk and corridor pacing (Opus)

Base `29dbfed0`, lane `lane/r9-l10pace`. 2026-11-08 07:52–10:20 CET. No deploy or push. Specs and acceptance targets unchanged; no other level touched.

Finding (vqa58, verbatim): "L10 — Boring, also in batch 57: minutes of empty dark grass on the overland walk and the corridor."

## What was actually empty (measured, real input)

A real-input playtest (`tools/playtest`, WASD + mouse, god mode so deaths do not reset the route, low WebGL2, zoom 1) now logs a 1 Hz route trace (`PLAYTEST_ROUTE_TRACE=1`: position plus drawn living infected on screen). `tools/qa/r9-l10pace-empty.ts` replays a trace against the layout + decor and counts a second as **empty** when the follow-camera frame holds no living infected, no solid ≥ 1.4 m (building, vehicle, tent, tower, stack; fences/low debris excluded) and no fire. The zoom-1 frame was measured from a real capture (~24 m wide in R1–R5, ~17 m in R6/R7).

The cause is the route, not the art: the objective marker points straight at the next checkpoint, so the courier crosses open fields **75–100 m from the winding road**, where all story dressing sits. The measured crossings: R2 south round the blocked street (z −10), R3 south of the blocked yard (z −26…−43), R4 south of the blocked checkpoint (z −50…−66), the R5 forecourt, and in R6 the southern forecourts round the blocked road at x 3313 (z −90…−100) — the corridor hordes on the north road are never seen. Before, at zoom 1:

| Before (low z1, 1,062 s of trace) | Value |
| --- | --- |
| Longest stretch with nothing in frame | **181 s** in the corridor (x 2976→3681), 72 s on the R7 approach, 57 s in R4 |
| Longest stretch with no infected and nothing in frame | **36 s** (R6 southern forecourt) |
| Empty seconds, whole route | 562 of 1,062 |
| Corridor: seconds with an infected on screen | 22 of 176 (12 %) |

## Changes (commits)

| Commit | Change |
| --- | --- |
| `af267560` | qa: opt-in playtest route trace and the empty-stretch timer. |
| `c0e57386`, `1533f510`, `1f4530db` | **Crossing scenes** (`src/levels/L10/crossingStories.ts`, appended in `districtDecor` after the unchanged roadside belt): along the measured lines of R2–R7, one small scene every 30–40 m, alternating sides 6–9.5 m off the line: burned cars that left the road and still burn, abandoned camps with a fire and lantern, overrun army stops (tank/truck, blown sandbags, fire), depot spills (container stack, burning drums), fallen quarantine posts (iso tent, generator work light, ambulance), burned evac buses in the corridor. 89 scenes, 266 pieces, 83 lit. Only existing L10 assets and decay variants (no new GLB/variant, no new draw batch type). Fires/lanterns reuse `NightAccents` field lights. |
| `e81631c9` | Scenes keep out of the x band of **lane-shifted** groups (field-crossing patrols and corridor groups spawn at the courier's z, `laneOffsets`). |
| `b9b12332`, `1bff7081`, `8dee63c3` | Tall pieces are **physics-only** statics (stop the courier, no AI nav wall — the same rule as the authored L10 field dressing); small pieces render-only. `crossingScenesBlock` (on) switches the blocking off for a render-only fallback. See qa:accept below. |
| `da37e938` | **Corridor patrols arrive as small packs** (3 high / 2 low) instead of one runner every 12 s, at the same safe off-camera spot, each member under the unchanged regional cap. |
| `841c9248`, `0a0068dc`, `433fc4d9` | Scene Lab catalog `tests/scenes/catalog/l10-crossing-{r2,r3,r4,r5,r6,r6s,r7}.json`. |
| `d8b64d52` | Checks folded into the existing decor test (case budget 150/150): deterministic, belt unchanged, ≥ 3.2 m off the walked line, ≥ 8 m off roads/detours/pursuit shortcut, 4 m off encounter slots (lane groups: their x band), > 100 m from the console, no overlap with any existing solid, physics-only colliders for solids, on the ground. |

Clearances also keep 8 m from anchors/medkits; fires sit > 11.5 m from road centre lines and 14.5 m from encounter stations (the `NightAccents` rule).

## After (same measurement)

| Run | Longest empty (no infected, nothing in frame) | Longest with nothing in frame | Corridor: infected on screen |
| --- | --- | --- | --- |
| Before, low z1 | 36 s (R6) | 181 s (R6) | 22 / 176 s (12 %) |
| Same before-trace replayed with the scenes | 18 s | 72 s (R7 last approach) — R6 14 s | — |
| After real run, scenes only, low z1 (870 s) | 33 s, inside the last 100 m to the console; R1–R6 ≤ 14 s | 41 s (same R7 stretch); corridor 17 s | 16 / 149 s (11 %) |
| After real run from the corridor checkpoint, scenes + packs, low z1 | 18 s (R7, arena approach); R6 ≤ 15 s | 51 s (R7 x 3788→3989) | **33 / 132 s (25 %)** |
| Same, high WebGPU z1.5 | 15 s | 51 s (R7) | **41 / 113 s (36 %)** |

Empty seconds over the whole after route: 296 of 870 (was 562 of 1,062).

## Captures (opened)

Committed sheet: [before-after.jpg](before-after.jpg) (low, zoom 1.5, Scene Lab, same spot and camera; full sets in `test-results/r9-l10pace/sheet{,-low,-z15,-z15-low}.jpg`, both tiers, both zooms, 7 spots, 56 captures, all `pass`).

- **R2** camp at the field edge (tent, chairs, lit crates) beside the south detour; **R3** burned police car off the walked line; **R4** stalled tank with a lit sandbag stop; **R5** fallen quarantine post (iso tent, generator lantern, ambulance); **R6** burned evac bus and luggage on the forecourt; **R6 south** army truck stop with its light; **R7** truck stop north of the service road. Before: empty dark grass/blue void at every spot.
- Nothing floats or sinks; pieces stand clear of the courier's line; no piece covers the courier at zoom 1 or 1.5, low or high. In single-frame Scene Lab shots only the fire **light pools** show; the flame columns appear in real play (a burning campfire in the R3 real frame, `test-results/r9-l10pace/after-real-1.jpg`).
- Real-input frames (`after-real-1.jpg`, `after-real-corridor.jpg`): the R3 container/drum spill and a campfire in frame during a fight; in the corridor a dog pack attacking on the southern forecourt and a tent roof in frame.

## Checks

| Check | Result |
| --- | --- |
| `npx tsc --noEmit` | PASS |
| `npm run lint` | PASS (exit 0) |
| `npm test` (remote) | 150/150 cases, 43/45 files. 105 pass, **1 fail: `tests/tools/gate-tools.test.ts` browser-pool test** — remote: `git rev-parse HEAD` has no refs on the runner; local: 30 s timeout under load 30+. Not touched by this lane (no browser-pool/gate-tools change); needs a re-run on a quiet Mac/main. |
| `node --import tsx/esm tools/qa/threat-audit.ts --levels L10` (remote) | **0 L10 flags**; only the global `PARTIAL_LEVEL_SELECTION`. Skilled complete, passive tick budget; corridor skilled 19.8/min (21.4 before the pack change), complex approach 5.5/min. Run on `b9b12332` (same collider/encounter code as the head). |
| `npm run qa:accept -- --level L10 --tier both --skip-browser` | Exit 1: "1 fresh failing rows; 10 incomplete rows" — the failing row is **L10-03, with exactly the base's failing clauses** (below). Fixtures 16 clauses / checkpoints 27 clauses per tier, 0 errors, control identical; complete policies finish. Receipt copies: `test-results/r9-l10pace/accept-physonly-L10.json` (final physics-only code), `accept-base-low-L10.json` (base). The rewritten tracked receipts were restored, not committed. |
| `npm run scene:gate` | **50/50 rows pass** on the head code (`test-results/scene-gate-rerun2`, 8.5 min). An earlier run under load 30+ had 48/50 with two "Execution context was destroyed" harness errors (`inf-looks@low`, `dog-pet-trot@low-z1.5`, not L10). |

**qa:accept, L10-03 regression found and fixed in-lane:** with the tall pieces as ordinary nav solids, high/stationary admitted only **15 of 32** of the corridor-breach group (cap filled while the crowd pathed round the field pieces). Controlled high/stationary runs: base `29dbfed0` 32/32 (peak 106); nav-solid scenes 15 (also with the R6 scenes removed, so the R2–R5 pieces cause it); render-only 32/32; physics-only (final) **32/32, peak 108, identical corridor ticks 12,903**.

L10-03 clauses that fail on the final code **and on the base `29dbfed0`** (measured the same day): low/stationary `military-column regular group size` = 2 (the committed main receipt's 13 is stale, from an older source), and the `same-tick regional count` (`fresh:false`) / `residential dogs follow actual handgun pickup` (0 premature ticks) clauses on stale `fix72-c` composition receipts. L10-04/L10-11 historical FAIL stay NOT CHECKED as on main. All corridor/complex group sizes pass on both tiers.

## Performance

**Perf pending (quiet window).** All browser runs shared the Mac with other lanes at load 11–38, so every run — before and after — logged 0.5–3.5 s frames; they cannot be attributed. Static facts: no new asset, decay variant or material; 266 instanced pieces over 3.3 km (a few per frame); +34 accent fires/lanterns (field-light pools are capacity-limited, flames are capped); one-time decor generation 20–48 ms at level load (cached). Needs the orchestrator's quiet-window L10 A/B: max frame, cold load ≤ 6 s, R3/R6 crossing p95.

## Verdicts and what is left

- **Glitches:** none seen in the scenes. Two `stuck-navigating` driver issues during the Mega fight ("Kill the Mega Alpha", no marker) are the known driver/Mega-marker behaviour (pre-uat-l10), not this lane.
- **Boring:** the overland crossings and corridor now pass a lit story scene every ~7 s of running and the corridor shows infected on screen 2–3× as often. The R7 last ~100 m before the console (and the run's southern approach x 3790–3990) is still plain at zoom 1: the scenes stop 100 m from the console to leave the arena and finale calibration alone. Scenes are generated, so they repeat in kind (camp / wreck / army stop); hand-authored hero moments on the R4 and R6 crossings would lift it further.
- **Stunning:** not yet. Night fires and silhouettes now punctuate the walk, but the ground itself is still flat dark grass between scenes.
- **Open:** perf in a quiet window; the gate-tools test on main; a PO look at whether physics-only wrecks (the courier collides, infected pass through) read well — the authored L10 field dressing already behaves this way.
