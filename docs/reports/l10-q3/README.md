# L10-Q3 sim regression

> Follow-up: [L10 Mega cruise correction](../l10-mega-speed/README.md) resolves the production R6 speed finding below: the unchanged audit now passes at 3.15 m/s on both tiers. The measurements in this Q3 report describe its original snapshot.

Scope: E32-AC01–16/27/28. Production gameplay and pacing are unchanged. Seed 32 is the sole full L10 completion seed; no battery. All heavy Vitest work runs through `tools/remote/run.sh` on Hetzner (at most four workers). Native browser checks use a fresh production build and private ports 34931–34933, headless Metal, one worker.

**AC signoff remains open:** the production R6 pressure audit fails E32-AC10 (6.3 m/s versus 3.15 m/s); E32-AC04 calibrated newbie 45–50 min timing is unverified. Both are reported below without pursuit/pacing changes.

## AC → tests

Each suffix retains its parent T-E32 ID and AC tag. A green sim test proves its stated fixture, not every visual/audio/performance subcheck of the AC.

| AC | T-E32 IDs and executable files | Coverage / remaining evidence |
| --- | --- | --- |
| E32-AC01 | `T-E32-01`, `01-data`: `tests/sim/missions/l10-progression.test.ts`, `tests/unit/progression/cure.test.ts`; `04-complete`: `tests/levels/L10.test.ts` | Graph prerequisites, nearby charge + dead boss, explicit release, epilogue/credits, completion once, no next level. |
| E32-AC02 | `T-E32-02`, new `02-minute-high/low`: `tests/unit/progression/cure.test.ts`, `tests/sim/levels/l10-regression.test.ts`; `T-E31-15-handover` in `tests/sim/l9-handover.test.ts` | Axe-only standalone/history enforcement, retained abilities, no active driveable vehicle, all 3,600 opening ticks at both tiers; existing campaign crash/corgi payload coverage. |
| E32-AC03 | `T-E32-03-D1-D2`, `03-D3`, `17-D4`, `03-D2-detours`: `tests/unit/levels/l10-{district,campus-corridor,arena}.test.ts`, `tests/sim/levels/l10-{district,campus-corridor,district-detours,arena}.test.ts` | Seven connected low regions, route ≈4,300 m, pickup anchors, low buildings, nav/detours, bounded chunks. Existing Q1 regional captures cover all seven. |
| E32-AC04 | New `T-E32-04-complete`: `tests/levels/L10.test.ts`, `tools/sim-runner/l10.ts` | Full R1→credits ordinary-input run and exclusive regional activity telemetry. Calibrated newbie 45–50 min remains a separate unresolved subcheck; no pacing tuning or idle padding. |
| E32-AC05 | `T-E32-05`, `05-ammo`, `15/16/27-E2`, new `02-minute-high/low`: `tests/sim/missions/l10-{progression,cure}.test.ts`, `tests/unit/progression/cure.test.ts`, `tests/sim/levels/l10-regression.test.ts` | Grant/checkpoint transaction, no inventory-driven spawn, historical locks, JSON reload, ≥10 real rocket attack events, bottomless cooldowns. |
| E32-AC06 | `T-E32-06-E2-high/low`, `06-D3`, `21-*`: `tests/sim/levels/l10-{encounters,assault}.test.ts`, `tests/unit/levels/l10-campus-corridor.test.ts` | All depth curves, special counts unchanged by low quality, inventory change spawns zero, global caps including finale boss. |
| E32-AC07 | `T-E32-07a/b/c`, new `07-los`: `tests/sim/ai/l10-dogs.test.ts`; `07-coats`: `tests/unit/levels/l10-alpha-contracts.test.ts`; dog asset validation | Non-corgi asset, speed/reach/windup/damage/cooldown, wall acquisition, ordinary stagger/death. Q1 dog fixtures supply silhouettes/dodge. |
| E32-AC08 | `T-E32-08a/b`: `tests/sim/ai/l10-dogs.test.ts`; `23-exclusions-S8`: `tests/sim/missions/l10-cure-front.test.ts`; story protection suite | Historical corgi infect/turn/spawn/target negatives, player/healthy humans/animals/corgi survive release on both tiers; post-release guard and epilogue coverage reused. |
| E32-AC09 | `T-E32-09a`, `09-count-high/low`, `09-queue`, `09-specials`, `06-E2-high/low`: `tests/unit/levels/l10-alpha-contracts.test.ts`, `tests/sim/ai/l10-alpha-contracts.test.ts`, `tests/sim/levels/l10-encounters.test.ts`; shared `tests/sim/ai/alpha-{tank,physical,support}.test.ts` | R3–R7 regular Alpha counts, shared resistance/specials, conventional kills, distinct scales/bars. Q1 scale/silhouette catalog supplies visuals. |
| E32-AC10 | `T-E32-10a…k`, `10-E3/E3b`; `10-production-pressure` audit: `tests/sim/ai/mega-pursuit.test.ts`, `tests/sim/levels/l10-assault.test.ts` | Introduction ≤120 s, normal strip cruise, global awareness/no lure, obstacles/coarse route/handoff, one ID, snapshots/cooldowns, early death remains dead. **Production R6 catch-up fails the cruise contract**, reproduced in `evidence/pressure-audit.ts/json`; generic strip fixtures omit that authored branch. |
| E32-AC11 | `T-E32-11-*`: `tests/sim/ai/mega-moves.test.ts` | Windup/active/range/damage/cooldown/recovery, no overlap, grab release, safe dodge, walls. Q1 move/dodge/wall game-camera fixtures reused. |
| E32-AC12 | `T-E32-12a…d`, `12-projectile`, `12-pressure`, `12-crowd-impact`: `tests/sim/ai/mega-moves.test.ts` | Nine/tenth direct rockets, duplicate ledger, conventional floor, splash, stagger duration/shared cooldown, real projectile delivery. |
| E32-AC13 | `T-E32-13-schedule`, `13-audio`: `tests/sim/ai/mega-audio.test.ts`, `tests/unit/audio/mega-presentation.test.ts`; `tests/sim/performance/mega-audio.test.ts`, `tests/e2e/audio/mega.spec.ts` | Seeded sim-time intervals, distance gains, steps, death/checkpoint, telegraph routing/captions. Existing live offline-RMS/voice-priority browser cases pass in the final verifier; remaining manual/focus/device checks retain Q5/Q6 ownership. |
| E32-AC14 | `T-E32-14-ring`: `tests/unit/audio/mega-presentation.test.ts`; `tests/e2e/audio/mega.spec.ts`; `l10-q1-audio-ring-*` catalog | No coordinate/bearing/dot leak, distance bands, centered ring/death removal. Existing desktop/phone ring/marker browser assertions pass in the verifier; whole-device vision remains Q5/Q6 ownership. |
| E32-AC15 | `T-E32-15-D3`, `15-terminal`, `15-recording`, `15/16/27-E2`: `tests/unit/levels/l10-campus-corridor.test.ts`, `tests/sim/ai/mega-audio.test.ts`, `tests/unit/audio/mega-presentation.test.ts`, `tests/sim/missions/l10-cure.test.ts` | Campus kit/nav/terminal, all research subtitle facts, stock instrumental recording, interaction ordering; Q1 research crop supplies visuals. |
| E32-AC16 | `T-E32-15/16/27-E2`, `16-before-exit`, new `16-speed`: `tests/sim/missions/l10-cure.test.ts`; checkpoint tests and `tests/e2e/levels/l10-cure.spec.ts` | Unique pickup, no weapon slot or run penalty, before/after pickup and installation death/save. Q3 carry scene reuses real authored carried checkpoint/attachment. |
| E32-AC17 | `T-E32-17-D4`: `tests/unit/levels/l10-arena.test.ts`, `tests/sim/levels/l10-arena.test.ts`; `20/22`: `tests/sim/missions/l10-finale.test.ts` | Arena kits/anchors, ≤20 m mounted gun, connected ≤25 m dodge lanes; installation captures ready before activation. Existing `l10-cure-install-defend` and `qa-l10-epilogue` catalog scenes supply game-camera evidence. |
| E32-AC18 | `T-E32-18a`, `18f…i`, `18k/l`: `tests/unit/combat/minigun.test.ts`, `tests/sim/combat/mounted-gun.test.ts` | Spin/cadence 20 rounds/s, ordinary/Alpha TTK, mount/leave/deck/rack inputs, rocket readiness, conventional Mega floor. Q4 adds missing AC tags so the verifier selects the existing tests. Browser/touch coverage remains Q5 ownership. |
| E32-AC19 | `T-E32-19-heat/cooling/tapping/snapshot/remount`: `tests/unit/combat/minigun.test.ts`, `tests/sim/combat/mounted-gun.test.ts` | Exact heat/cooling/delay/unlock contracts, tapping, overheat lock, remount and checkpoint persistence. Q4 corrects heat test IDs from 18 to 19 and adds AC tags; existing assertions retained. |
| E32-AC20 | `T-E32-20/22`, `20/27`, `20`: `tests/sim/missions/l10-finale.test.ts`; `tests/e2e/levels/l10-finale.spec.ts` | Exactly 3,600 ticks, 25.000/25.001 m inclusive boundary, retained pause/resume, clock-free state queries, actual death and saved heat/boss/enemy/cooldowns, fresh live charge resume. |
| E32-AC21 | `T-E32-21-E3-high/low/overlap`, `21-E3b`: `tests/sim/levels/l10-assault.test.ts`, `tests/sim/levels/l10-arrival.test.ts`; `10-production-pressure-high/low`: `tests/sim/levels/l10-mega-cruise.test.ts` | Mixed assault caps, persistent boss ID, early kill/no replacement; production R6→R7 late arrival and full-charge living-boss block. Per accepted Mega-speed decision, 0.7× cruise wins over the 10–40 s target; no pacing changes in Q4. |
| E32-AC22 | `T-E32-22` (all eight truth-table combinations), `20/22`, `20`: `tests/sim/missions/l10-finale.test.ts` | Installed AND 60 s AND dead boss, console presence, fresh release edge, once-only signal, living boss after 60 s, held input after death, early kill remains dead through retry. Fixture predicate injection is confined to isolated tests; campaign test uses ordinary inputs. |
| E32-AC23 | `T-E32-23-S8/exclusions/front/flag`: `tests/sim/missions/l10-cure-front.test.ts`; `tests/e2e/levels/l10-epilogue.spec.ts` | Expanding authoritative front, every infected species/flag (including zoo), instant permanent death without conversion, healthy/player/corgi exclusions, tier independence. Existing mist/final-release catalog scenes supply fan/mist visuals. |
| E32-AC24 | `T-E32-24/25-once-S8`, `24-unloaded/zoo/fresh-clock-S8`: `tests/sim/missions/l10-cure-front.test.ts` | Serialized unloaded deaths, five revisits, no all-region load/resurrection/repeated release, zoo outcome, fresh-clock reload. |
| E32-AC25 | `T-E32-25/26-S9`, `25-cast-S9`: `tests/sim/missions/l10-epilogue.test.ts`; `24/25-once-S8`, `25-pending-S8`: `tests/sim/missions/l10-cure-front.test.ts` | 150 s of movement, bounded approaching deaths and survivors on both tiers, no combat/spawner/grab continuation or healthy harm; existing epilogue scene supplies reversal captures. |
| E32-AC26 | `T-E32-25/26-S9`, `26-resume-S9`: `tests/sim/missions/l10-epilogue.test.ts`; `tests/e2e/levels/l10-epilogue.spec.ts` | Last 36 s eased pull with walk/run input, title then credits, exactly one completion, fresh-world mid-pull/title/credits/done saves without combat/victory replay. |
| E32-AC27 | `T-E32-27*`, `15/16/27-E2`, `16/27`: `tests/sim/missions/l10-{progression,cure,finale}.test.ts`; district route tests and crossing handover tests | Every region/arsenal, before/after canister and installation, actual death, saved death, fresh live/last-retry reload, chunks/boss/ledger/cooldowns/mission and crash payload. |
| E32-AC28 | New `T-E32-28-cure-high/low`, `28-lods-high/low`: `tests/sim/levels/l10-regression.test.ts`, `tests/unit/render/l10-lod-prefetch.test.ts`; `28-D1-ground/D1/S4`, `27-chunks-high/low`: `tests/unit/levels/l10-district.test.ts`, `tests/sim/levels/l10-district.test.ts`, `tests/sim/world/chunk-residency.test.ts`, `tests/sim/missions/l10-progression.test.ts`; shared `tests/e2e/levels/l9-streaming.spec.ts` | Actual D-CURE 2 s predictive forward/reverse support, ≤25/9 chunks, ≤2 cm baked seams, five corpse/collected-pickup/boss revisits. Delayed render loads use shared streamer browser coverage; full L10 delayed-load/input audit remains Q5/Q6. |
| E32-AC32 | New `T-E32-32`: `tests/levels/L10-campaign.test.ts` | One continuous seed-1 L1→L10 save, ordinary bot inputs, campaign completion/save adapters only; rosters/abilities, L9 axe reset, L10 reacquisition/cure/boss/release/credits, once-only completion, whole-run release signal count (independent of bounded event-log eviction) and per-level time/deaths. Q4 evidence and timing limitations: [report](../l10-q4/README.md). |

## Changes

The shared sim runner previously sent L10 through a generic axe-only path follower with no checkpoint interaction or finale handling. It now runs the authored route, reacquires weapons through held interaction, aims/fires the acquired arsenal, charges/releases at the console and explores during the ending. It never teleports, injects loadouts, completes objectives or edits boss HP. Regional telemetry categories are exclusive and sum to elapsed seconds; metres separately include movement during combat. This is a QA policy, not a calibrated human difficulty model.

New regression fixtures cover every opening tick with historical weapon flags; D-CURE predictive direction reversals and five ID/state revisits; dog wall acquisition/stagger/death; carried cure speed/racks. Existing systems tests remain in place. Scene catalog adds `l10-q3-opening`, `l10-q3-carry`, `l10-q3-seam` and includes them in `scene:matrix`.

The walking fixture exposed late LOD1 requests for the security post and police sedan: every original matrix row drew LOD2 stand-ins (77–225 frames). `DistrictView` now requests reachable near/hero tiers within the existing two-second travel horizon before frustum entry; `GameView` supplies on-foot velocity as well as vehicle velocity. Requests stay local to that horizon, low props keep LOD2, and tier selection/budgets are unchanged. Two off-screen registry tests prove early requests and absence of far/low-prop promotion.

Walking captures now sample frequently (30 ticks, thinned to 24 sheet cells), keeping browser asset tasks live within the two-second horizon; the older 240-tick batches starved asynchronous work for four sim seconds. Every tick still measures the unchanged zero-placeholder gate. A negative control with the same dense captures and zero on-foot prefetch velocity records **23 bad frames**, while the fixed high/low × all zoom × both backend rows record **zero**. This control guards against hiding the defect through capture scheduling.

The E32 verifier now uses one functional browser worker. Its former two-unit reservation stayed queued while another lane occupied two of the three slots, even as one-unit Scene Lab runs could proceed. The selected tests and all assertions remain the same; a tooling guard preserves one-worker admission.

## Evidence

Scene Lab: opening/carry **12/12 WebGL + 12/12 WebGPU**; walking seam **6/6 WebGL + 6/6 WebGPU**, high/low × zoom 0.5/1.0/1.5, after fresh `npm run build`. Logs are `test-results/l10-q3/scenes-{webgl,webgpu}/index.md`; retained compact sheets and gate indexes are in [evidence/](evidence). New focused coverage: **13/13 tests** on Hetzner (first-minute/seam, dog, cure), `test-results/l10-q3/coverage-final.json`. Typecheck/lint/build pass.

Full unit after the renderer fix: **1,453 passed, 7 existing skipped**; the subsequent verifier admission guard and prefetch cases pass in the focused tooling run on Hetzner; E32 consolidation: **149/149 selected tests pass**, including `tests/levels/L10.test.ts` and all selected L10 sim files, with both runner slots held for the timing phase. Full sim sweep: **1,034 passed / 3 CPU timing failures** (director 4.72 ms, high L10 assault 8.49 ms, NPC patrol 4.50 ms, all versus 4 ms); all three unchanged timing assertions pass in the isolated recheck (**3/3**). The full sweep itself exited 1 and is retained separately; no suite-level green result is invented.

Initial native R1–R4/seam timing: **8/8 passed**, high/low × zoom 1.0/0.5 × WebGL/WebGPU, one headless native Metal worker under quiet-run. The browser batch ran 10.7 min and released its reservation; the outer 1,100-second cancellation bound was not reached. Final native raw results, the initial quiet preflight conditions and final verifier log ([verify-run.txt](/Users/wesner/Workspace/mi-evidence-archive/docs/reports/l10-q3/evidence/perf/verify-run.txt)) are retained in [evidence/perf/](/Users/wesner/Workspace/mi-evidence-archive/docs/reports/l10-q3/evidence/perf).

Post-fix `npm run verify -- E32`: **158 selected Vitest tests + 57 browser tests passed** with remote sim and one browser worker. All **8/8 post-fix native timing checks pass**; the verifier exits 0. The final performance batch ran 10.7 min, released its quiet reservation and stayed within the 1,100-second outer bound. Final native counters replace the baseline in `evidence/perf/`; command exit codes are in `evidence/verify-checks.json`. Browser selection includes actual audio RMS/voice/HUD cases, cure/checkpoint/finale wiring and WebGPU smoke. The strict production-pressure diagnostic remains a reported AC10 failure outside that passing fixture selection.


| Final R1–R4/seam maxima | High | Low | E18 high / low cap |
| --- | ---: | ---: | --- |
| Frame p95 ms | 5.70 | 4.50 | 16.7 / 33.3 |
| Sim p95 ms | 1.00 | 0.90 | 4 / 6 |
| Draws | 169.00 | 163.00 | 600 / 300 |
| Triangles | 422112.00 | 44347.00 | 1,500,000 / 500,000 |
| Infected | 67.00 | 39.00 | 200 / 100 |
| Detailed chunks | 25.00 | 9.00 | 25 / 9 |
| Heap MB | 213.20 | 167.16 | 400 / 250 |

Full seed-32 complete run passed on Hetzner: **20:41.017 gameplay**, 0 deaths, 281 kills, 330 damage, peak 168 infected; all fifteen mission objectives completed through credits. Cure collected 9:54.017, installed 15:46.017, explicit release 18:11.017; playable epilogue 150 seconds, credits 17 seconds excluded. No pacing changes. The complete policy continuously walks/fights with immediate target awareness; it does **not** establish the calibrated newbie 45–50 min AC04 band. That subcheck remains unresolved, rather than treating the complete policy as a human timing measurement.

Regional gameplay timings (spatial envelopes; combat can include movement, so travel is time spent moving without firing). Interaction time totals 0.267 s; stationary idle time is zero. These are measured complete-policy times, compared with the authored defaults for context.

| Region | Gameplay min | Travel s | Combat s | Hold s | Epilogue s | PO default min |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| R1 `crash-outskirts` | 1.10 | 65.28 | 0.73 | 0.00 | 0.00 | 3 |
| R2 `residential-fringe` | 2.01 | 94.97 | 25.85 | 0.00 | 0.00 | 6 |
| R3 `industrial-area` | 2.74 | 35.88 | 128.78 | 0.00 | 0.00 | 7 |
| R4 `military-zone` | 3.04 | 111.67 | 70.48 | 0.00 | 0.00 | 7 |
| R5 `research-campus` | 2.13 | 65.27 | 62.27 | 0.00 | 0.00 | 6 |
| R6 `destroyed-corridor` | 3.57 | 173.77 | 40.50 | 0.00 | 0.00 | 8 |
| R7 `dispersal-complex` | 6.09 | 70.72 | 0.00 | 144.63 | 150.00 | 10 |

The first telemetry version included credits in R7; the corrected final same-seed rerun passes exact regional-total and 150-second epilogue assertions. Its raw result is retained in [evidence/complete-seed-32.json](evidence/complete-seed-32.json). Selected test IDs/results are retained in [evidence/l10-tests.json](evidence/l10-tests.json). This rerun checks the report correction, not a seed battery.

## Larger findings / unmeasured criteria

**P1 · E32-AC10 production R6 speed.** `curePursuitRoute.pressure.speedMs` is `megaAlpha.cruiseMs * 2`; `MegaPursuit.coarse()` applies it beyond the 120 m trail once the target reaches R6. Seed 32, both tiers: stationary player at (3317,95), boss introduced on the authored route at (2977,95); all 240 ticks stay coarse, cover 25.2 m, measured **6.3 m/s**, versus required **3.15 m/s ±2%**. No close attack or stagger is involved. The PO's 0.7× run rule and epic §5.4's same-speed coarse travel have no exception for this catch-up. Existing pursuit tests use an unpressured strip and therefore pass. Fixing/removing this branch changes the E3b arrival calibration; pursuit/finale ownership must reconcile it. Q3 does not alter that pacing or waive the criterion.

Reproduce (expected exit 1 on this implementation):

```sh
sh tools/remote/run.sh "$PWD" --pull test-results/l10-q3/pressure-audit.json -- npx tsx docs/reports/l10-q3/evidence/pressure-audit.ts
```

[Measured audit](evidence/pressure-audit.json) and [reproducer](/Users/wesner/Workspace/mi-evidence-archive/docs/reports/l10-q3/evidence/pressure-audit.ts) are retained. This is a reported production-contract failure, separate from the passing Vitest fixture consolidation.

**E32-AC04 calibrated newbie timing:** no calibrated human/newbie profile is proven by this lane. The complete-policy 20:41 run is retained against the 47-minute authored regional defaults; it cannot sign off the 45–50-minute novice band. No pacing changes or idle padding were made.

## Visual review

Reviewed game-camera contact sheets on WebGL and WebGPU at high/low quality and zoom 1.0/0.5 (catalog additionally runs 1.5). Opening: courier silhouette and warm head light read against the blue-grey road; three regular infected approach from the dark road edge across f0/f30/f60; road paint and the open escape direction remain visible. This narrow crop shows the immediate approach, not the whole wreck or region architecture. Carry: pale cyan canister with red cap is clearly attached to the courier's back at zoom 0.5, the delivery/rocket objective is visible at top left, road/lawn edge and waypoint arrow remain clear; the wide view cannot establish detailed canister readability. Walking seam: across f0–f1200 the blue road and white lane marks stay continuous, the courier remains supported as the security post, lamps/cones and parked police car enter and leave the camera, and no stand-in shape replaces their near geometry. Both backends show matching framing, no black geometry, missing drawn actors, visible LOD stand-ins or obvious sinking. Metrics are gates, not a substitute for whole-level vision review.

WebGPU here is headless automation; manual WebGPU and real iOS/Android checks are not performed by this sim lane. E18 native performance results are reported separately, never inferred from SwiftShader or the remote functional suites.
