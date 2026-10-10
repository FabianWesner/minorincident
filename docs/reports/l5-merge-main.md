# L5 merge onto current main

Merged `lane/e23-l5-finish` (`af4bf120`) into `lane/l5-merge-main`, based on main `2396fe41`. No deployment, push, or merge to main.

Resolved all 17 conflicted files. Retained main's L1 collider-clearance recovery, search escape, corgi facing limits, E26 bot/props, L3 checkpoint boom and E28 weather. Combined these with L5 layouts, bot, audio, survivor/campaign flow and the Metro shutter; instancing supports both rotating gate arms and sliding shutters.

Integration fixes: weather now composes with L5's gloom; ash does not receive snow's extra sun dimming. A deeper rose shadow tint preserves the sunset under ash accumulation. All four recognition cameras pass the unchanged >30% image-difference gate (plaza 78.31%, Harbor 34.34%, Metro 67.23%, Kessler 42.54%). Props honor explicit spawn/remove flags and retain displaced location/identity when no reset flag is authored; fixtures explicitly select those contracts with their original assertions. Two L3 setup timeouts match the existing dedicated fixture's 120 seconds; gameplay and performance assertions are unchanged.

The existing high/low L5 pair-plaza perf fixture now also verifies E28-AC10: authored ash is active, particle counts are positive and stay within the original 20k/6k caps. E23 frame, draw, triangle, hitch and L4-relative budgets are unchanged. No new edits to specs or protected reference directories; spec changes in the merge are inherited from the L5 lane.

Typecheck, lint and build pass. Final E23 verification exits 0: 31 focused remote tests, 33 browser checks and both perf tiers pass. Production L5 audio is 26.6 LU quieter than L4 (minimum 18). Remote unit/sim passed: 188 files, 909 tests (nine skipped, including the two excluded batteries below). The initial combined browser run had 24 passes and two failures: a WebGPU outbreak strike precondition flake (passed unchanged on rerun), and L5 recognition (fixed and passed). Smoke passed six Vitest checks and 26 browser checks. Focused prop/barricade checks passed 27/27; campaign 15/15; gate checks 6/6.

Remote unit/sim selection excludes only the two tests titled `20 seeds` in `tests/sim/missions/l2-ride-clearance.test.ts`, respecting the prohibition on long bot batteries; the static clearance check remains selected. The unqualified full-suite and initial unit/sim attempts were stopped when those batteries were discovered. E23 keeps its existing single-seed complete/newbie checks.

Commands: `E2E_PORT=3392 npm run -s test:smoke`; levels/outbreak under `tools/e2e-lock.sh`, Chromium, one worker; `sh tools/remote/run.sh "$PWD" -- npx vitest run tests/unit tests/sim --maxWorkers=4 --testNamePattern '^(?!.*20 seeds)'`; `MI_VERIFY_REMOTE_SIM=1 E2E_PORT=3394 E2E_SLOTS=1 npm run verify -- E23`.

Final native-GPU perf (quiet host, one worker; low uses 4× CPU throttle):

| Tier | p50 / p95 / max (ms) | Plaza / follow draws | Plaza / follow triangles | Ash particles |
| --- | --- | --- | --- | --- |
| High | 5.2 / 7.4 / 22.4 | 214 / 217 | 469184 / 469456 | 1750 |
| Low | 13.5 / 19.5 / 51.2 | 148 / 148 | 276197 / 276197 | 525 |

The first high-tier run had a 116 ms frame and failed its unchanged 50 ms hitch gate. The added weather snapshot was reduced to one state read and compact output; an isolated recheck and the complete final verifier both passed. A single observed long task does not establish its cause. Final proof is in `test-results/epics/E23/{checks,vitest,playwright-headless,playwright-gpu,recognition,audio-l5-vs-war}.json` and `perf/l5-{high,low}.json`.
