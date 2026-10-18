# Merge batch 10 — final QA

## Outcome

All four requested lanes are integrated in order on `lane/merge-batch10`. This is **not a green deployment gate**. Cold blast and the strict L6 rescue gate are closed; remaining observed failures and unmeasured phases are listed below. No budgets, rescue percentages, zero-death assertions or L5 enemies were weakened. No main merge or deployment was performed.

Production source is `6b96e860a`; `2d587a1f0` subsequently changes only the PO34 test fixture. Both final typecheck and lint pass. The requested macro also passed typecheck, lint and a fresh production build.

## Changes and evidence

- L6 raw movement now respects the authored floor mask, including sliding and crowd push. The strict route waits for the retreat before choosing the gate, avoiding a vacuous empty-follower condition. Final real input rescues **23/29 (79.3%) with zero deaths**, seven photos, a recovered straggler and exact L7 carryover. Shelter-fails readability, minigun touch, L7 keyboard/mouse through L8 and L7 touch pass. L7 input cases do not assert a cohort survival ratio. See `evidence/browser-l6-retreat-gate.log`, `evidence/priority-final/real-handover.json` and `sheets/l6-strict-route.jpg`.
- Scene Lab L6 staging uses authoritative relocation and separates survivors by 1.1 m. The PO34 test uses the same spacing and verifies everyone reached the staging area before interaction. Its original fixture fails all four configurations on main too; the corrected fixture passes **4/4 on candidate and 4/4 on main**, preserving the one-bar/caption/no-meter assertions. This staging correction is not demonstrated to fix the separate side-entry simulation timeout.
- Cold blast loading now prepares combat rendering through the real HDR/MSAA path, pre-renders blast parts, prepares the actual LOD2 corpse pages, and loads the initially resident high-tier LOD0 infected/healthy-zoo batches. Low remains LOD2. Effects and body detail are retained. New `qa-blast-prewarm` and `qa-l6-room-boundary` scenes are in the matrix catalog; both were captured on WebGL2/WebGPU, both tiers and all three zooms. **30/30 focused remote regression tests pass**.

### Cold blast investigation and quiet measurements

| Build | High maximum | Low maximum | Interpretation |
|---|---:|---:|---|
| Main control | 180.8 ms | 79.1 ms | Cold reference |
| Original integration | 290.4 ms | 80.8 ms | Reported regression |
| Pair 1 / plus VFX / plus atmosphere | 181.0 / 162.9 / 164.9 ms | See raw evidence | 290.4 ms does not reproduce consistently at a single lane boundary |
| Resident warm-up fix, first run | 12.7 ms | 26.8 ms | No frame above 34 ms |
| Final quiet rerun | **12.3 ms** | **26.3 ms** | High p95 6.9 ms; low p95 12.1 ms; sim 0.6 / 2.1 ms; no frame above 34 ms |

The diagnostic catches a frozen corpse shader linking at +2025.7 ms, with `getProgramParameter` blocking 139.6 ms. Correcting corpse LOD warm-up removes that secondary-beat spike. A subsequent profile finds no runtime shader links and identifies a later `CrowdView.loadBatch` LOD0 bake/upload; loading those resident batches removes the remaining hitch. The final high cold test explicitly asserts the existing **50 ms E18 hitch ceiling**. Evidence: `perf/gl-diagnostic-before-high.json`, `perf/blast-bisect-and-fix.json`, `perf/final/`, and native logs in `evidence/`. The measurements support these identified cold paths; they do not establish that VFX alone caused the original 290.4 ms sample.

E18 is **not certified globally**: native storm heap remains **547.66 MiB high >400 / 263.78 MiB low >250**. Its frame p95 5.1/6.0 ms and sim 0.2/0.9 ms pass. Exact main heap controls could not run. Raw uncollected cold heap also exceeds 400/250 on both main and candidate; the cold tests do not assert that heap criterion. The latest native batch has **9 passes, one policy WebGPU skip and two weather heap failures**. Actual WebGPU structural captures are not native WebGPU timing parity.

## Remote suites and verification

| Run | Result |
|---|---|
| After pair 1 | **3109 pass / 8 fail / 9 skip**, 3126 total; `evidence/pair1-vitest.json` |
| After pair 2 | **3108 pass / 15 fail / 11 skip**, 3134 total; `evidence/pair2-vitest.json` |
| E24 remote verify | **35 selected pass / 3 fail**, 3097 nonselected skips; newbie rescue, evade protection and side-entry timeout fail |
| E24 browser coverage union | **60/60 pass**, including corrected PO34; `evidence/E24-browser-coverage.json` |
| E26 retry | **34 remote pass, 38/38 browser pass**; native admission exceeds 30 min, exit 124 |
| E30 | **129 selected remote pass**; browser initially 57 pass / 3 fail / 2 skip; health-bar context failure passes isolated retry; touch APC and elephant impact fail on main too |
| E32 | Original SSH loss exit 255; one authorized remote retry fails exit 69, `No user exists for uid 501`; no final verification JSON |

Both paired suites include the early L6 movement fix transferred during sync, rather than claiming a byte-identical bare merge snapshot. The recorded L6 source hashes match final production. Heavy unit/levels/sim runs used the remote runners. Pair-1 complete-bot, foundation timeout and D3 timing failures subsequently pass another candidate run; historical reds remain recorded. Timing variability is not a source fix.

### Remaining candidate failures compared with main

- Continuous L1–L9 and L1–L10 simulations stop at **L7 bus-departure boarding, 1200 simulated seconds**; most carried followers pile at `(-74.4,47)`. Main passes both through real handovers (567.5 / 712.4 seconds wall). These are candidate-only failures; no precise lane attribution is established.
- Newbie L6 **8/29 =27.6% <40%**, evade-only **16/29 =55.2% >30% potentially rescuable**, and side-entry **30-second timeout** pass on main. The side-entry reporter does not show a failed spawn assertion; all six tested requested positions are clear and inside the floor mask. The complete L6 bot passes candidate verify in 1049 seconds versus main 24.3 seconds, indicating a substantial simulation slowdown.
- Pair-2 four-millisecond failures include classic, E3, alpha physical, support, Mega, zoo S1/S2 and S4. Exact main outcomes and values are retained in the ledger. Candidate isolated alpha scheduler is also red at **4.19473 ms**, while main passes. Earlier green timing samples do not erase it.
- Two exact continuous E24 policy main timeout controls remain unmeasured, although both candidate policies pass the selected verify rerun.

For the originally requested eight isolated controls: main is **red** for alpha physical, Mega, zoo S1 and S2; **green** for alpha scheduler, zoo S3, T-E17-02b assets and T-E23-12-kill. Candidate isolated results are four pass/four fail: alpha physical, alpha scheduler, zoo S1/S2 fail; Mega, zoo S3, assets and close kill pass. See `evidence/main-isolated.json` and `evidence/candidate-isolated-vitest.json`.

[Every observed red, including each browser project and every baseline result](red-tests.md) is generated from [the machine-readable ledger](red-tests.json). Five exact main controls are explicitly unmeasured; no Yes/No is inferred for them.

## Requested full gate

Ran the exact macro with **E2E_PORT=3411 SCENE_PORT=3412**, after a fresh build. Smoke passes six selected unit cases and **31 browser cases**. The default actual-WebGPU matrix completes **1144/1146 rows** across both tiers and zoom 0.5/1/1.5. Only high/low `wave3-zoo-routines` at zoom 1.5 fail, both on main too. WebGL matrix separately completes **130/132**, with the same two existing grip-intersection rows. These are small hand/held-prop intersections, not camera cropping.

The final 120-case browser selection was interrupted after the Mac became overloaded and its UID/process services failed. Retained JSON has **47 pass / 1 unexpected / 72 skipped**. The unexpected case is T-E19-23 assisted L1 capture, 900000 ms timeout plus context teardown timeout; exact main control is unmeasured. L4 real-input was operator-interrupted, not an assertion failure. **None of the 12 selected @perf cases ran**; all are skipped. Sixty further functional cases and those 12 native cases remain unrun in this macro. The wrapper's final shell exit is not evidence of gate success.

## Captures opened and visual findings

The exact opened files are listed in [opened-sheets.json](opened-sheets.json). Structural draw/triangle passes do not certify visual readability or native timing.

- **Atmosphere:** 120 raw captures cover all ten levels, both backends/tiers and zoom 0.5/1/1.5. Opened all six L5/L9/L10 comparison sheets for final tint 68e108f24: warm brick with violet foreground at L5; green haze and headlights at L9; blue-to-purple pad at L10. Tint occupies sparse authored patches rather than an entire region. All 120 structural rows pass.
- **VFX:** 32/32 structural rows, WebGL2/WebGPU, both tiers, zoom 0.5/1. Opened all eight configuration sheets and both cover/contact timelines. Cover ray stops at the dumpster, protected health remains intact, low contact has fewer sparks. Fireballs, panels, wheels and fire glow remain in final blast sheets. Late APC/wheels are airborne on main and candidate, so these captures do not certify vehicle stability.
- **Phone/UI:** 84/84 structural rows cover seven scenes, all three zooms, both low-tier phone orientations and backends. Corrected gate recaptures pass 12/12. Opened the four overview sheets, four gate timelines and two full-resolution gate PNGs. The roster/objective overlaps gate guidance; a large injury subtitle further crowds portrait. Main matched capture reproduces the overlap. Manual readability remains red on main despite viewport-edge/state test passes.
- **Wave3:** 16/16 frustum and delayed-load browser cases pass across backends/tiers and zoom 0.5/1; seam cases traverse six seams each. Opened breach, both seam sheets, prop reset and zoo sheets. At zoom 1.5 the main/candidate GPU zoo sheets show distinct figures and props on an open brick pad; the diagnostic reports roughly 2 cm hand/coffee or bag intersections, too small to resolve in thumbnails.
- **New scenes:** opened both final blast and both boundary montages, each high/low at zoom 0.5/1. The boundary courier advances to the room edge then remains there at later samples; green headlamp footprint is visible, with a long high-tier shadow and no low-tier shadow. This local movement probe does not replace the full retreat route. Close blast framing crops peripheral bodies while retaining the blast effects.

Full matrix indices are retained under `matrix/full-gate/`; only selected referenced raw capture folders were copied into this report. The original complete raw matrix is local under Scene Lab test-results. Atmosphere raw captures are under `docs/reports/atmosphere/batch10`; final VFX raw captures are in `vfx-final/raw`.

## Unmeasured and handoff

Mac identity lookup (`No user exists for uid 501`) and process enumeration (`sysmond service not found`) failed. The single remote retry failed with the same host condition. The final native reservation ended without starting tests; all four browser locks were independently acquired nonblocking afterward and released. No further host services were restarted or unrelated processes killed.

Unfinished: exact main controls for two E24 continuous policy timeouts, two storm heap tiers and T-E19-23; E24's 12 native cases; E26 native phase; E30 L8 native phase; E32 completed verify/browser/native phases; remaining full-gate functional cases and 12 L10 native cases. Native WebGPU parity remains a policy/manual skip. Re-run only after UID/process services recover, with a fresh build, browser locks and bounded quiet batches; do not treat previous structural captures as those missing measurements.

Removed both bisect worktrees and the completed main-control worktree with `git worktree remove --force`. Disk recovered from about 10 GB to **33 GiB available**. Related static-collision changes are fingerprint metadata only; no collision geometry/order changes or unrelated churn retained. Protected reference paths and L5 enemy tuning were not changed.
