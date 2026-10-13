# L10-S4 Mega Alpha moves

Implemented E32-AC11/12 through the existing Alpha scheduler and damage resolver. Charge/slam/grab have 0.8/1.0/0.8 s tells, 25/35/30 damage, authored cooldowns and 1.2 s recovery. Grab holds at most 1 s and releases on completion, stagger or death. Specials reject oversized arm envelopes intersecting walls and props; charge sweeps the same envelope. Conventional damage stops at 90% max HP, direct rockets deal 10% max HP and splash deals 2.5%, once per projectile. All boss staggers use the 0.5 s cap and 2 s cooldown, including status and kicked crowd impacts.

Finish review added a crowd-impact regression and corrected the performance fixture: its idle Alpha faced away from the player and never activated a move. The fixture now starts a genuine close chase and requires activations without changing budgets. Its timing tests run in Vitest's serial timing project. `src/assets/staticCollision.ts` matches HEAD; no specs or asset files changed.

## Validation

- `npm run typecheck`, `npm run lint`, `npm run build`: pass.
- Hetzner Mega combat suite: 16 tests pass (nine/ten rockets, real rocket contact, 1000 MG/minigun rounds, floor after rockets, cooldowns, dodge, release and wall clearance).
- Hetzner serial Mega performance suite: 2 tests pass. At 200/100 infected, sim p95 = 3.15/1.41 ms, 4/5 special activations; budgets remain 4/6 ms. See `sim-performance-*.json`.
- Full unit/AI run has an existing `tests/unit/physics-metadata.test.ts` failure: GLB hashes and center-of-mass records for `prop.cure-generator`, `prop.cure-iso-tent` and `prop.cure-mil-fence` differ from unchanged `src/data/pushableProps.ts`. Neither side was edited by this lane. Exact final results are in `validation.txt`.
- Native headless Metal WebGL performance: high/low frame p95 6.2/3.6 ms, sim p95 1.1/0.6 ms, draws 58/46, triangles 1,121,172/215,753, heap 224/97 MiB, infected 200/100. No console errors; 5/4 specials. Every checked E18 budget passes. `performance.json` and `performance-conditions.jsonl` retain counters and quiet-run conditions.

## Visual review and limitation

Six scenes (charge/slam/grab, open and container-adjacent) are registered under `tests/scenes/l10-mega-moves/`. Run via the matrix catalog's `--dir` option, avoiding edits to specifications:

```sh
SCENE_PORT=3479 SCENE_SERVER=preview E2E_UNITS=1 npm run scene:catalog -- --dir tests/scenes/l10-mega-moves --matrix --jobs 1 --backend webgl2 --out docs/reports/l10-mega-moves/webgl2
```

Both backends have 24/24 numeric gate passes, both tiers and zooms 1.0/0.5, including zero bone/prop intersection hits. WebGL sheets were opened: the large red-backed boss, glowing eyes and low courier silhouette remain distinguishable; charge arrows and the slam/grab circles precede active poses; charge stops beside the container without driving the forearm through it. Closest zoom crops the large boss and some markers, as expected for the normal game camera; the courier and near contact remain visible.

**WebGPU visual gate remains unresolved.** Several zoom-1.0 sheets show only the DOM health bar over a blank canvas, although submitted geometry counters and console gates pass. This repeats after a fresh build, page reload, standalone scene and native Chrome. Zoom-0.5 sheets show the boss, courier and tell. `webgpu-baseline/scene.json` removes the Mega and uses a regular Alpha; its opened sheet reproduces the same blank canvas, so the issue is shared rendering rather than evidence of a Mega-specific regression. Numeric passes do not constitute visual approval. The saved WebGPU sheets intentionally retain the failure, and no budget or gate was weakened.

No deployment or merge performed.
