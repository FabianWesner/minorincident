# s130 scream ring — implementation report

**Status: implementation committed; visual acceptance remains open.** The P2 symptom and baseline were reviewed in the batch 107 report: at L10 tick 6453 the pulse was easy to miss while moving; at L9 HIGH it was a thin pale arc partly concealed by HUD/APC/crowd. The local frame sequence for this change could not be captured or reviewed in this environment, so this report does not claim that the ~0.5 s noticeability requirement passed.

## Change

`Vfx.effect('screamer')` now emits two short, bright violet rings at the scream source, 2.0 m and 2.25 m above local ground, with 2.8 m and 4.8 m maximum diameters. They use the existing pooled wave renderer. The existing low-opacity full-radius ring remains on the ground to show reach. No simulation, zombie stats, or per-frame allocation changed.

## Checks

- `npm run typecheck`: passed (both TypeScript projects).
- `npm run lint`: passed.
- `npm test`: passed locally, 106 tests across 27 files in 83.3 s.
- Required remote `sh tools/remote/run.sh "$PWD" -- npm test`: not run; launcher exited 69 because there is no healthy Hetzner runner. This was infrastructure unavailability, not a test failure.
- Existing `tools/qa/s124-screamer-ground.ts` visual gate: not run. The browser pool failed to bind its local service at 127.0.0.1:4329 (`EPERM`). The legacy lock path also could not run because the sandbox denies `ps` to the GPU guard (`EPERM`); it was stopped before browser launch.
- Consequently, no after frames or contact sheet are included. L9/L10, HIGH zoom 1, WebGL2/WebGPU, movement noticeability, and no-broad-ground-painting remain unverified visually. The cited batch 107 captures provide the before observations only.

## Follow-up required

Run the existing crowded L9 visual gate and capture moving HIGH zoom 1 sequences in L9 and L10 on WebGL2 and WebGPU. Review a compact before/after sheet, retain `tools/qa/s124-screamer-ground.ts` as the broad-ground guard, and update this report with the actual visual result before treating the objective as complete.

## Unrestricted environment recheck

The required remote unit suite passed: 105 passed, 1 skipped across 27 files, 150-case collection, 124.1 s within the 240 s budget. The unchanged s124 broad-ground gate passed on both WebGL2 and WebGPU with no browser errors. Maximum bright-purple pixel counts were 294 and 347 respectively (limit 5,000), across six alternating HIGH/LOW frames at zoom 1.5 per backend. Raw captures and rows remain in `test-results/s124-pulse-{webgl2,webgpu}-none/`. These sparse frames do not establish early noticeability while moving at zoom 1; the before/after sequence and sheet remain open. The earlier infrastructure failures above are historical and are resolved.
