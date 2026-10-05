# E17 asset conformance follow-up

The four requested groups have no remaining findings in `../validate-production.json`.

| Group | Before | After |
| --- | ---: | ---: |
| Forward marker not on +X | 67 | 0 |
| Missing LOD | 46 | 0 |
| Unknown `pal_*` material | 97 | 0 |
| Degenerate triangle | 62 | 0 |

The original audit contained 140 slots. The current audit contains 163: main added thirteen standalone exports after E17's manifest snapshot, including five hero assets. Those exports are now registered and processed as well. All 76 standalone sources produce optimized runtime GLBs. Of 42 standalone hero chains, 14 use their supplied LOD pairs and 28 generate LOD pairs.

## Changes and reproduction

Run `npm run assets:optimize -- --production`, `npm run assets:bake-crowd -- inf.common-worker`, then `npm run assets:validate -- --production`. The production audit now inspects the processed `public/assets/models` outputs, while `sourceGlb` records the original export input. The full audit command still exits 1 for the other findings below; the conformance unit test checks that the requested four groups are empty.

Most forward findings were missing markers. Source scripts declare +X and the manifest records that direction in `sourceForward`, without editing their build scripts. The optimizer adds missing front markers and rotates the complete assembly for measured alternate cardinal directions. The scene records normalization to avoid double rotation; named joint-local transforms, sockets and pivots survive optimization. Vehicle markers retain their existing front-wheel names.

Generated LODs use gltf-transform simplify at .12/.03, with a meshoptimizer clustering fallback for disconnected-panel topology floors and a minimum face for small material/rigid parts. Supplied LODs are optimized at ratio 1. All original `assets/*/model*.glb` files and build scripts are unchanged. Geometry cleanup runs before and after quantization, measures triangle area in world units, and prunes unused buffers. Runtime exports total approximately 59 MB.

The canonical palette adds 60 exported material colors, recovered from their linear base-color factors into sRGB. Both runtime palettes and Blender's existing JSON reader use these tokens. `specs/03` has no palette table, so no spec edits were needed.

Visual review caught an existing crowd shader ordering bug: NodeMaterial's position override was applying part transforms to already-instanced positions. Crowd positioning now uses `instance * part * raw geometry`, with matrix-buffer version updates retained for movement. The shared GPU probe checks five clip times and four headings, including translated instances.

## Validation and visual review

- Typecheck, lint and production build pass.
- Full unit suite: 21 files, 50 tests pass.
- `test:smoke`: 3 unit tests and 12 browser tests pass.
- `verify -- E17`: 24 selected unit tests and 21 browser tests pass.
- Targeted preview/E04/crowd suite: 8 browser tests pass.
- Browser runs use `E2E_PORT=3319`, two workers, and one run at a time.
- Crowd: 100 instances, 8 materials, 8 draw calls; maximum GPU pose error is recorded in `summary.json`.

Reviewed the game-camera captures of the female survivor, civilian woman, red sedan and bench: the face/grille/seating front faces +X, silhouettes and palette separation remain recognizable, and no geometry corruption is visible. Survivor LOD1 keeps the silhouette and identity colors; LOD2 is visibly coarse at this close inspection scale and intended for distant screen sizes. The crowd image shows assembled characters after the shader fix. E04's keyboard-direction test verifies a movement/facing dot product greater than .99; its input bot, cosmetic variant and unload tests also pass. Survivor art remains status-gated to the existing code rig during normal gameplay.

## Remaining limitations and deviations

None of the four requested finding groups remains. The full audit has 500 other findings, listed per asset in `other-findings.json`: dimensions, absent/empty animation nodes and stump-cap contracts, plus budgets. These source/manifest contract issues repeat across LODs and were outside this pass.

Generated density exceptions are recorded in `generated-lods.json`. LOD1: bathrobe neighbor 15.1%, screamer 17.14%, sprinter 15.58%, teen skater 15.16%. Bus-stop LOD2 is 7.02%. The simplifier's geometry/error limits and preservation of small separate material parts prevent further reduction under the chosen settings; no LOD is missing.

There is no E09 driving runtime or driving suite in this checkout. Vehicle verification covers exported +X orientation, preserved named parts and preview appearance; an in-game driving check cannot run here.

The initial existing unit integration test invoked Blender and rebuilt the fire-engine twice before its behavior was noticed. Subsequent runs use the committed export with a mocked exporter, exercising the actual optimizer, staging, determinism and exporter-error handling without further art rebuilds. The export-only production batch never invokes Blender. No reference images or protected reference directories were edited.

Main was fast-forward merged at `5e3a23d` before implementation, then its pickup update `0dd9607` and riot-cop update `5abf93c` were merged before completion. No dependencies or spec files were changed.
