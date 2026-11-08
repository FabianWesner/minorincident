# L8 slowdown investigation

## Status

Three CPU hot spots fixed and native routes preserved. **Whole-level render smoothness is not certified.** The brief permits native reporting when quiet admission fails; the latest orchestrator instruction prohibits browsers and assigns their remaining checks to the QA lane. The dense hold still needs performance headroom. No deploy or push.

Baseline: `1b4e89b1`. Reviewed both saved WIP commits (`5c12ef71`, `55c09902`) after the crashes. Final runtime changes affect four simulation files; navigation and character separation are restored to baseline behavior. Specs and dependencies are unchanged.

Evidence: [native measurements](native/summary.json), [validation](validation.json), [QA summary](qa-summary.json), [environment and missing coverage](environment.json).

## Causes and changes

- **Night sight queries multiplied by the human group.** The previous single-position memo missed when infected interleaved queries for different survivors. Cache every target position within the tick/power revision, and index lamps by their influence cells. Exact distance, power, breakage and startup checks remain live. An exploratory hold previously made 3,625,786/2,055,238 power checks in the two 120-tick samples; final counts are 107/97 for the same 104,545/137,776 sight queries and matching state hashes. These are power-call counts, not all distance tests.
- **Nearby-human queries scanned every human for each caller and allocated new target records each tick.** Reuse records and query a human-only spatial index of the same tick snapshot; retain live eligibility checks and sorted IDs. This avoids repeatedly considering distant humans without changing target order.
- **Each boarding follower rebuilt the roster and nested passenger/seat searches.** Cache roster/passengers within the tick, invalidate on membership events and entity revision, and use a seated-ID lookup with an ordered queue scan. Public arrays remain copies. Dispose the four new listeners with the mission.

Cause commits include `a0279ce1`, `e0534db6`, `429187a6`, `5dc1d6d0`, `43396b2b`; identity/lifetime follow-ups are retained. The initial speculative routing/separation changes were reverted (`acb21bab`, `d203011a`). Path retry behavior is not credited as a cause or fix.

## Complete route before/after

Seed 1, low/high, native L8 bot, following camera envelope at zoom 1.5. The shared campaign carries 50 survivors: a real seeded L7 handover was expanded cyclically from its survivors with unique IDs/slots. This is a stress input, not the original PROD save. Baseline simulation modules were loaded from Git in memory; no extra build or worktree was made.

**Process CPU p95 per simulation tick, milliseconds:**

| Tier | Tick window | Baseline | Final |
|---|---|---:|---:|
| low | 0–3600 | 3.51 | 3.92 |
| low | 3600–5602 | 19.19 | 13.76 |
| low | 5602–5722 | 13.78 | 13.11 |
| low | 5722–7200 | 12.02 | 10.11 |
| low | 7200–8931 | 9.62 | 9.26 |
| low | 8931–9051 | 7.67 | 7.41 |
| low | 9051–10190 | 7.74 | 8.26 |
| high | 0–3600 | 3.51 | 3.52 |
| high | 3600–5602 | 20.21 | 11.32 |
| high | 5602–5722 | 23.07 | 14.80 |
| high | 5722–7200 | 18.36 | 13.76 |
| high | 7200–7513 | 13.37 | 15.15 |

Both mortal routes finish: low tick **10190**, high **7513**, unchanged from baseline. Entity and mission-state SHA256 fingerprints match at all **12 recorded cutpoints**. The complete routes plus hold compare **1,809 human queries** against brute-force snapshot results. These are sampled state checks, not proof of every intermediate tick or every other level.

These timings were collected before the second crash on a heavily contended Mac (recorded load generally 25–40). They are diagnostic observations, not a quiet paired performance gate. Process CPU includes runtime helper/GC threads; subsystem durations are elapsed wall time and overlap through nesting. Final instrumentation additionally measures vehicle stages and checks queries outside timed ticks. The final high departure tail is 15.15 versus 13.37 ms baseline; the opening/tail do not demonstrate a universal improvement. Earlier stale-camera runs and timer-heavy exploratory timings were removed from the retained comparison.

## PO samples and dense breach hold

The original replay/checkpoint payload was not supplied. Seed, tick, position and population counters do not determine all entity positions, prior inputs, AI/RNG state or survivor loadout. **Neither supplied PROD state was reproduced exactly.**

Both PO samples request seed 1, high/WebGPU and zoom 1.5; their reported render FPS is 35.9 and 59.6 respectively (two-second averages).

The separate hold fixture follows the native route to breach tick 3600, enables god mode, teleports once to the first PO position, completes the escape objective to expose `depart`, then withholds movement/interact while retaining bot attacks. Collision subsequently moves the player. It remains at checkpoint `breach` through tick 9051.

| Tick | State | Alive / downed / corpses / followers | Horizontal player position |
|---|---|---|---|
| 5722 | PROD sample | 101 / 23 / 18 / 50 | 27.14, 58.57 |
| 5722 | Constructed hold | 113 / 7 / 25 / 50 | 25.72, 57.17 |
| 9051 | PROD sample | 174 / 10 / 158 / 34 | 29.26, 60.98 |
| 9051 | Constructed hold | 173 / 18 / 99 / 32 | 25.72, 57.17 |

PO counters above are quoted verbatim; their implementation is not supplied. The retained older JSON field `livingInfected` counts director slots (119/178), not actual live actors. `livingInfectedActors` derives the actual 113/173 count from the recorded loop visiting every health-positive infected. Updated tools emit actual alive counts and separate `directorSlots`.

Final two-second native windows:

| Ending tick | Tick process CPU p50 / p95 ms | Tick wall p95 ms | Sim seconds / native wall second |
|---|---:|---:|---:|
| 5722 | 4.71 / 15.45 | 17.21 | 2.36 |
| 9051 | 6.91 / 16.50 | 31.30 | 1.25 |

The hold reaches **18.53 ms process CPU p95** in the intervening 5722–7200 window. Its baseline rerun was killed by the crash and has no completed receipt; no dense-state before/after timing claim is made. Six hold state fingerprints match the earlier exploratory run after the lamp index change.

The ratios above measure unpaced native throughput including harness work, with no renderer. They do not establish the actual game's sim/wall ratio. `Clock` spends at most its per-frame catch-up budget (25 ms by default, adjusted for long frames), bounds owed ticks and may discard excess backlog. Slow simulation with a misleadingly healthy render FPS is therefore plausible, but remains unproven for the PO's exact state. The clock policy was not changed.

At hold tick 9051, elapsed subsystem p95 is AI 10.48, NPCs 8.17 (outbreak 7.03), contact commit 9.10, follower 0.16, navigation 0.57, A* 0.22, Rapier 0.29, vehicle pre/post 0.30/0.18 ms. **Do not sum these nested, descheduling-sensitive values.** Exploratory sampling also observed `SolidRegistry.commit`, `CharacterSeparation` and `SpatialHash.query`; its timer-heavy durations are excluded. Remaining pressure is concentrated in AI/outbreak and crowded contact/spatial work; A* and vehicle stages were smaller. Animals remain within the AI/NPC populations (eight resident animal entities); there is no isolated elephant benchmark or renderer corpse-page timing.

## Growth and fidelity

Corpses accumulate: complete routes end at 63 low / 61 high; hold reaches 99. Settled corpses release their infected pool slot; ordinary human corpses are visual debris, while explicitly solid large bodies retain contact. The high cap is a weighted admission cap, not a total entity/corpse cap. In strict L8 it includes recoverable downed actors; director slots are therefore different from actual live actors. The PO's 174 live infected alone does not establish a cap violation. No population, corpse lifetime, follower bar, LOD, AI frequency or contact-pass reduction was used.

Listener count stays at 79 throughout final routes/hold (baseline 75 plus four scoped cache listeners); reload regression checks retain the same total. Native heap is GC-sensitive and nonmonotonic: low 107→154→114 MB, high peak 171 MB then 113 MB; the late hold is about 153–155 MB with more entities. This does not demonstrate a leak, and does not measure browser/GPU memory, particles, decals or audio voices.

## Checks

- `npm run typecheck`: PASS (remote, 49.89 s).
- `npm run lint`: PASS (remote, 30.40 s).
- `npm test -- --maxWorkers=1`: PASS (187.00 s), 27 files, 106 passed / one Mac-only test skipped on Linux. Registration remains **150/150 cases**. The earlier Mac run passed all 107 cases.
- `npm run qa:accept -- --level L8 --skip-browser`: exit 1 (226.92 s), **zero fresh failing rows, ten incomplete rows**. Both complete routes finish; eight fixture clauses pass; all six checkpoint controls pass with identical control state. Stationary policies stop at their configured tick windows. The historical aggregate L8-06 FAIL is retained while its current automated checks pass. This is not full acceptance.
- `npm run qa:threat -- --levels L8 --maxWorkers 1`: exit 1 (72.52 s), skilled/passive complete; no L8 phase/passive flags; kiting 18 attacks/min. Only flag: `PARTIAL_LEVEL_SELECTION` (a selected-level diagnostic is not a campaign gate).

Final acceptance runtime and observer hashes match the current source files. All five checks ran sequentially on the remote runner. The remote snapshot is `01862ac2a4d64eb98ebbb94e5c09cf8aa189f49b`; the checked source worktree revision is `ed4aad77` (later commits change report artifacts only). Full command outputs are reduced to compact tails in the linked validation JSON.

The runner checkout initially lacked Git `HEAD`, causing one tooling fixture failure. The final rerun creates a real source snapshot commit only inside the disposable remote job. Its commit ID is recorded separately from the source worktree revision; source hashes establish which runtime was checked. No global acceptance tooling changes remain.

## Browser QA needed

**No browser was launched in the final continuation.** Earlier quiet admission ended after about 19m25s at load ~27, with no timing capture. A prior counters-only headless WebGPU attempt failed at Chromium launch with a macOS MachPort bootstrap error. No draw/triangle/skin/bar timing result exists.

QA lane must:

1. Obtain the actual batch59 replay/checkpoint or complete simulation-state payload. Reproduce both supplied ticks, positions, populations, `depart`/`breach`, seed 1, high WebGPU and zoom 1.5. Label any constructed fixture separately.
2. Run the whole mortal L8 route at low and high in an admitted quiet window, one headless browser at a time, using the shared QA build. Record frame p95 ≤17 ms and no steady-play frame ≥66 ms, sim tick/frame CPU, owed ticks and actual sim-seconds/wall-seconds ratio. Separate intentional blast time scaling from budget lag.
3. Attribute view update/render and UI CPU, draws, triangles, visible characters, palette/pose updates and skinning, first-use material/corpse-page work, and health bars at both PO states. Source uses crowd pose atlases and instanced health-bar layers (at most six meshes); 50 followers do not imply 50 separate bar draw calls. Their actual cost is unmeasured.
4. Track browser heap/GPU resources, particles, decals, audio voices and corpse pages from sanctuary through departure; inspect follower queue, contact behavior, all bars and mixed animal combat. Recheck the late dense hold and the observed departure tail before claiming the smoothness goal.

The new whole-route tool is `tools/perf/l8-browser-profile.ts`; `fix51-route-profile.ts` now accepts L8 for detailed attribution, and `l8-render-census.ts` restores temporary native snapshots for counters. These browser additions typecheck but could not be exercised here. A dev-server run is diagnostic; production acceptance must use the shared QA preview build (`SCENE_SERVER=preview`, `SCENE_DIST=<shared build>`). Per-object attribution is disabled during frame timing.

## Reproduction and cleanup

Native commands below describe the recorded method; run heavy work through admitted infrastructure. Generate the shared campaign once, then reuse it for both source variants:

```sh
node --import tsx tools/perf/l8-native-profile.ts --campaign /tmp/l8-campaign.json --label final --tier both
L8_REFERENCE_REV=1b4e89b1 node --import tsx --import ./tools/perf/l8-reference-loader.mjs tools/perf/l8-native-profile.ts --campaign /tmp/l8-campaign.json --label baseline --tier both
node --import tsx tools/perf/l8-native-profile.ts --campaign /tmp/l8-campaign.json --label holdFinal --tier high --policy hold --counts
```

For QA's later browser window, set `L8_PROFILE_CAMPAIGN` to that campaign and run `l8-browser-profile.ts` through `tools/perf/quiet-run.sh` (20-minute admission cap). `L8_STATE_OUT` optionally writes temporary hold snapshots for the render census; remove them afterward. The original-source loader needs real Git history and does not work in the runner's index-only checkout.

Final heavy validation ran sequentially through `tools/remote/run.sh`, with Vitest at one worker. Owned temporary captures/receipts/snapshots were removed. Retained artifacts are the four JSON links above and this report; no raw CPU profiles, screenshots, contact sheets, traces, extra builds or worktrees remain from this run.
