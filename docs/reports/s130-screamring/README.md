# s130 — readable screamer source warning

The screamer now emits two short violet rings above its source, while retaining the faint full-radius ground ring. In the reviewed L9/L10 HIGH zoom 1 scene-fixture sequences on WebGL2 and WebGPU, the source cue is visible at 100 ms and conspicuous at 200 ms while the courier moves and attacks. The [reviewed before/after sheet](contact-sheet.jpg) shows 50, 100, 200, 400 and 500 ms. The previous effect is a faint ground arc; the new local strokes remain distinct from red melee warnings, yellow objective lines and gunfire. The road retains its surface colour.

## Implementation and cost

Only `Vfx.effect('screamer')` changes game rendering: two 2.8/4.8 m diameter, 20 cm stroke rings at local ground +2/+2.25 m, lasting .34/.42 s, violet opacity .92/.82. The existing far ring remains unchanged. This is a pair of simultaneous expanding rings, not delayed emissions.

Both use the existing 16-slot `waves` pool. `FxPool` already renders all 16 instances in one draw, with GPU growth/fade. The change adds two spawn/opacity writes per scream and local ring fragments; no new draw, render pass, shader, geometry, texture, pool, or per-frame allocation. This bounded structural cost supports the negligible-cost assessment; no isolated GPU timing claim is made. Simulation, zombie stats and corpse persistence code are untouched.

## Evidence and method

Extended the existing `tools/qa/s124-screamer-ground.ts` with optional dense sequence capture. Run under the headless browser lock, one browser at a time, private port 4998, default 10-minute reservation:

```sh
SCREAM_SEQUENCE=1 SCREAM_COMBAT=1 SCENE_PORT=4998 L9_BACKEND=webgl2 E2E_UNITS=1 sh tools/e2e-lock.sh npx tsx tools/qa/s124-screamer-ground.ts
```

Omit `L9_BACKEND` for WebGPU. `SCREAM_TIER=low` and `SCREAM_ZOOM=1.5` select the other views. Raw frames and metadata are retained in `test-results/s130-sequence-<backend>-none-<tier>-<zoom>-combat/`.

These are controlled scene fixtures, not uninterrupted playthroughs: L9 uses its crowded late-APC save and existing screamer, unlocks the APC floor only in QA setup to permit normal vehicle exit, and places the courier near the source. L10 uses the dispersal-console save and spawns one standard catalog screamer because that save has none alive. A deliberate call to the production visual effect provides repeatable timing; normal movement and held attack input then advance simulation. The baseline substitutes the pre-change effect for every scream, including native crowd screams. No zombie stats are modified. HIGH zoom 1 records two combat attacks in L9 and one in L10 per half-second comparison; source and player transforms are recorded in JSON.

The first dense WebGPU implementation exposed async character-pipeline errors when replacing worlds in one context. Fresh contexts for each comparison resolved those errors; the final harness collects errors from every context. An early overlapping dev-server teardown also caused an aborted worker load; the accepted captures are sequential clean reruns.

## Validation

- Typecheck (both projects) and full lint passed after capture-tool changes.
- Required unchanged remote suite passed: 150-case collection, 105 passed / 1 skipped, 27 files, 124.1 s within 240 s. Local suite also passed earlier.
- Existing s124 broad-ground gate passed WebGL2 and WebGPU, six alternating HIGH/LOW zoom 1.5 frames per backend, zero browser errors. Maximum bright-purple pixels: 294 / 347 against the 5,000 limit (old broad ground patch: 190,108).
- HIGH zoom 1 before/after movement-and-combat sequences reviewed on both levels and backends, with zero browser errors. Contact sheet is the sole committed image; JSON is below 200 KB.

The attached JSON contains the final matrix results and completion status. No deployment, push, or main-branch move occurred.

Final matrix: all eight backend × tier × zoom runs passed with zero browser errors, covering L9 and L10 before/after in each run. I reviewed the 100/200 ms after views for HIGH/LOW × zoom 1/1.5 on both backends: the violet local cue stays readable in every combination, with no broad ground fill. Each comparison records normal attacks and nonzero courier movement from 50 to 500 ms (avoiding initial teleport displacement). Scene-fixture visual acceptance is complete within the method limits above.
