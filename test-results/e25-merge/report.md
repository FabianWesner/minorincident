# E25 lane integration

Merged `lane/e25-e27-gates` (`cb1ad739`) into the isolated `lane/e25-merge` branch based on main `75b6ad9f`.

## Resolutions

- `GameView.ts`: one shared warm-up closure preserves foreground frame yields, background pacing, progress reporting and the chunked/solo driver warm-up. The lane's daylight fire/light-field variant uses that same closure. The automatic merge retains prepared transition caches, asset prefetch, shared roof materials and phone district LOD preparation before shader warm-up (`41b57aa2`).
- `pre-render.test.ts`: retain both suites and their Three imports, including active-light preservation and chunk/solo warm-up restoration.
- `vite.config.ts`: retain the separate light-anchor chunk and both character animation JSON files in the existing character-clips chunk.

## L6 readability fixture correction

The original setup spawned its three eye subjects before advancing 30 simulation ticks, allowing allied shots to cross the sample or kill a subject. Render-only settling alone still failed one eye sample (red dominance -42; `l6-readability-first.json` and `l6-readability-first-metrics.json`). The final setup advances the same ambient scene first, then spawns the three subjects while paused and advances only the render clock by 0.3 s, beyond the muzzle/tracer lifetime of <=0.2 s. No simulation tick runs between spawning and the canvas/mask samples. Added guards require living subjects and zero foreground aim-cue opacity. All mask, contrast, lighting, red dominance and hue thresholds are unchanged; no gameplay code changed for this fixture fix.

## Validation

- `npm run typecheck`, `npm run lint`, `npm run build`: passed; no build warning.
- `sh tools/remote/run.sh "$PWD" -- npx vitest run tests/unit --maxWorkers=4`: 497 passed across 137 files; exit 0 (`remote-unit.log`).
- Node smoke: 6 passed (`smoke-sim.log`). Browser smoke: 26 passed, no skips/flakes (`smoke-browser.json` / `.log`).
- L1 + L2 specs and crowd-visible-outbreak: 6 passed, 1 failed after the single permitted retry, no skips/flakes (`levels-crowd.json` / `.log`). Both crowd checks, unassisted L1, L1 Continue, L2 real-input/photo route and L2→L3 handoff passed.
- The sole failed case is T-E19-23 at `L1.spec.ts:198`: the assisted fixture finds no systemic pedestrian transformation. A fresh detached build of unchanged main `75b6ad9f` reproduces exactly the same failure (`baseline-l1.json` / `.log`, `baseline-l1/error-context.md`). The temporary worktree was removed. Assertions and mission behavior were retained.
- L2 phone performance: passes on the allowed retry, reveal **46.0 ms <=50 ms**, gate close **46.3 ms <=50 ms**, peak p50 **24.8 ms**, 224 draws / 399,890 triangles (`phone-final.json`, `phone-perf.log`). The first attempt measured reveal 65.9 / gate 71.7 ms and overlapped this job's static check for the newly requested L6 fixture edit; it is retained in `phone-first.json`. Playwright reports the check as flaky. The retry ran after that static check finished, with both browser slots still held. This preserves E25's removal of the 85 ms reveal hitch within the requested 50 ms limit; it is not a claim of improving on the lane's 37.5 ms measurement.
- Added request, L6 T-E24-15: **2 passed**, no skips/retries/flakes (`l6-readability.json` / `.log`). Shelter contrast **5.299:1**, tunnel contrast **7.489:1**; every sampled infected is alive, foreground aim cue opacity is zero, hero shadow is on, and all six eye maxima satisfy the unchanged red-dominance/hue bounds. Final canvas/mask PNGs and metrics are in `l6-readability/`. Typecheck and lint passed again after the fixture edit.

Browsers are headless; Chromium functional runs use Metal, one worker, at most one retry. Production preview ports 3385–3388 isolate this worktree and its temporary main comparison. Timing uses the lane's quiet-run wrapper, which reserves both e2e-lock slots and requires load <3 with no other headless Chrome or local Vitest. No deployment, push, or merge into main.

The requested integration gate remains red due to the reproduced main L1 assisted-capture failure; this report does not claim epic closure or full acceptance.
