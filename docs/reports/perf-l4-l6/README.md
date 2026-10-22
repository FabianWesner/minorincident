# L4 strict WebGPU frames and L6 five-load retention

Status: runtime fixes, guards, typecheck/lint and the full remote regression suite are green. Native strict and smoke gates remain pending. Matched base `480b44e42` is merged; the single baseline worktree is `/tmp/minorincident-perf-l4-l6-before`. The matched high baseline is recorded; further browser work is held until 16:05 UTC on 2026-10-22.

## Required evidence

| Requirement | Authoritative check |
| --- | --- |
| L4 high and low WebGPU turn, tank and line break each <=50 ms; zero turn node builds; original peak budgets | Unmodified `tests/perf/l4-budgets.spec.ts`, `E2E_RENDERER=webgpu`, Chromium, one worker, `tools/perf/quiet-run.sh`; before and after raw JSON/reporter/conditions |
| L6 original first-five retention <=10% on WebGL high/low and WebGPU high/low | Handoff `l7-lifecycle.spec.ts` fixture: L6/L1/L6/L1/L6, begin and six captures per reading, collected heap/geometry/texture ratios; no alternate warm baseline |
| Guard each runtime fix | Failing baseline and passing candidate unit receipts |
| Remote source regressions | `sh tools/remote/run.sh "$PWD" -- npx vitest run tests/unit tests/levels --maxWorkers=4` |
| Types/lint and smoke | `npm run typecheck`, `npm run lint`; headless browser `--grep @smoke --workers=1` through the browser lock |
| Loading overhead <=1 s, unchanged quality/populations/permanent corpses | Matched loading timings and source/fixture review |
| All work committed | Clean worktree, commit IDs, final evidence hashes |

Handoff before numbers: L4 WebGPU high turn48.5/tank15.3/break204.7 ms and four turn builds; low turn54.5/tank33.6/break54.8 ms and zero turn builds. L6 first-five heap growth: WebGL high9.3041%/low10.5775%; WebGPU high10.5898%/low11.9797%. These are historical receipts until matched measurements are collected on this lane's final base.

## Fix guards and regression receipts

| Fix | Guard | Baseline red / candidate green |
| --- | --- | --- |
| Retired L1 window owner | [lab-window-retention.test.ts](../../../tests/unit/render/lab-window-retention.test.ts) | `lab-owner-guard-red.log.gz` / `lab-owner-focused-green.log.gz` |
| Cached MaterialNode reference | [level-geometry-retention.test.ts](../../../tests/unit/render/level-geometry-retention.test.ts) | `material-reference-guard-red.log.gz` / `material-reference-focused-green.log.gz` |
| Interaction LOD feature graph | [interaction-lod-materials.test.ts](../../../tests/unit/render/interaction-lod-materials.test.ts) | `interaction-guard-red.log.gz` / `interaction-focused-green.log.gz` |
| Rigid actor/collapse feature graph | [entity-assets-lod-materials.test.ts](../../../tests/unit/render/entity-assets-lod-materials.test.ts) | `collapse-guard-red.log.gz` / `graph-caches-focused-green.log.gz` |
| Static placement graph identity | [static-instance-attributes.test.ts](../../../tests/unit/render/static-instance-attributes.test.ts) | `placement-guard-red.log.gz` / `placement-focused-green.log.gz` |

Receipts above are in `evidence/`. All five guards also pass in `candidate-full-remote-95796.log.gz` (439 files / 2,411 tests passed). Runtime changes add no warm-up calls or passes; crowd, corpse, quality and fixture thresholds are unchanged.

## Diagnostic setup

`tools/perf/l6-retention-profile.ts` preserves the original five-load sequence and captures first/fifth heap snapshots. It labels output diagnostic because snapshots perturb allocation/GC; it cannot close acceptance. Compare new retained objects with `npx tsx tools/perf/heap-retainers.ts fifth.heapsnapshot diff.json first.heapsnapshot`.

The same auxiliary tool can run remotely on Linux with headless SwiftShader through `tools/e2e-lock.sh`; this uses no Mac GPU and provides no native timing evidence. `tools/perf/l4-beat-cpu.ts` also attributes the ordinary seeded bot's turn/line-break costs on the remote runner without a browser.

L4 already has optional `L4_TIMING_KEYS=1 L4_CPU_PROFILE=1` diagnostics in its original budget test. Formal timing remains unprofiled. L4's ordinary preset practical strength is 0.12, so its normal hero-light update does not switch to the night spot; an unmeasured stable-night-list edit is not justified.

## CPU-only baseline attribution

The ordinary seed 2 bot replay on runner `94.130.181.173` reaches exactly the handoff's high turn 1969/break 13370 and low turn 1979/break 13380 ticks. In this diagnostic, the tick after the alarm spends 28.217 ms high / 7.042 ms low in `Outbreak.update`; turn checkpoint capture is 5.214 ms high, and line-break capture is 7.144 ms high / 3.052 ms low. These inclusive Node timings identify CPU work to trace; they neither explain the native 204.7 ms hitch nor prove a frame-budget pass. Raw method/tick rows and provenance are in `evidence/baseline-cpu-*`.

## L6 owner fix

The remote WebGL low diagnostic reproduces first-five heap growth from 53,818,944 to 59,784,672 bytes (+11.085%). The fifth snapshot reaches retired L1 resources through `GameView.labWindows`, which survives reset after the accident effects are disposed. Its callbacks retain the old loading closure and window meshes; the retained L1 light field alone contributes 69,960 visibility array/backing-array nodes (1,399,200 shallow bytes) plus its parent arrays. The path census, code/group comparison and snapshot hashes are preserved in `evidence/baseline-remote-heap-*`; these are reachability/shallow counts, not dominator retained sizes.

Reset now disposes the window target's three private materials, clears its mesh set and drops `labWindows`, including when the accident effects already retired. The guard fails on the baseline's remaining owner reference and passes with the fix; all five focused window/accident tests pass. No prewarm is removed, no extra loading is introduced, and native acceptance plus the full regression gates remain pending.

The window-only candidate (`3e064e268`) reduces the same remote diagnostic to +9.6254% (53,831,616 -> 59,013,128 bytes), but its fifth snapshot still retains L1 through another root: Three r186's module-level `MaterialNode._propertyCache`, specifically the cached `alphaTest` reference node's last `reference` material. The archived node-property inspection confirms `property: alphaTest`, `material: null` and the retired palette material reference; its `outputFor` closure owns the old Lighting. The shortest path is rooted through Three's animation callback/module context, independently of GameView's now-cleared window owner.

Renderer unload now clears the observed cached material references after retiring its render objects and contexts. The shared property nodes and shader keys remain intact; Three's ordinary `NodeFrame.updateNode` rebinds the next material even in the same frame. This second guard fails before the fix and all 11 focused lifecycle/material/buffer tests pass after it. Typecheck and full lint pass. Native retention and loading comparisons remain pending.

## L4 interaction graph reuse

The auxiliary remote WebGL high trace sees a new `pal_static-colors` interaction graph after the alarm, in addition to streamed district graphs. InteractionView rebuilt equivalent feature graphs for each asset/LOD, unlike DistrictAssets. It now passes an owned graph cache to the existing `staticBatch` helper; its complete feature key preserves different surface/window/emissive inputs. A failing baseline identity guard now passes, verifies exactly one disposal of the shared material, and the four-file focused run passes five tests. Typecheck and lint pass. This is a candidate fix pending the authoritative native timing run. No LOD/count/quality or measurement changes and no additional warm-up were introduced.

The original-base full remote suite passes 436 files / 2,393 tests (three files / nine cases skipped by the existing suite), with its complete log archived. The orchestrator announced matched base `480b44e42` (lane/batch13i); both native sides will use it.

The lifecycle fixture is copied byte-for-byte from handoff runtime `f0fb391fb` because batch 13i still contains the older three-load L5/L7 fixture. Both matched trees use this exact five-load fixture with the original 10% assertions. This restores the handoff measurement; it does not adopt the later seven-load diagnostic.

Both owner fixes (`df69c9550`, remote WebGL low diagnostic) reduce first-five growth to **5.20185%**, from 53,920,572 to 56,725,440 bytes. The repeated L1 visibility array/backing-array excess is gone from the root-path census. Geometry 283 -> 274 and texture 70 -> 71 remain within the original bounds. Snapshot hashes, readings and census are archived as `owners-fixed-remote-heap-*`; native WebGL/WebGPU acceptance remains pending.

EntityAssets has the same per-prototype graph duplication, including L4 glass and crater spawned by `detonateFuelTruck` at line break. The same existing feature cache now spans its rigid actor prototypes and LODs. Its separate red/green identity/disposal guard covers the bus, glass and crater across all three LODs. All 12 focused graph/cache/equivalence tests pass; typecheck and lint pass. Both shader-cache changes introduce no new loading calls or warm-up passes. Matched native timing is still the acceptance gate.

Matched full ordinary-bot traces (remote WebGL high, runner `2.28.24.66`) confirm the cache changes remove three actual cold graphs: the medkit LOD after the alarm, and military-truck body/window LODs near collapse. Builds fall from eight to five: three early convoy NPC graphs and two detached district warm-up graphs remain. The remaining district graphs are being attributed; these traces make no native frame claim.

The detailed baseline trace attributes the two district builds exactly: their output graph and every public uniform node match the resident material, and only `positionNode` differs. The transform is a new identical attribute-only Fn for each copied source material. StaticInstanceAttributes now shares the ordinary and yaw-only corpse transform nodes when the source has no custom deformation; custom source transforms retain the original path. The failing baseline guard now passes, checks matching shader keys and independent placement buffers, and keeps corpse/custom-deformation graphs distinct. All 16 focused placement/palette/normal/lifecycle cases pass; typecheck and lint pass. No additional load or warm-up work is added.

Final auxiliary turn trace (`95796daca`) confirms no new graphs after tick 1700; only three early convoy graphs remain. The native wrapper archived as `evidence/run-strict.py.txt` checks exact fixture hashes, captures per-job conditions/reporter/proofs, and runs each job serially through quiet-run after 15:00 UTC. Separate load-only high/low WebGPU observations use the same production warm-up with no frame-budget claim; low retains 4x CPU throttling. The remote warm-up durations were noisy and are not used to certify loading overhead.

## First matched native receipt and revised admission window

At 15:08 UTC, quiet-run admits the matched `480b44e42` high WebGPU baseline (host load 1.52; no other headless Chrome/local Vitest; all four slots held). The unchanged strict test reproduces **turn 54.4 ms / four builds, tank 10.8 ms, line break 99.7 ms**. War p95 is 9.4 ms and sim p95 2.4 ms; counts/budgets are in the complete JSON. Its raw reporter, frames, log and conditions are committed as `quiet-before-l4-high-*`.

The orchestrator subsequently holds new browser runs until **16:05 UTC**, because acceptance lanes now end at 16:00. The queued low attempt gained admission while the hold was being coordinated and was interrupted; its log is explicitly excluded from measurements and it will be repeated after 16:05. The orchestration process and all browser processes belonging to this job are stopped. The amended wrapper enforces 16:05 at startup; first-window wrapper bytes remain in commit `ecfa9eb31`. The current full remote candidate suite continues alone after stopping superseded suites that encountered contention/timeouts.

The CPU-only replay repeated with production `warmL4Alarm` reaches the same high/low beat ticks. Inclusive high turn/next-tick/line-break `SimWorld.update` costs are 18.740/34.667/29.234 ms, and low costs 6.807/11.474/10.979 ms on runner `94.130.181.173`. These are method-instrumented Node diagnostics, not native frame times or acceptance. Typecheck and lint pass in the same remote invocation; the full rows and command provenance are archived as `warmed-cpu-*`.

The final required remote command on runtime source `95796daca` exits zero on runner `2.31.10.108`: **439 files / 2,411 tests pass**, with the existing three files / nine tests skipped. All five new fix guards pass inside this full run. Duration is 3,247.17 seconds. The complete log and source/command provenance are archived as `candidate-full-remote-95796.*`; native strict and smoke gates remain pending until the browser hold ends.

Repeated matched low baseline is admitted at **16:05:10 UTC**, load 1.27, with no other headless Chrome/local Vitest and all four slots held. It reproduces the strict failure: **turn 59.0 / tank 53.9 / line break 52.5 ms**, zero turn builds, sim p95 6.1 ms against the original 6 ms limit. The ordinary peak retains 48 infected / 20 civilians / nine surviving soldiers. Complete proof/reporter/conditions and hashes are archived as `quiet-before-low2-*`; the interrupted first-window low run remains excluded.

First matched candidate (`95796daca` runtime) high is **strict green**: turn 42.3 / tank 10.5 / line break 21.1 ms, zero turn builds, sim p95 2.4 ms, and unchanged high draw counts (352/317). Low improves to turn 54.1 / tank 34.7 / line break 41.6 ms and sim p95 5.3 ms, but **still fails the literal 50 ms turn limit** with zero turn builds. All other low assertions pass. Both complete candidate receipts are archived as `quiet-first-candidate-*`; the remaining low CPU hitch is being profiled, and this is not claimed as acceptance.
