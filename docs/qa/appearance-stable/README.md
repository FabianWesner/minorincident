# Stable crowd appearance — PO regression, 2026-10-14

The entity seed was stable. `CrowdView` switches knocked-down/dead infected to LOD2, and both human crowds previously cleared the accessory slot at that LOD. `CrowdAccessories` then omitted the selected head piece, exposing the model's authored hair/cap. `StaticCorpses` separately omitted the selected accessory and covered-hair flag when freezing a body.

`resolveCrowdAppearance` now provides the shared model, outfit, head, palette, headwear and accessory identity. Pose, health, quality and LOD do not participate in that selection. Both crowds keep the same accessory slot at every LOD; LOD2 uses the existing <=80 triangle LOD1 accessory. Uniforms retain authored headgear. Settled bodies include the selected accessory in the frozen head part, remove covered authored hair/cap vertices, and keep both its tint and the body's palette indices. Corpse pages distinguish accessory geometry while sharing material programs. No separate animated head draw is kept for corpses. Decapitation still removes the complete head part.

The frozen geometry reader normalizes RGB/XYZ channels on both inputs because the renderer can pad accessory colour/normal attributes to vec4 after a live draw. It preserves indices when merging and removes whole covered triangles from nonindexed sources, preventing face corruption when a triangle mixes colour tags. Cached combinations are disposed with the crowd accessory view.

## Regression coverage

`tests/unit/render/appearance-stable.test.ts` resolves every registered character/infected model for civilian, runner and sprinter submissions through walk, attack, knockdown, get-up, death and corpse states, all three LODs, both tiers and cloned restore records. It compares the entire resolved identity and packed shader channels. The geometry test freezes three hat shapes and replacement hair, checks authored hair/cap removal, exact live/frozen attachment position, shader palette/slot bits, separate geometry pages, <=80 triangle accessories and vec4 padding. Existing appearance and corpse pool tests remain in the validation set.

Catalog scenes `appearance-stable-civilian`, `appearance-stable-infected` and `appearance-stable-hood` exercise explicit civilian hats after infection, seed-selected ordinary infected head pieces, and an authored hazmat hood respectively. Frame 30 applies a heavy nonlethal hit, frame 150 a lethal hit, and frame 240 forces permanent settling through the production infected pool. They trace submitted appearance keys and require visible frozen corpse samples. The matrix runs high/low at zoom 0.5/1/1.5 on WebGL2 and WebGPU; the runner also verifies the actual backend and quality.

## Reproduction

```sh
npm run typecheck
npm run lint
sh tools/remote/run.sh "$PWD" -- npx vitest run tests/unit tests/sim tests/levels --maxWorkers=4
E2E_UNITS=2 sh tools/e2e-lock.sh npm run build
SCENE_PORT=3476 SCENE_SERVER=preview E2E_UNITS=1 npm run scene:catalog -- --matrix --backend webgl2 --filter 'appearance-stable-*' --jobs 1 --out test-results/appearance-stable/webgl2
SCENE_PORT=3481 SCENE_SERVER=preview E2E_UNITS=1 npm run scene:catalog -- --matrix --backend webgpu --filter 'appearance-stable-*' --jobs 1 --out test-results/appearance-stable/webgpu
MI_VERIFY_REMOTE_SIM=1 E2E_PORT=3478 E2E_UNITS=2 npm run verify -- E32
```

This change addresses the supplied shared appearance regression; the existing L10-E2 encounters/terminal/cure/checkpoint implementation remains its AC owner. No spec criterion or performance budget is changed.

## Results and visual review

Typecheck, lint and a fresh production build passed. The final remote render regression selection passed **19/19**. Full remote unit tests finished with **1439 passed, 1 failed, 7 pending**: the unchanged `spatial-contact-cache.test.ts` query-order assertion fails in `SpatialHash`, outside this renderer change. The remote unit/sim/levels sweep had **2685 passed, 14 failed, 9 skipped**: that assertion plus 13 simulation timing failures on a busy runner. E32 verification passed its typecheck/lint/build stages, then stopped at **114 passed, 3 timing failures**: L10 finale 5.922 ms, Mega Alpha audio 5.198 ms and moves 6.775 ms against the 4 ms high-tier limit. Those simulation paths are unchanged. The full deploy gate remains red; budgets and assertions were preserved.

The final [matrix proof](matrix.json) contains **36/36 passing** runs: three fixtures × two tiers × three zooms × two actual backends. There were zero console errors and zero submitted appearance-key changes, with visible settled-corpse samples for every fixture actor. Maximum scene draws were 21 and triangles 154122. Browser automation was headless; WebGL2 used ANGLE Metal. WebGPU was actually selected and recorded by the runner.

I opened the final game-camera contact sheets at zoom 0.5 for all three fixtures on both tiers/backends, and reviewed wider zoom 1/1.5 samples. Standing/get-up frames 30/90, knocked-down frame 60, dead frames 180–240 and settled frames 270–360 keep the same head piece, hair, outfit and colours. The civilian cap, beanie and bucket hat remain attached after settling, with no exposed replacement cap or orange hair. Ordinary infected retain their seed-selected pieces. The hazmat hood presents a yellow back when upright and a dark mask when face-up: the head asset stays the same. Low quality is more faceted, but neither topology nor head identity changes between dead and settled frames. At wider zoom individual hair details are small; close sheets and the submitted-key assertions provide the identity check.

Committed representative close sheets:

- Civilian hats: [WebGL2 high](sheets/webgl2-civilian-high.jpg), [low](sheets/webgl2-civilian-low.jpg); [WebGPU high](sheets/webgpu-civilian-high.jpg), [low](sheets/webgpu-civilian-low.jpg).
- Ordinary infected: [WebGPU high](sheets/webgpu-infected-high.jpg), [low](sheets/webgpu-infected-low.jpg).
- Authored hood: [WebGPU high](sheets/webgpu-hood-high.jpg), [low](sheets/webgpu-hood-low.jpg).

## E18 reference measurements

Final native WebGL2 measurements used headless Chrome/ANGLE Metal, an uncapped 12-second sampling window after warmup, sim samples once per changed tick and garbage-collected CDP heap. [Performance proof](performance.json):

| Fixture | Draws | Triangles | Frame p95 ms | Sim p95 ms | Heap MB |
| --- | ---: | ---: | ---: | ---: | ---: |
| High, 200 living | 66 | 504384 | 6.4 | 0.8 | 58.56 |
| High, 200 settled | 171 | 156895 | 3.6 | 0.4 | 58.45 |
| Low, 100 living | 66 | 106479 | 2.4 | 0.5 | 44.49 |
| Low, 100 settled | 102 | 43026 | 2.8 | 0.3 | 44.39 |

All four fixtures passed the unchanged E18 tier caps (draws 600/300, triangles 1.5M/500k, frame p95 16.7/33.3 ms, sim p95 4/6 ms, heap 400/250 MB). These are reference fixtures on this Mac, not a claim that every level/device passes the complete gate. Performance runs went through `tools/perf/quiet-run.sh` and the E2E lock; each reservation was bounded below 20 minutes, released between batches, with a gap before the next batch. The tool supports `--perf-only` and `--perf-only --corpses` for reproducing both states.
