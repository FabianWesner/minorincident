# s216 — Mega leap landing dust

## Change

The `alpha.pounce` impact now adds a short expanding ground pressure ring, a radial ring of low dust that lives for about 0.8–1.0 s, dark debris flecks, and a procedural cracked-ground decal that fades over 1.35 s. HIGH emits 32 dust puffs and 12 debris pieces; LOW emits 16 dust puffs and two debris particles (the shared burst helper reduces the requested five on LOW). The existing fixed-slot particle and ground pools are reused; emission happens only on the impact event. The existing positional `mega.impact` thud and short camera shake remain in place. Other Mega moves are unchanged.

## Checks

- `npm run typecheck`: passed.
- `npm run lint`: passed.
- `npx vitest run tests/engine/infected-ai.test.ts --configLoader runner`: passed (5 tests).
- `sh tools/remote/run.sh "$PWD" -- npm test`: passed (27 files, 105 passed, 1 skipped, 198.5 s; 150/150 budgeted cases).
- Scene Lab: all eight HIGH/LOW, L4 day/L10 night, zoom 1/1.5 rows passed their configured gates in headless WebGL2. The initial night attempt used an invalid preset and was rerun with `L10-night`.

## Visual captures and washout

[Landing matrix](comparison.jpg) shows frame 130 in all eight settings. I inspected the images: dust now forms a visible grey-brown ring around the Mega in day and night, with a lighter cloud on LOW. At zoom 1 the landing is partly cut off by the authored camera; zoom 1.5 shows the full ring. The earlier before capture at frame 104 showed the faint gold ring and no visible dust; it was too early to judge the peak. Before captures are under `test-results/s216-before-{high,low}` and final captures under `test-results/s216-final-{high,low}`. The crack marks are visible in the earlier comparison; small debris remains difficult to distinguish at this scale. Scene Lab disables shake and the sound was not auditioned.

Across frames 110, 120, 130, 140, 150, 160 and 170 in all eight rows, at most **7.55%** of full-frame pixels brightened by at least 25/255 relative to frame 72. This is a screen brightening proxy, includes actor motion, and does not measure unsampled frames or directly segment washout. The images show the ground remaining visible.

## Commits

Source: `0835a882`, `240e60c2`. The dust uses fixed particle slots, with no new per-frame CPU allocations. Existing positional impact audio and camera shake are reused.
