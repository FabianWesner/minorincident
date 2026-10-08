# E04 Survivor Controller and Character Presentation — complete

2026-10-05. Branch `lane/e04-epic`; current main `0907b9c` merged (already up to date). No E17 registry exists on that main revision.

## Built

- Rapier kinematic capsule, radius 0.35 m / total height 1.4 m; acceleration 36 m/s², braking 54 m/s², sweep/slide collision and 720°/s movement facing, immediate aim-hold facing.
- Tick-owned health/i-frames/regeneration, death event and 120-tick checkpoint respawn. Player death preserves level-owned pickup/objective records. Crowd circles use live sim transforms, soft push-out and a 0.2 m/s forward escape floor; the final Rapier sweep preserves static-wall collision.
- Supplied female/male GLBs, all 19 rigid nodes, +X facing, sim-timed procedural idle/walk/run/hurt/die/swing/shoot/throw/kick/interact/enter-car clips. Validated code capsule/head/arm fallback for unavailable or invalid art. Cumulative gear tiers 0–4 preserve red-top/teal-bag identity.
- Existing E02 palette shading reused for imported detail swatches. Bruno Player.js intent/pre-physics and pose/post-physics split adapted; existing View.js focus/follow code reused; notice retained in THIRD_PARTY_NOTICES.md.
- Normal entry loads the survivor; `?survivor=male` selects male. The earlier `empty` and `lookdev` fixtures retain their cube simulation/presentation so existing baseline tests and goldens remain meaningful.

## Validation

All commands exited **0** after merging main and reviewing the whole diff; no warning lines in the saved logs:

| Command | Result |
| --- | --- |
| npm run typecheck | 0 |
| npm run lint | 0 |
| npm run build | 0; both GLBs bundled |
| npm run test:unit | 24 passed; 1 existing optional preview-page test skipped because this tracked-files-only lane has no preview directory |
| E2E_PORT=3315 npm run test:smoke | 1 sim smoke + 12 browser smoke passed (Chromium, four mobile orientations, WebKit) |
| E2E_PORT=3315 npm run verify -- E04 | 12 Vitest passed (11 E04 + 1 smoke), 16 browser passed (4 E04 + 12 smoke), no failures/flakes |
| Earlier E01–E03 tagged sim tests | 4 passed |
| Earlier E01–E03 tagged browser/visual/perf/input tests | 66 passed; existing goldens unchanged |

Vitest/Playwright each capped at 4 workers; all browser runs used lane port 3315. No server started on 3300. No deploy, push, .env access, or new dependencies.

Every E04-AC01–11 has a passing tagged test; `acceptance-audit.json` maps each criterion to its actual passing result. AC01–07 use exhaustive/fixed-step headless tests, including 200 directions ×150 ticks against the wall ring, tangential wall speed, exact timer boundaries, checkpoint retention and twelve-circle anti-pin. AC08 parses both real GLBs and validates both placeholders. AC09's 3612-tick browser input bot visited all eleven states with zero sim/view mismatches and zero missing clips. Additional browser coverage verifies physical keyboard wiring, cosmetic selection and repeated unload returning GPU/native resources to baseline.

## Visual and performance evidence

- `character-sheet.png`: female/male four-view sheet; `review.md`: all 3 Character must and both should items PASS. `compare/character-reference.png` pairs the supplied concept rows with in-game renders. Both GLBs were visually inspected, including baseline gameplay captures.
- `*-tier-0..4-*.png` and exact ID masks: identity colors sampled within the torso/backpack region in every tier; shoes/skin/ground cannot satisfy the red-top sample. Tier 0→4 changed **31.45% female** and **21.56% male** of baseline character pixels (>5% required), restricting differences to the character-mask union.
- Heights: female 1.41019 m, male 1.39852 m; both placeholders 1.40000 m. Head fractions 0.29743 female / 0.26075 male, within ±10% of the approximately 0.285 reference fractions.
- 3600-tick sim reference with 12 crowd circles: **0.020333 ms p95**, below 4 ms desktop high budget.
- Tier-4 WebGL reference counters (including shadow rendering): **female 182 draw calls / 111,475 triangles**, **male 140 / 116,115**, below 600 / 1.5M desktop budgets (also below 300 / 500k low-tier counter limits). Both variants loaded; 161 geometries / 5 textures while loaded. After unload, no entities/bodies/colliders/listeners; only one renderer-owned fullscreen shadow geometry remains and repeated cycles stay at the same geometry/texture baseline.
- `sim-perf.json`, `gear-colors.json`, `animation-bot.json`, `dimensions.json`, verifier `checks.json`, JSON result files and logs contain the measured evidence. Paused-frame FPS and SwiftShader bot timings are instrumentation/CPU-renderer observations, **not** real-GPU frame-time claims; E18 owns that hardware gate.

## Integration contract

`SimWorld.player` exposes Player damage/act/setCheckpoint/select; E05/E06 own attack resolution, E07 supplies readonly crowd-circle transform references, and E12/E13 own level pickup/objective mutation. `EntitySnapshot.survivor` is plain serializable state. The query-gated test API is additive version 1.2.0: `survivor.select(variant, tier=0)`, `damage(amount)`, `act(action)`, `checkpoint({x,y,z})`. Photo spots front/right/back/left/gameplay and the existing idPass setting drive deterministic evidence. Contracts are documented inline; the epic text is unchanged per the instruction not to edit specs except incorrect criteria.

## Deviations and known issues

No acceptance criterion was changed or weakened. No E17 registry was available to reuse; GLTFLoader + MeshoptDecoder load the supplied assets directly in this slice. Gear below integrated uses the permitted code placeholders. Crowd AI, weapons, campaign progression and the corgi remain with their owning epics; tests exercise E04's crowd geometry and retained level records through those integration points.

No known E04 functional defects. The supplied hero meshes retain the existing art reports' simplified hair/clothing folds; gear attachments are intentionally simple pending integrated gear art. This Character checklist pass does not replace E17 final art-production sign-off.

## Commits

- `92f71d1` kinematic survivor, health lifecycle and tagged sim proofs.
- `bcf15a6` GLB presentation, complete clips, gear, browser/visual tests and source review.
- Final documentation commit records done status, this report and the verification evidence (see branch HEAD).


## Courier animation correction — 2026-10-07

Lane `lane/player-anim-r1`, integrated main `745e83f6` in `fd1a3560`. Implemented in `f8c7f76f`, `9560c3eb`, `ca68bf9a`; harness `b5b2464a`/`500c9a22`; curated evidence `51d46995`. The round-one courier mesh/skeleton remains. Corrected backward torso pitch and spine counter-rotation, relaxed/counter-swinging arms, running cadence, knee anticipation, bike root transfer and held-weapon stow through dismount. Main's arrival stability, bike-frame orientation and repeated-evaluation behavior remain covered.

Final validation: typecheck/lint pass; full unit 291 passed (86 files); E04 52 unit/sim + 30 browser passed; bicycle/arrival/combat 10 passed; skin-off and skin-on smoke each 6 sim + 23 browser passed. Zero failures or browser flakes. Exact commands, skip counts, measurement methods and logs are in the [lane report](../../../../docs/reports/player-anim-r1.md) and [validation JSON](../../player-anim-r1/validation.json).

Walking minimum chest pitch changed from −17.65°/−16.58° (female/male) to +2.91°; steady run is 9–11°. Tests cover both variants' idle/walk/run/start/stop/90°/180° turn chest/head pitch. Highest isolated skinned CharacterView p95 is 0.132 ms. [Game-camera evidence](../../player-anim-r1/README.md) includes 14 paired comparisons, 20 L1 stills and four 6–10.75 s WebM videos; the updated vision review is in `review.md`.

No specification edits or weakened criteria. This follows the PO-authorized round-one fitted-skin direction, not the abandoned avatar lane. Remaining limitations: brisk short-legged running, four-tick knee windup, blended rather than authored leg-over-bike motion, and existing strap stretch in extreme bat poses. Manual WebGPU and PO motion review remain. No push, merge into main or deployment.
