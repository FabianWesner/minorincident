# L4 strict WebGPU frames and L6 five-load retention

Status: investigating. Baseline worktree starts at `4b410697f`; final matched measurements must use the announced batch 13i base. Quiet browser work starts after 15:00 UTC on 2026-10-22.

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
