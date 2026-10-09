# L2 gate and reveal hitches

## Change and cause

Lane: `lane/l2-gate-hitch`. No deployment. Limits, CPU throttle, populations, camera route and content are unchanged.

CDP sampling of the low-tier gate approach reproduced a **56.6 ms** gate frame (reveal 36.7 ms). The worst frame spent approximately 39.6 ms in rendering, including 23 ms in Three node graph construction, and 11.3 ms in simulation. Static batching was absent from this gate recording. Temporary node-builder timing identified the river bridge and police SUV/sedan as the expensive first-visible meshes: their main-pass graphs cost approximately 11–14 ms each; shadow graphs cost 1–2 ms.

The streamed warm-up compiled against the canvas instead of the HDR scene pass. Correcting the target alone did **not** fix it (gate 44.9–56.9 ms in diagnostic runs). Three r186 additionally omits render call depth in `compileAsync`: compilation requests depth 0, while the scene pass renders inside the post-processing quad at depth 1. `RenderContexts` includes depth in its key, and `RenderObject` includes the resulting context ID in its shader cache key. The same mesh therefore received different warm-up and gameplay node graphs.

`GameView.warmHidden` now compiles through `PostFx`, using its actual HDR/MSAA target, MRT, working color space, scene lights and nested render depth. A scoped compatibility shim adjusts context lookup only during synchronous render-list collection. The target and all renderer state are restored immediately for streamed compilation, before its promise settles. Tests cover both completion and rejection and verify context lookup restoration. No permanent node-builder instrumentation remains. The compatibility shim depends on Three r186 internals and should be reviewed when upgrading Three.

The corrected diagnostic run measured **36.9 ms reveal / 37.3 ms gate**. The expensive main-pass builds disappeared; only three shadow builds of 1.4–2.4 ms remained. Draw calls (239), triangles (379,761) and populations (30 infected, 24 civilians, six firefighters) matched baseline.

## Measurement conditions

Native headless Google Chrome, ANGLE Metal, unchanged T-E20-20 framing. Low tier: Pixel 7 portrait, DPR 1.5, 4× CDP CPU throttle. High tier: desktop, DPR 1, no throttle. One worker per timing case.

`tools/perf/quiet-run.sh` reserves both browser lock slots `.0` and `.1` throughout each timing case. Immediately before launching each case it checks `uptime`/one-minute load **< 3** and `pgrep -fil 'chrome.*headless'` for **zero processes**, waiting and retrying if busy. Case conditions are logged by `tools/perf/l2-headroom.ts` to each run's `conditions.jsonl`. The case-insensitive check also catches native Google Chrome's capitalized executable path.

Baseline gate load: 1.72. Final diagnostic load: 2.49. All other before/after loader and neighbor measurements likewise checked load < 3 and zero other headless Chrome immediately before launch. Final neighbor loads (L1 high, L3 high, L1 low, L3 low): 2.44, 2.66, 2.57, 2.24. Final loader/attack loads (L1→L2, L2→L3, station): 2.00, 1.88, 2.15.

The first headroom attempt passed both original tests but failed the stricter tool: high reveal 46.8 ms at load 2.20; low reveal/gate 36.9/37.6 ms at load 2.90. This attempt is retained in `headroom-attempt-1`; it does not count toward consecutive acceptance.

A second attempt passed its first pair, then stopped on high reveal 47.2 ms in pair two (load 2.19); its low cases stayed below 38 ms. Retained in `headroom-attempt-2`. A diagnostic high reveal capture subsequently measured 37.4 ms at load 1.94: its longest frame included vehicle ground sampling and a small static-batching slice, with no expensive node rebuild. These high-tier outliers remain visible in the evidence; no limits or timing setup were changed to obtain passing runs.

**Final acceptance: three consecutive low/high pairs passed**, including every unchanged 10% headroom check in `tools/perf/l2-headroom.ts` (six original native cases, zero failures).

| Pair | Tier | One-minute load | Reveal max (ms) | Gate max (ms) | Median / p95 (ms) |
|---|---|---:|---:|---:|---:|
| 1 | high | 1.73 | 36.9 | 13.1 | 6.4 / 9.2 |
| 1 | low | 2.45 | 35.5 | 35.8 | 23.8 / 29.9 |
| 2 | high | 2.44 | 36.6 | 11.5 | 6.1 / 8.9 |
| 2 | low | 2.41 | 37.0 | 37.3 | 23.3 / 29.0 |
| 3 | high | 2.07 | 36.2 | 13.7 | 6.3 / 8.9 |
| 3 | low | 2.65 | 36.8 | 37.1 | 24.4 / 30.2 |

Before every case: zero other headless Chrome processes; both browser slots reserved. Low-tier worst reveal/gate across the six-case sequence: **37.0 / 37.3 ms**, below the requested 45 ms. Draw calls stayed 239 on both tiers; triangles stayed 1,054,679 high / 379,761 low. Populations remained 32/43/6 high and 30/24/6 low (infected/civilians/firefighters).

## Neighbor frame comparison

Same ten-second real-clock samples at the game camera, seed 2, before/after. These are representative samples at mission start, not complete-route worst-case claims.

| Level/tier | Baseline median / p95 (ms) | Final median / p95 (ms) |
|---|---:|---:|
| L1 high | 5.2 / 7.5 | 5.2 / 7.5 |
| L1 low | 18.8 / 34.2 | 18.9 / 33.8 |
| L2 high rescue peak | 6.2 / 8.9 | 6.1–6.4 / 8.9–9.2 |
| L2 low rescue peak | 23.9 / 29.2 | 23.3–24.4 / 29.0–30.2 |
| L3 high | 4.0 / 6.8 | 4.0 / 6.7 |
| L3 low | 15.4 / 29.0 | 15.6 / 29.2 |

Additional controls used a separate baseline bundle with the original `GameView`/`PostFx` from `20fd69d8` (all other code unchanged), served on port 3399. Fresh L2 baseline median/p95 were 6.2/8.9 ms high and 24.1/29.3 ms low. Final L2 medians/p95 overlap these controls, with up to 0.9 ms p95 spread between low runs.

L3 low was repeated because one control pair showed baseline 15.6/28.9 ms versus final 15.8/32.5 ms. A reversed-order pair then measured **baseline 15.8/32.3 ms versus final 15.5/31.4 ms**, demonstrating comparable p95 variation on the old build. Across all three samples, baseline/final medians were 15.4–15.8 / 15.5–15.8 ms, and p95s 28.9–32.3 / 29.2–32.5 ms. No consistent median/p95 regression was found in these samples; they are not a statistical guarantee for every route or Mac load. All controls passed their original cases, including the old L2 low gate in the fresh control (40.7 ms).

## Other requested hitch measurements

Low tier, same native renderer/throttle. Loader diagnostics call the actual `loadLevel` path after the source level is loaded, retain loading-screen frames, await target rendering and include a two-second tail. They do not model result-screen input or background warm-up timing in production menus (`test=1` awaits warm-up synchronously). Station attack uses ordinary completion-bot inputs to acquire the handgun, then the real clock through attack start plus two seconds.

| Event | Baseline maximum (ms) | Baseline frames > 50 ms | Final maximum / count |
|---|---:|---:|---:|
| L1 → L2 loader | 5,374.7 | 89 | 384.1 / 87 |
| L2 → L3 loader | 4,941.3 | 86 | 471.8 / 86 |
| L3 station attack start | 85.4 | 6 | 77.9 / 4 |

Final loader elapsed times including the tail were 16,235.2 / 16,626.6 ms, versus baseline 21,458.5 / 21,297.4 ms. The station-window maximum occurred at tick 557, before attack at tick 567; the first recorded frame after start was 25.9 ms and the post-start tail peaked at 51.5 ms. Baseline post-start maximum was 85.4 ms.

These loading/attack hitches remain above 50 ms and are reported separately from the L2 gate fix. No criterion was weakened.

## Validation and visual review

- `L2_HITCH_PROFILE=1 sh tools/perf/quiet-run.sh npx playwright test tests/perf/l2-budgets.spec.ts --project=chromium --workers=1 --grep '<tier>$'`: diagnostic runs capture CDP profiles around reveal and gate; optional profiling is off for acceptance.
- `npm run typecheck`: pass.
- `npm run lint`: pass.
- `sh tools/sim-lock.sh npm run test:unit -- --maxWorkers=2`: 111 files / 393 tests pass on the final runtime change (45.55 s).
- `sh tools/sim-lock.sh npx vitest run -t @smoke --maxWorkers=2`: five files / six tests pass; 176 files / 921 tests skipped (final rerun 20.72 s).
- `npx tsx tools/perf/l2-headroom.ts`: six cases pass across three consecutive pairs. The tool itself invokes the quiet lock wrapper for every tier.
- `sh tools/perf/quiet-run.sh npx playwright test tests/perf/l2-neighbor-budgets.spec.ts --project=chromium --workers=1 --grep '<level> <tier>'`: four cases pass.
- `sh tools/perf/quiet-run.sh npx playwright test tests/perf/campaign-hitches.spec.ts --project=chromium --workers=1 --grep '<event>'`: three cases pass.
- Under `E2E_SLOTS=2 sh tools/e2e-lock.sh sh /tmp/l2-gate-functional-final.sh`, `E2E_PORT=3396 npx playwright test tests/e2e/levels/L1.spec.ts tests/e2e/levels/L2.spec.ts --project=chromium --workers=1`: **5/5 pass** on the final build (3.7 min), including real-input play and immediate L3 handoff with carried loadout.
- Under the same single-slot wrapper, `E2E_PORT=3396 npx playwright test --grep @smoke --workers=1`: **25/25 pass** (2.3 min), across desktop/mobile Chromium and WebKit.
- Baseline controls: `E2E_PORT=3399 sh tools/perf/quiet-run.sh npx playwright test tests/perf/l2-budgets.spec.ts --project=chromium --workers=1 --grep '<tier>$' --config=test-results/baseline.config.ts` (two cases), and `L2_PERF_PHASE=<control/repeat-before/after> ... tests/perf/l2-neighbor-budgets.spec.ts --grep 'L3 low'` (four additional cases): all pass. Baseline config/bundle were temporary; final bundle served on 3396.
- `npm run scene -- tests/scenes/qa-l2-gate-hitch.json --tier low --out test-results/epics/E20/perf/gate-scene-final`: 120 frames pass, console errors / undrawn frames / clipping all zero. Main/shadow draws 12/11; triangles 36,470/30,886. All three game-camera captures reviewed: bridge, water, cars, windows, beacon bloom and lighting intact. Final rerun also passes with the same counts/gates; all three final captures reviewed.
- Baseline/final native low collapse captures reviewed side by side: same geometry, materials, lighting and content, with expected timing differences in crowd poses. No visual change at the game camera observed.

Timing evidence, CDP profiles, screenshots and JSON reports are under `test-results/epics/E20/perf/` (ignored generated artifacts). Long multi-seed bot batteries were not run, as required by the lane rules.

## Limits and remaining work

No spec changes or forbidden shortcuts. The requested L2 gate/reveal headroom is achieved. Loading frames and the station attack window still exceed 50 ms as reported above. Two high-tier reveals exceeded the stricter 45 ms tool headroom in earlier attempts (46.8/47.2 ms), while staying within the original 50 ms gate; the final three-pair sequence passed unchanged. WebGPU is not available in native headless Chrome on this Mac, so GPU validation here covers the actual measured WebGL2/Metal path. The same compile-context shim is used on WebGPU but requires manual GPU review under repository policy.

## Commits

- `84d8654c`: optional gate CDP recording and campaign hitch diagnostics.
- `6debc025`: main's two-slot browser lock update.
- `5d4d4d17`: quiet timing preflight and per-tier headroom execution.
- `51d0a3bd`: stream compilation through the HDR scene pass; state restoration unit coverage.
- `24cc8296`: correct nested scene-pass context depth, remove temporary instrumentation, add isolated bridge/car Scene Lab fixture.

- Final report/profiling commit: records the three-pair acceptance evidence, controls, remaining hitches and optional reveal CDP capture.
