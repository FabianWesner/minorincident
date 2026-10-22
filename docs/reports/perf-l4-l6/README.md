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

L4 already has optional `L4_TIMING_KEYS=1 L4_CPU_PROFILE=1` diagnostics in its original budget test. Formal timing remains unprofiled. L4's ordinary preset practical strength is0.12, so its normal hero-light update does not switch to the night spot; an unmeasured stable-night-list edit is not justified.
