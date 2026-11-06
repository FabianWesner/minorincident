# sweep-c5 — L7–L10 acceptance sweep

Current source fingerprint: `43b485e825dc3b7e6afda4f35772460115ce094858019c8637fcd67fde85f32c`. Worktree base was `e1f1e8d`; row evidence was recorded against this fingerprint.

## Final stop summary — 2026-11-06

Stopped at the orchestrator's explicit time-box instruction after committing L7-08 (`8a867de`). The original goal is not complete. Counts below use **currentStatus**, not the historical status preserved by the tracker.

| Level | Current PASS | NOT CHECKED | Measured FAIL |
|---|---:|---:|---:|
| L7 | 7 | 4 | 1 |
| L8 | 10 | 1 | 0 |
| L9 | 9 | 0 | 0 |
| L10 | 10 | 3 | 2 |
| **Total (47 rows)** | **36** | **8** | **3** |

**Closed/current PASS: 36. Still open: 11 (8 unchecked, 3 measured failures). Game defects fixed: 0.** L9 is fully current PASS. This lane changed QA tools and evidence only; game source and assets are unchanged. No additional `qa:threat` run was started: the final instruction required it only if game code changed. The earlier threat diagnostics are not a passing final gate.

The eight unchecked rows retain their concrete next actions below. Work ended before their remaining qualification was completed; none is silently waived. Existing generated aggregate reports and fixture/checkpoint receipts are retained as QA bookkeeping, not a new all-level gate run. Other diagnostic byproducts in the worktree are not additional row closures.

## Closed / current PASS rows

| Row | Result |
|---|---|
| L7-02 | current PASS; exact carried L6 IDs/full HP,600tick formation and six physical weapon selections per tier;41 frames reviewed |
| L7-04 | existing current PASS |
| L7-07 | current PASS;4508/4418 ticks, zero counter mismatches or moving marker ticks; independent controls identical |
| L7-10 | existing current PASS |
| L7-05 | current PASS; fresh exact-criterion review closes historical failure; all14 low/high complete/stationary checks pass |
| L8-01 | current PASS; actual low1/high4 roster, full HP, unchanged arsenal and selected rocket; eleven semantic fault controls reject |
| L8-02 | current PASS; fresh physical low/high handover, tick3600 breach, all75 captures reviewed; eight coverage controls reject faults |
| L8-05 | current PASS; full native outbreak controls, five Alpha admissions, same-ID/species2.5–3.5s bite fixtures and six semantic fault controls |
| L8-06 | requalified current source; breach attacks 5.24/min, first attack 1.97 s, 100% reachability |
| L9-08 | existing current PASS |
| L10-01 | existing current PASS |
| L10-02 | requalified current source; opening at tick 5400, Mega separation ~119 m, matched low/high cues |
| L10-04 | requalified current source; seven regions, low/high reachability and combat rates meet thresholds |
| L10-05 | current PASS; four named pickups/same-tick snapshots,24 inventory-only cases and eight physical WASD approaches;16 frames reviewed |
| L10-06 | current PASS; mechanics plus four physical dog/corgi quality/zoom cells,42 final frames reviewed; first46-frame matrix retained as inconclusive |
| L10-10 | existing current PASS |
| L10-13 | existing current PASS |
| L10-15 | existing current PASS |
| L10-07 | current PASS; canonical native pursuit plus actual normal-clock six audio pairs per tier,2.25x near gain, centered pulsing ring/no Mega pin;12 frames reviewed and14 fault controls |
| L10-09 | current PASS; physical WASD/E research interaction,14 reviewed frames, unchanged racks, matched canister-only movement and lethal checkpoint restore |
| L8-07 | current PASS;46 physical points/tier through all10 exits to fixed APC,44 reviewed frames;1.25m clearance and16 checker faults |
| L8-09 | current PASS; actual carried humans/corgi seated,2647 native boarding ticks,17742 human radar samples with0 missing pins; unarmed APC and12 fault controls |
| L8-10 | current PASS; established physical-save handover diagnostic3.834/3.710s, same APC IDs700/800 at980/930HP;4 final frames reviewed and26 fault controls |
| L9-02 | current PASS; native2x6/3x6/6x8 with2 Alphas, six physical detours≥24.54m;28 final frames reviewed,9 native and48 physical fault controls |

| L9-03 | current PASS; six complete physical routes, conservative moving-camera gaps10.73–18.83s,37 panels reviewed; independent clock controls |

| L9-05 | current PASS; actual0HP keyboard drives>1.5km,60.36% healthy speed, dense smoke;96 panels reviewed and8 faults reject |

| L9-07 | current PASS; four whole-body physical crashes, oneimpact each,10 intact fall samples/cell and postimpact objective;8 faults reject |

| L9-04 | current PASS; matched safe990HP vs shortcut860/900HP, unique10damage billing,36tick stopped windups;24 panels and11 faults reviewed |

| L7-03 | current PASS;2.4shots/s,24/24kills, clicked/first-hit/35m fallback, readable pointblank;74 panels and10 faults reviewed |

| L8-03 | current PASS;20locals/6soldiers/4staff/8animals, purposeful calm maxidle0.6s, fourwall pursuit0cross/hits;20frames/16faults |

| L8-04 | current PASS;8physical tunnel cases/96reviewed panels, tick3600packet/doors, behind-threshold admissions, max0.210803m/3ticks;17faults |

| L8-08 | current PASS;80 animal+8 canopy panels reviewed, normal same-ID bites/paired movement,15 faults; historical canopy counterexample does not reproduce |

| L9-01 | current PASS; exact physical carried700/800APCs at980/930HP, throttletick0/motiontick1, hidden seated corgi/no visible hull penetration;28panels/16faults |

| L9-09 | current PASS;172actualGLB boundaries/43140positions max1cm, six physical streamed drives capped9/25, every held-input tick matches across54–73residency sets;21faults |

| L9-06 | current PASS; six complete physical detours plus three real offroad stall/press/reverse cases/tier,8.05–8.52mbackward escape,24reviewedpanels/15faults |

| L7-08 | current PASS;60/120regular+2Alpha whole-horde census, actual core rocket gap used by1/4carried humans,50final panels/21faults; core-vs-approach placement explicit |

## Still open rows

These are the `qa:accept` currentStatus values. The separate status field preserves historical failures until fresh exact-criterion review; it must not be mistaken for a new measured failure.

| Row | Status | Required next work / current finding |
|---|---|---|
| L7-01 | NOT CHECKED | Inspect approach collection; perform pickup/first-shot frame gate only in orchestrator quiet window. Exit distance is measured. |
| L7-06 | NOT CHECKED | Manual full-size sheet review alongside the real-input receipt. Remaining timing/census/trajectory clauses are not established by still images. NEXT: Physically explore both connected corridor routes and wrong-way edges, then review a screenshot-only route-clarity run and current-source bounds sweep. |
| L7-09 | FAIL | Inspect all bars and pressing-crowd body orientation; retain the measured individual human pace checks. |
| L7-11 | NOT CHECKED | Complete physical low/high cinematic evidence now exists in L7-08: 540 ticks / 9 s, same bus at 1000 HP, displacement ≥118.495 m, original 1/4 humans boarded. All departure panels reviewed: lit military truck/light tower, fires/corpses/blood and smoky skyline; no bare map edge, some late bus cropping. Native cinematic overrides user zoom. NEXT: Wire a dedicated criterion consumer, semantic fault controls and exact row review, then qualify/commit this row. Stopped before that work; L7-08 evidence alone does not close it. |
| L7-12 | NOT CHECKED | Manual full-size sheet review alongside the real-input receipt. Remaining timing/census/trajectory clauses are not established by still images. NEXT: Run tools/playtest/session.ts on L7 from its progressed save with physical WASD/mouse, low/high and zoom 0.5/1.5; record a frame burst and read-only timing/count ledger for the complete row, then review the frames. Required: Frames: worst destruction so far, Alpha silhouettes human, player contrast ≥ 3:1. |
| L8-11 | NOT CHECKED | Manual full-size sheet review alongside the real-input receipt. Remaining timing/census/trajectory clauses are not established by still images. NEXT: Run tools/playtest/session.ts on L8 from its progressed save with physical WASD/mouse, low/high and zoom 0.5/1.5; record a frame burst and read-only timing/count ledger for the complete row, then review the frames. Required: Frames: strong sanctuary, then mixed battle; Opus "is it stunning?" pass. |
| L10-03 | FAIL | Same-tick census: low industrial max9<16 and campus33<35 with required species; high industrial15<25; high corridor never has required dogs/Alphas together. Full ledgers and identical native controls retained. |

| L10-08 | NOT CHECKED | Manual full-size sheet review alongside the real-input receipt. Remaining timing/census/trajectory clauses are not established by still images. NEXT: Run tools/playtest/session.ts on L10 from its progressed save with physical WASD/mouse, low/high and zoom 0.5/1.5; record a frame burst and read-only timing/count ledger for the complete row, then review the frames. Required: Road regions framed ×1.3 (verges/fields in frame), base × max zoom ≤ 2.0; not in the finale. Suit crowds readable at night, slam telegraph is a ground effect. |
| L10-11 | FAIL | Fresh 240 s hold: Mega arena entry was 57.78 s low / 56.45 s high, outside the 120–160 s criterion. Continue full assault census and arrival timing; do not close. |
| L10-12 | NOT CHECKED | Manual full-size sheet review alongside the real-input receipt. Remaining timing/census/trajectory clauses are not established by still images. NEXT: Use native direct-hit rocket and conventional/minigun fixtures for Mega HP thresholds, then real-input motion/death captures and frame probe within/outside twelve metres. |
| L10-14 | NOT CHECKED | Manual full-size sheet review alongside the real-input receipt. Remaining timing/census/trajectory clauses are not established by still images. NEXT: Record the complete real-input epilogue with mist-position/event ledger, species kill latency, healthy/corgi immunity, control duration, camera pullback and actual title/credits. |

## Evidence and gates

Current QA-only checkpoint (isolated post-L9 rerun107/107; concurrent run had3timeouts, both logs retained in checkpoint-after-l9): `npx tsc --noEmit`, `npm run lint`, and `npm test -- --maxWorkers=4` pass (107 tests,27 files). This is not a passing final gate run. Latest post-L7-08 typecheck and lint pass; its 21 semantic fault controls reject all injected faults. Latest scoped L7 acceptance reports 1 fresh FAIL and 4 incomplete rows, with zero fixture/control errors; L8 has 0 fresh FAIL / 1 incomplete, and L9 has 0 / 0. Acceptance processes can still exit 1 for open criteria/global failures. Full final acceptance and the zero-flag threat gate were not achieved before the stop instruction.

Row-specific commits:

- `69daf11` — L7-05 current-source requalification
- `7b49bef` — L8-06 current-source requalification
- `7314277` — L10-02
- `ef01b8b` — L10-04
- `bf36764` — L10-11 measured failure
- `6fcc2d2` — L10-07 pursuit checker correction and controls
- `8468ed5` — L8-04 physical tunnels
- `50080fc` — L8-08 animal presentation/canopy
- `1bfc4fe` — L9-01 physical APC continuity/control
- `57b750c` — L9-09 terrain boundaries/streamed physical drives
- `b0adebf` — L9-06 offroad recovery/HUD; L9 fully PASS
- `8a867de` — L7-08 actual rocket gap and carried human passage; checkpoint logs

- Fresh `qa:accept --reuse --skip-browser` reports were run for L7, L8, L9 and L10 at both tiers. They show L7 and L10 failures and the remaining incomplete criteria; logs are in `gates/`.
- `npx tsc --noEmit`, `npm run lint`, and `npm test` passed (107 tests, 27 files). Logs are in `gates/`.
- The full `npm run qa:threat` run exceeded its 598 s browser reservation/test budget. Reran in bounded batches covering L1–L5 and L6–L10. Combined measured findings: 12 L7 flags and one L4 flag; the batch receipts are explicitly diagnostic partial selections. The required zero-flag gate is not met.
- Initial sandbox restrictions prevented access to the shared browser pool and Git index writes. On the 2026-11-06 continuation, the pool became reachable and the slim-worktree command succeeded; physical handover qualification resumed. Remaining visual qualifications were stopped by the orchestrator time box.
- `sh tools/ops/slim-worktree.sh <path> --no-assets` succeeded on continuation after filesystem access changed.

Open current rows: 11 = 8 NOT CHECKED + 3 measured FAIL. Current PASS rows listed above: 36. Game defects fixed: 0. No game code was changed. Perf work was not performed.
