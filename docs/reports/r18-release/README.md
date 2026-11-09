# r18-release — batch 60 release checks

Candidate: `c8d4a8024bd9660f25df29d49cc2ddafe0100575` (`c8d4a802`). PROD is batch 59. No tracked game/test/tool source files or acceptance targets changed during this check. **Release verdict: NO-GO.** Collection stopped under the orchestrator’s 20-minute closeout instruction; remaining coverage is explicitly unmeasured and assigned to follow-up lanes.

## Verdicts

| Check | Verdict | Evidence / numbers |
|---|---|---|
| `npm run test:nightly:remote` — campaign bot L1 → credits, real handovers and content ratchets | FAIL | **1,201.1 / 1,200 s**, watchdog exit 124; remote wrapper exit 1. Continuous campaign completed **L1–L8** (L4/L5/L6 had 4/1/5 deaths and native retries); L9–credits remain unverified. The other nightly collection completed **22 passed / 11 failed** across 9 files, **971.16 s**. The terminated campaign did not write its final JSON; streamed progress and all failure assertions are retained in [receipt](nightly.json) / [full log](nightly.log.gz). |
| Full `npm run qa:threat` | FAIL (acceptance); runtime PASS | Local full run completed in **399.5 s**, within **600 s** budget, 4 workers; remote full run **FAIL at 601.1/600 s** (watchdog 124), with L4 skilled taking **557.724 s** and no complete remote audit JSON. [Remote timing receipt](threat-remote-timeout.json) / [log](threat-remote-timeout.log.gz). Unchanged level-group runs completed full remote coverage in a 565.758 s native-stage envelope across three runners (details below). Local run: all 10 skilled routes completed. **Six gating flags**: L7 stationary-follower upper bound **20.20%** (limit 10%); departure followers below 0.95× group median in 2/3 seeds: ID 20 (**92.1%, 78.1%**), 64 (**93.5%, 91.6%**), 68 (**86.2%, 79.0%**), 74 (**94.0%, 90.4%**); L10 moving-kiting sample **0 landed hits/min** in **20 s**, despite **2 attack starts**, **40.06 m** movement and no frames without threats (floor 2/min). `test-results/qa-threat/audit.json` and `stages.json` retain full evidence. |
| Cold-load budget: L1/L4/L7/L8/L10 × WebGPU/WebGL2 × low/high,20 fresh-browser samples/configuration/side | FAIL | **800 qualified profiles,20/20 configurations complete:1 PASS /19 FAIL.** Only L7 high-WebGPU passes. Worst candidate load **11,256.8 ms** (L8 low-WebGL2;6,000 ms limit); worst post-card frame **683.3 ms** (L4 low-WebGL2;200 ms limit). Median parity fails in19 configurations. All sample counts, unique profiles, hardware/backend/tier, error and movement-frame coverage checks pass. The invalid L8 high-WebGPU pair is retained separately and excluded. The separate L10 lamp replay is UNMEASURED and deferred. |
| Frame-time / native performance L3–L10, A/B vs batch59 | FAIL; partial coverage | **15/16 configurations measured:10 PASS /5 FAIL.** L4 low/high p95 rises16.8→33.3/33.4 ms; L9 low/high maxima50/50.1→100/83.4 ms; L10 low33.3→66.6 ms. L7 event windows:6 PASS. Full low-charge window:FAIL (50→66.7 ms). **L10 high, its charge window, both ending probes and all four lamp replays are UNMEASURED**, deferred at the orchestrator cutoff. |
| `npm run qa:invariants` (remote serialized sim plus Mac renderer) | FAIL | Remote sim: **20 passed / 8 failed**, **517.436 s** including wrapper. Remote threat timed out at its 600 s execution ceiling (**619.365 s** stage including sync). Original Mac renderer: **11 passed / 1 failed**, **363.597 s** test time. Its ten timing comparisons used the checker’s actual QA default, contrary to the documented PROD default; they do not qualify PROD parity. The corrected pinned-PROD-mirror timing replay completed **2 PASS / 8 FAIL** in **3.5 minutes**, with all ten measurements present. The failed L5 marker fixture demands visuals deliberately removed by PO Q302. |

## Remote grouped coverage

After the single-host timeout, the unchanged audit ran in three groups on isolated cx33 runners: A (L1–L4), B (L5–L7), C (L8–L10). Their native-stage envelope was **565.758 s** across three machines; this is complete remote level coverage, **not a repaired or passing single-host package command**. The groups took **554.13 / 535.99 / 279.98 s** respectively. All 31 stages and all ten skilled completions are present. Removing only the explicit `PARTIAL_LEVEL_SELECTION` marker leaves **four gating flags**, all in L7 and L10: follower wait, departure IDs20/74, and zero landed moving-kiting hits. Source and observer hashes match across every group. Local and remote per-level verdicts agree (8 PASS / 2 FAIL); their detailed numbers differ and are retained separately.

The separate unmodified L5 passive seed2 CPU profile took **335.84 s** and produced exactly the same entire seed receipt as the matching grouped remote run (state hash `f1b23224`). Largest sampled self costs are `HitQuery.cover` **47.22 s**, `SpatialHash.query` **34.35 s**, and `SolidRegistry.ts` **33.00 s** across its functions. The workload spans existing cover, contact and navigation code, not one isolated small regression. No query scope, observation window or acceptance target was reduced. [Grouped summary](threat-remote-groups-summary.json), [complete grouped receipts](threat-remote-groups.json.gz), [profile summary](threat-profile-summary.txt), [raw profile](threat-profile-L5-passive.cpuprofile.gz).

## Threat receipt details

Reproduce the six flags with `npm run qa:threat` at the recorded head (ordinary native seeds 1–3 for L7 pace; seed 1 for the L10 crash-region 20-second retreat-kiting encounter). No gameplay cause has yet been isolated sufficiently for a small repair.

The report's separate L2-12 table displays **23.41/min** against **2–20/min**, but this ceiling does not enter the command's top-level fail list. Skilled wave observations also carry advisory flags: L3 station-0 first attack **23.87 s**, station-2 no attack during **143.95 s**, and L10 first assault attack **20.70 s**. The gate explicitly aggregates passive-wave flags, whose corresponding observations pass. Earlier draft statements confused passive observation durations with first-attack delays; the raw receipt is authoritative and this draft is corrected.

## Execution and build identity

Network/process access was restored. The replacement remote nightly terminated with the budget failure recorded above; the completed local threat evidence is retained as [raw audit](threat-audit.json.gz), [stage timings](threat-stages.json.gz) and [generated report](threat-README.md). The current public candidate was built successfully, and all 2,758 batch-59 mirror files were restored and checked against their recorded hashes. Comparison servers used immutable snapshots on 4911/4912 (both sides moved together between complete configuration pairs from the original 4901/4902 servers). All 2,887 public files are byte-identical to the original build and all 2,758 PROD mirror files match the pinned ledger. This lets the invariant command rebuild its separate dist safely. PROD identity at collection was bundle `index-Dk-iL-FG.js`, SHA-256 `61043483d030ec6be950a50c4de5d2d3d1301106df7a6ac18c2eaa0b1bbf29e0`. The separately built current QA artifact matched live QA's bundle name at collection `index-B33LTwE-.js`.

The full serialized invariant command and its corrected PROD timing replay terminated with the failures above. The cold matrix completed. At the orchestrator’s closeout instruction, the already running L9 high pair was allowed to finish, and both orchestration processes were stopped before they could launch L10 high or the ending/lamp jobs. Owned comparison servers were then stopped. No deploy or push was performed.

<!-- load-matrix-start -->
## Cold-load matrix

Milliseconds; each complete cell has 20 fresh browser profiles per side. `post-card max` includes the first frames of every load and ten seconds of movement after the last load.

| Configuration | PROD median / p90 / max | Candidate median / p90 / max | Δ median | Candidate post-card max | Verdict |
|---|---:|---:|---:|---:|---|
| L1 webgpu low | 1908.70 / 1942.60 / 1959.50 | 1994.35 / 2011.90 / 2059.70 | +85.65 | 33.40 | FAIL |
| L1 webgpu high | 1867.70 / 1908.80 / 1912.10 | 1935.65 / 1959.20 / 1960.60 | +67.95 | 66.70 | FAIL |
| L1 webgl2 low | 2159.70 / 2192.60 / 2259.00 | 2268.35 / 2324.40 / 8226.80 | +108.65 | 416.70 | FAIL |
| L1 webgl2 high | 2126.95 / 2143.40 / 2876.10 | 2192.75 / 2342.20 / 3127.40 | +65.80 | 400.00 | FAIL |
| L4 webgpu low | 3141.80 / 3174.00 / 3192.10 | 3366.25 / 3391.00 / 3956.10 | +224.45 | 66.60 | FAIL |
| L4 webgpu high | 3574.65 / 3593.30 / 3640.80 | 3858.10 / 3906.50 / 3958.90 | +283.45 | 83.30 | FAIL |
| L4 webgl2 low | 3342.05 / 3424.50 / 3641.30 | 3492.30 / 3525.80 / 6607.40 | +150.25 | 683.30 | FAIL |
| L4 webgl2 high | 3784.40 / 3808.70 / 4141.30 | 3984.65 / 4292.00 / 5940.10 | +200.25 | 450.10 | FAIL |
| L7 webgpu low | 2742.35 / 2791.60 / 2808.80 | 2824.80 / 2841.90 / 2842.10 | +82.45 | 16.80 | FAIL |
| L7 webgpu high | 3315.00 / 3341.30 / 3342.20 | 3275.45 / 3325.90 / 3358.80 | -39.55 | 16.80 | PASS |
| L7 webgl2 low | 2991.40 / 3041.40 / 3107.20 | 3125.95 / 3159.10 / 10274.90 | +134.55 | 99.90 | FAIL |
| L7 webgl2 high | 3542.30 / 3608.70 / 10257.00 | 3558.25 / 3675.60 / 7508.00 | +15.95 | 16.80 | FAIL |
| L8 webgpu low | 3191.85 / 3209.00 / 6407.50 | 3741.35 / 3774.70 / 3776.30 | +549.50 | 33.30 | FAIL |
| L8 webgpu high | 3341.40 / 3376.20 / 4374.80 | 4007.85 / 4041.80 / 4058.40 | +666.45 | 50.00 | FAIL |
| L8 webgl2 low | 3091.80 / 3127.70 / 10358.20 | 3625.55 / 3659.20 / 11256.80 | +533.75 | 33.30 | FAIL |
| L8 webgl2 high | 3292.25 / 3358.80 / 6674.80 | 3924.35 / 4041.90 / 7241.00 | +632.10 | 33.40 | FAIL |
| L10 webgpu low | 3267.05 / 3292.30 / 3375.10 | 4060.50 / 4092.30 / 4124.90 | +793.45 | 33.40 | FAIL |
| L10 webgpu high | 3008.75 / 3042.30 / 3075.80 | 3857.15 / 3875.00 / 3890.60 | +848.40 | 33.50 | FAIL |
| L10 webgl2 low | 3535.85 / 3560.40 / 8509.10 | 4359.20 / 4410.00 / 9725.10 | +823.35 | 33.40 | FAIL |
| L10 webgl2 high | 3233.95 / 3326.50 / 5425.30 | 4226.50 / 4276.70 / 6607.60 | +992.55 | 33.40 | FAIL |
<!-- load-matrix-end -->

## Native probe preparation

Native frame probes use the unchanged public game bundle and each version's matching test API/bot code, installed only behind `testApi=1`. Batch59's read-only source export is pinned to `2741447`; its dependency lock matches the candidate. This avoids running current L8/L10 policies against obsolete controller interfaces. The shared probe supplies ordinary inputs and records actual backend, tier, world state, frames and events. It does not replace the public simulation or rendering implementation. The adapters are absent from all cold-load requests.

Prepared ending probes (UNMEASURED at cutoff) use version-matched native pre-release saves, all seed1 with the real release objective active. Missing compressed report seeds were restored byte-for-byte from their Git objects; [seed provenance](ending-seeds.json) retains source refs and hashes. The prepared ending harness protects the courier to retain the rendered window. The baseline's150s epilogue and the candidate's65s epilogue would run through their own natural clocks; neither ending capture was executed. These settings and the matching-adapter hashes are retained in [adapter provenance](baseline-adapter.json).

## Invariant baseline and fixture correction

The renderer spec defaults to the QA origin in code even though the gate documentation says PROD. Simply pointing it at live public PROD cannot work: the checker waits for `window.__SS__`, which that public build intentionally omits. A direct-origin diagnostic attempt was stopped after two 240 s timeouts and is excluded from acceptance evidence. The corrected replay explicitly sets `QA_INVARIANTS_BASELINE=http://127.0.0.1:4912/?testApi=1`, using the verified batch-59 public mirror with its diagnostic adapter. No test default, game code or threshold was changed. This baseline configuration mismatch needs a separate checker repair.

The L5 rendered objective test dereferences missing `survivor-spot-rosa/sam` objects. PO Q302 requires hiding places to have no ring, arrow or minimap pin (`docs/qa/po-checklist.md:43`); the removal is also present in batch59. This is an inherited stale fixture, not evidence to restore the removed visuals. Other simulation/content failures remain release failures.

## Content failures and repros

Run `npm run test:nightly:remote` or the corresponding remote invariant stage at the candidate revision. The failures retained in [simulation assertions](invariants-sim-summary.json) are:

| Fixture | Observed failure |
|---|---|
| Scripted actor persistence | 45,796 missing actor frames; for example L2 high firefighter125 becomes hidden from tick1501. |
| L2 escape wave inventory | high41 vs expected35; low45 vs expected21 authored batches. |
| L9 scripted crash | scenario fixture remains `driving` when `impact` is required. |
| L4 war wave count/arrival | nine high-tier and seven low-tier wave discrepancies. |
| General wave census |30 maintenance slots vs expected48, both tiers. |
| Nightly LOD silhouette |27 fidelity discrepancies; corn blocks IoU≈0.33–0.37 and cow carcass≈0.34. |
| Nightly asset validation |50 manifest/asset errors, including infected dimensions. |
| Nightly seated sweep |480 s fixture timeout; the isolated invariant sweep passes this fixture. This is a runtime failure, not proof of a missing seat. |

These failures span content authoring, fixtures and controller behavior. Their assertion locations and full outputs are retained; no small, isolated game-code repair was established during this release check. Numerical mismatches alone are not sufficient grounds to update authored expectations.

## Cold-load regression diagnosis

The paired L1 samples show eight additional candidate LOD1/burned-vehicle assets (about1.09 MB extra transfer in the first observation). `DistrictView.load` now preloads those destruction sources. Median L1 low-WebGPU route-LOD work rises40.6→84.3 ms and warmup chunks865.0→939.9 ms. This identifies added residency/preparation work behind the median regression; it is not a justification to remove required destruction assets.

The first L1 low-WebGL2 candidate load spends6,235.7 ms in warmup, including5,883.6 ms chunk warmup and2,536.7 ms shader compile. A416.7 ms drawn interval occurs just after the loading card closes, without a corresponding main-thread long task. First-use driver/pipeline work is a plausible cause, not an isolated proven pipeline. A separately profiled diagnostic replay (excluded from acceptance distributions) did not reproduce that frame after driver cache warming. Reproduce with the recorded public candidate, `LOAD_FRESH_BROWSER=1`, WebGL2 low,20 samples, and ten seconds of real movement. Preserve the first-use samples; do not discard them as outliers.

An unadmitted QA build overlapped the original L8 high-WebGPU baseline pair at10:01:30–10:01:39 UTC. That full pair is preserved as invalid under `attempts/nonquiet-build/`; all20 samples per side were repeated through exclusive admission. The replacement pair completed and is the only pair used in the matrix.

### Frame comparison rules

Native A/B uses the established `perf12` comparison rules: candidate p95≤PROD+1 ms; maximum≤PROD+16.8 ms; a new≥66 ms hitch fails when PROD is below66 ms. These are reported separately from the absolute cold-load post-card200 ms gate. Each L3–L10 tier receives at least60 s of native gameplay, with90 s for L10 and explicit L7 pickup/rocket and L10 charge windows. Intervals are browser animation-frame intervals, backed by actual rendered-frame progress and nonzero submitted geometry; they are not GPU timer-query measurements. Courier survival protection retains the observation window. A single paired native capture qualifies the recorded route and hardware only.

The first mirror-based replay exposed an adapter startup race: `__SS__` existed before its ready promise resolved, so the checker could click Start while initialization changed the screen. This diagnostic attempt was stopped after the first240 s timeout and is excluded. The retained release-only copy of the timing checker awaits that ready promise and supplies the matching batch59 adapter; request interception is enabled on both sides. It keeps the original start/end timing boundaries, alternating order and assertions. The tracked invariant spec remains unchanged.

## Invariant PROD timing replay

Candidate is the current QA build; baseline is the pinned public batch59 build with its matching adapter. This is the invariant checker’s single-context-per-level comparison, separate from the20-profile public cold-load matrix. All ten observations passed backend/tier/drawn-frame/playing-state checks. The [complete summary](invariants-prod-summary.json) retains numbers and replay adaptations.

| Level | PROD ms | Candidate ms | Limit ms | Verdict |
|---|---:|---:|---:|---|
| L1 | 2079.40 | 2611.00 | 2287.34 | FAIL |
| L2 | 3005.60 | 3846.10 | 3306.16 | FAIL |
| L3 | 3111.00 | 3609.20 | 3422.10 | FAIL |
| L4 | 3214.00 | 34858.80 | 3535.40 | FAIL |
| L5 | 2712.90 | 3026.80 | 2984.19 | FAIL |
| L6 | 4967.00 | 2359.60 | 5463.70 | PASS |
| L7 | 2813.50 | 3313.00 | 3094.85 | FAIL |
| L8 | 5863.20 | 4313.60 | 6449.52 | PASS |
| L9 | 4589.40 | 7011.10 | 5048.34 | FAIL |
| L10 | 3422.10 | 6326.30 | 3764.31 | FAIL |

## Reproduction and evidence boundaries

Use candidate `c8d4a802` and batch59 `2741447`, with the recorded immutable mirrors served identically on4911/4912. The retained source kit contains the snapshot server, both matching adapters, cold/native/ending orchestrators, seeds and analysis scripts. For a fresh public cold candidate observation, use a new output directory and the already recorded baseline directory:

```sh
LOAD_FRESH_BROWSER=1 LOAD_OUT=test-results/r18-repro-candidate \
LOAD_ASSERT=1 LOAD_BASELINE=test-results/r18-release/cold/prod \
LOAD_GAMEPLAY_MS=10000 LOAD_GAMEPLAY_LAST=1 E2E_UNITS=1 \
sh tools/perf/quiet-run.sh node --import tsx tools/perf/cold-load-time.ts \
  http://127.0.0.1:4911 webgl2 low 20 L8
```

Run the baseline first with the same flags except `LOAD_ASSERT=0`, origin4912 and its own fresh output directory if the hardware/delivery environment changes. Never compare a new machine against this Mac’s distributions.

A native repro with a fresh output directory is:

```sh
E2E_UNITS=1 RELEASE_SECONDS=60 RELEASE_PERF_ONLY=1 \
RELEASE_QUALITY=low RELEASE_OUT=test-results/r18-repro-native-L8 \
node test-results/r18-release/run-job.mjs repro-native-L8 \
  node --import tsx test-results/r18-release/native.mjs strips L8 webgpu
```

This requires the same caller-owned mirror servers and matching API files. Rerun the failing remote semantic checks through `npm run qa:invariants:sim:remote`, and the full native threat inventory through `npm run qa:threat:remote`. The retained grouped receipts provide all-level threat verdicts after the unchanged single-host command times out. Watchdog failures and incomplete continuous-campaign coverage remain failures; checkpoint-based ending probes cannot establish the missing campaign handovers.

Public builds compile out per-actor QA submission probes, so their `crowdFigures` drawn count is not used as an actor-visibility verdict. Native coverage uses the real renderer’s frame counter and submitted scene geometry. The separate invariant QA build supplies rendered cast/seat checks.

## Native regression diagnosis

**L4 low:** the qualified native p95 rises16.8→33.3 ms (limit17.8 ms), while maximum rises33.4→50.0 ms. A separate paired diagnostic reproduces the p95 change. Simulation CPU median rises2.2→7.2 ms and p95 rises2.8→19.2 ms. Candidate `HitQuery.cover` accounts for **15.58 s** sampled self time in the minute; stacks reach it through `clearDistance`, `visible`, `sees`, `shotVisible` and civilian notice checks. The candidate also submits median252 vs226 draws and428,515 vs401,501 triangles, but the profile identifies simulation cover queries as the dominant added CPU cost. [Diagnostic summary](native-L4-diagnostic-summary.json).

The destruction rollout appends part blockers to `world.interactables.walls` (`src/sim/destruction/Destruction.ts`), supplied as `HitQuery.dynamicWalls` by `Combat.ts`. `HitQuery` indexes static walls but scans every dynamic wall for each query; rotated footprints add transform work inside `cover`. This explains the scaling bottleneck exposed by the new blocker inventory. Repair needs conservative spatial queries and correct invalidation across part destruction/rebuild; deleting blockers or reducing query/observation scope would change semantics. No such shortcut or acceptance change was made.

**L4 high:** qualified p95 rises16.8→33.4 ms and maximum33.4→66.6 ms. The same dynamic-cover integration is present in both tiers; the paired CPU diagnostic above directly measures low tier.

**L9 low/high:** qualified native maxima rise50→100 ms at low and50.1→83.4 ms at high, introducing≥66 ms hitches. At roughly6.57 s there is no corresponding main-thread long task; late `pal_woodWarm` / `corpse_pal_picketWhite` material builds and alpha LOD bakes occur nearby. Driver/pipeline first-use work is a hypothesis, not a proven single pipeline. A separate profiled replay is retained to investigate the stall; it does not replace the original failing frame.

The L9 diagnostic repeats a≥66 ms hitch at approximately6.53 s (66.7 ms, vs100 ms in the qualified capture). Simulation p95 is2.0 ms, maximum10.8 ms, and there are no long tasks. The nearby late material build includes `pal_woodWarm` (5.5 ms builder work) and `corpse_pal_picketWhite`; the exact driver/pipeline stall remains unisolated. [Diagnostic summary](native-L9-diagnostic-summary.json). This is a larger warmup issue with a retained repro, not a repaired gate.

**L10 low:** the qualified90-second native capture rises33.3→66.6 ms maximum. Its stalled frame ends306 ms into observation; a cluster of material builders runs at232–298 ms immediately before it, without a long task. The specific pipeline remains unisolated. The original helper activates charging and advances120 setup ticks before recording; those original native measurements and their failure remain retained. The event-window qualification was repeated from before console activation, using a release-only helper that walks to the real console and lets ordinary bot input activate it after recording starts. The unexecuted high-tier L10 harness is prepared with the same corrected start. No gameplay clock or counter is reset, accelerated or edited.

## Execution timebox

The check began at approximately08:31:35 UTC on2026-11-09. The three-hour brief timebox was exceeded at11:31:35 UTC while high-tier native coverage was still running. Timebox compliance is **FAIL**. The orchestrator subsequently required closeout within20 minutes and deferred further load/frame work. Sample counts and measured-window thresholds were not shortened; unrun work is marked UNMEASURED. [Closeout receipt](closeout.json) records the final elapsed time.


<!-- native-matrix-start -->
## Native frame matrix

Milliseconds, WebGPU, one matched public-build capture per side and tier. See the comparison rules and coverage limitations above.

| Level/tier | PROD p95 / max | Candidate p95 / max | Verdict / reason |
|---|---:|---:|---|
| L3 low | 16.70 / 16.80 | 16.70 / 16.80 | PASS |
| L3 high | 16.70 / 16.80 | 16.70 / 33.40 | PASS |
| L4 low | 16.80 / 33.40 | 33.30 / 50.00 | FAIL: p95 >PROD+1ms |
| L4 high | 16.80 / 33.40 | 33.40 / 66.60 | FAIL: p95 >PROD+1ms, max >PROD+one frame, new >=66ms hitch |
| L5 low | 16.70 / 33.40 | 16.70 / 33.40 | PASS |
| L5 high | 16.70 / 33.40 | 16.80 / 33.30 | PASS |
| L6 low | 16.70 / 33.30 | 16.70 / 33.40 | PASS |
| L6 high | 16.80 / 49.90 | 16.70 / 33.40 | PASS |
| L7 low | 16.70 / 33.30 | 16.70 / 33.40 | PASS |
| L7 high | 16.70 / 50.00 | 16.70 / 33.30 | PASS |
| L8 low | 16.70 / 183.30 | 16.70 / 50.00 | PASS |
| L8 high | 16.70 / 133.40 | 16.80 / 50.00 | PASS |
| L9 low | 16.70 / 50.00 | 16.80 / 100.00 | FAIL: max >PROD+one frame, new >=66ms hitch |
| L9 high | 16.80 / 50.10 | 16.70 / 83.40 | FAIL: max >PROD+one frame, new >=66ms hitch |
| L10 low | 16.70 / 33.30 | 16.70 / 66.60 | FAIL: max >PROD+one frame, new >=66ms hitch |
| L10 high | — | — | UNMEASURED (deferred) |

### Native event windows

| Event/tier | PROD p95 / max | Candidate p95 / max | Verdict |
|---|---:|---:|---|
| L7 pickup low | 16.70 / 16.70 | 16.70 / 16.80 | PASS |
| L7 first rocket low | 16.70 / 16.80 | 16.70 / 16.80 | PASS |
| L7 pickup through first rocket low | 16.70 / 16.80 | 16.70 / 33.40 | PASS |
| L7 pickup high | 16.80 / 16.80 | 16.80 / 16.80 | PASS |
| L7 first rocket high | 16.70 / 16.80 | 16.70 / 16.80 | PASS |
| L7 pickup through first rocket high | 16.70 / 16.80 | 16.70 / 16.80 | PASS |
| L10 charge through completion +2s low | 16.70 / 50.00 | 16.80 / 66.70 | FAIL |
| L10 charge through completion +2s high | — | — | UNMEASURED (deferred) |

### L10 natural ending through credits

| Tier | PROD p95 / max | Candidate p95 / max | Verdict |
|---|---:|---:|---|
| low | — | — | UNMEASURED (deferred) |
| high | — | — | UNMEASURED (deferred) |

### L10 lamp-boundary recorded-input replay

Each row must exceed100 playable frames, reach x>800 across both lamp boundaries, retain the requested backend, and have no post-card frame above200 ms. These established replays are profiled diagnostics and are excluded from the cold-load distributions.

| Backend/entry | Frames | p95 / max ms | Endpoint x | Verdict |
|---|---:|---:|---:|---|
| webgpu debug | — | — | — | UNMEASURED (deferred) |
| webgpu continue | — | — | — | UNMEASURED (deferred) |
| webgl2 debug | — | — | — | UNMEASURED (deferred) |
| webgl2 continue | — | — | — | UNMEASURED (deferred) |
<!-- native-matrix-end -->

The full low-charge replay proves counter0 and inactive defense at setup, with the recorder starting on that same simulation tick. Its first stored RAF sees counter0 on PROD and counter2 on candidate because the sampler needs a preceding timestamp. The initial partial interval is reconstructed from `firstClockAt - firstFrameDelta` (9.5/28.8 ms) and included in the event statistics; neither is the maximum. The unexecuted high replay is prepared to record this initial partial interval directly. [Charge-start proof](charge-start-provenance.json) records the exact counters/ticks; no early charge time is silently omitted.

## Follow-up lanes

| Lane | Required work / retained repro |
|---|---|
| Load-time regressions | Fix the19 median regressions and first-use WebGL2 warmup hitches. Requalify the full20-cell/800-profile public A/B matrix against unchanged6,000 ms, median-parity and200 ms post-card limits. Execute the deferred L10 lamp replays (`debug` and `continue`, WebGPU and WebGL2). Start from the cold matrix, phase attribution and paired L1 profiles. |
| Frame-time follow-ups | Repair L4 dynamic cover-query scaling with correct blocker invalidation; investigate L9 late material/pipeline stalls and L10 first-charge material builds. Recheck the five failing native cells. Complete L10 high from charge0 through completion+2 s, and both prepared natural ending comparisons. Use the retained matching-version adapters and charge-start helper. |

## Evidence and closeout

Each committed evidence file is below1 MiB; the report and evidence total about10 MB. `cold-*-raw.json.gz` retain every qualified cold sample with original-file SHA-256. `native-*-frames.json.gz` and `charge-full-low-frames.json.gz` retain every measured frame, event clock, proof, hardware identity and scene sample; only redundant recorded bot-input streams are omitted from these compact copies. Complete original receipts, input streams, browser trace ZIPs and large Chrome trace files remain locally under `test-results/r18-release/`, indexed by [local trace inventory](local-trace-inventory.json). They are not committed as large binaries.

[Run ledger](run-ledger.json.gz), [quiet conditions](quiet-conditions.json.gz), [reproduction source kit](repro-harness.tar.gz), [coverage audit](coverage-audit.json), and [file checksums](evidence-manifest.json) support review. The coverage audit intentionally remains incomplete for the eight deferred items; it is not a green full-release certificate. This commit contains report/evidence artifacts only; tracked game/test/tool files and acceptance criteria are unchanged.
