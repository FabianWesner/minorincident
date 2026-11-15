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

## Reviewed HIGH zoom 1 moving comparison

The [contact sheet](contact-sheet.jpg) contains matched before/after frames at 50, 100, 200, 400 and 500 ms for L9 and L10 on WebGL2 and WebGPU. I reviewed the full sheet and the full-size L9 100 ms after frame. By 100 ms the two violet strokes identify the source; at 200 ms they are conspicuous above the APC/crowd in L9 and above the screamer in L10. The baseline has only the faint ground arc. The local cue stays distinct from the yellow objective outline and red attack indicators. The road retains its surface colour throughout these sequences.

Method: `SCREAM_SEQUENCE=1 SCENE_PORT=4998 L9_BACKEND=webgl2 E2E_UNITS=1 sh tools/e2e-lock.sh npx tsx tools/qa/s124-screamer-ground.ts` (omit L9_BACKEND for WebGPU). One headless browser, isolated contexts, HIGH zoom 1. Scene fixtures use an existing L9 screamer; the dispersal-console L10 save has no living screamer, so the tool spawns one standard catalog screamer. Courier placement and a deliberate visual scream provide repeatable framing; normal movement input advances the simulation. Baseline mode applies the previous VFX to every native scream too. No zombie stats are changed. This is controlled scene-fixture evidence, not a native scream playthrough or a fighting acceptance sample.

Both backends completed the comparison. Courier start-to-end displacement is 6.39 m in the crowded L9 fixture (includes collision resolution after placement) and 2.00 m in L10. WebGPU initially produced asynchronous character-pipeline errors while rapidly replacing worlds in one context; isolated contexts resolved this, and the final run collected zero errors across all comparisons. Raw frames/metadata remain under `test-results/s130-sequence-{webgl2,webgpu}-none/`. Typecheck and full lint passed for the capture extension.

Remaining scope: explicit LOW/zoom-1.5 local-cue review, moving-and-fighting coverage, and performance measurement are not established by this sheet. The main HIGH zoom 1 visual comparison is now reviewed; full task acceptance remains open for those requirements.
