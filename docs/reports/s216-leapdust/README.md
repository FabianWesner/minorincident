# s216 — Mega leap landing dust

## Change

The `alpha.pounce` impact now adds a short expanding ground pressure ring, a radial ring of low dust that lives for about 0.8–1.0 s, dark debris flecks, and a procedural cracked-ground decal that fades over 1.35 s. HIGH emits 32 dust puffs and 12 debris pieces; LOW emits 12 and 5. The existing fixed-slot particle and ground pools are reused; emission happens only on the impact event. The existing positional `mega.impact` thud and short camera shake remain in place. Other Mega moves are unchanged.

## Checks

- `npm run typecheck`: passed.
- `npm run lint`: passed.
- `npx vitest run tests/engine/infected-ai.test.ts --configLoader runner`: passed (5 tests).
- `npm test`: passed locally (27 files, 106 tests, 157.0 s; 150/150 budgeted cases).
- Scene Lab: all eight HIGH/LOW, L4 day/L10 night, zoom 1/1.5 rows passed their configured gates in headless WebGL2. The initial night attempt used an invalid preset and was rerun with `L10-night`.

## Visual captures and washout

[Comparison](comparison.jpg) shows frame 104, before and after, HIGH and LOW day. I inspected it: the after image adds dark curved crack lines around the Mega, but the dust and debris do not read clearly at this camera scale; the existing gold ring remains the dominant impact. This does not establish the requested heavy dust read. Captures for all eight rows are under `test-results/s216-{before,after}-{high,low}`. Scene Lab disables camera shake, and the sound was not auditioned.

At frame 96, the fraction of full-frame pixels brightened by at least 25/255 relative to frame 72 ranged from 1.039% to **1.928%** across the eight after rows. This detects broad brightening but includes actor motion and is not a direct washout mask; other frames remain unmeasured.

## Commit and remaining

Source commit: `0835a882`. Visual acceptance remains open: the comparison does not show a convincing heavy dust ring, and the washout measurement samples only one landing frame. Iterate the presentation and inspect the complete matrix before claiming the brief complete.
