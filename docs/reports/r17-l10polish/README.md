# R17 — L10 browser visual repairs

**PASS — all seven requested visual repairs are implemented, captured and reviewed.** Scope: the seven failures in the `r17-l10polish` lane brief, reproduced from the [original QA poses](../qa-browser2/L10.md) and ending saves. No specification changes.

## Changes and visual review

| Fix | Cause and repair | Reviewed sheet |
|---|---|---|
| Hangar interior | The shelter's authored roof was merged into `body`, so the existing interior cutaway had no roof assembly to hide. Preserve the `roof` joint in all three model tiers; rebuild the model and its collision receipt. The terminal, canister and occupants remain visible from the specified interior pose; the exterior roof returns. | [PASS · Hangar](hangar.jpg) |
| Barn lettering and graves | Bind the HELP decal and its supporting slab to the actual barn roof health/collapse state, including checkpoint restoration. Move all three crosses beyond the east eave. Review shows three crosses beside the intact roof and no floating lettering after collapse. | [PASS · Barn](barn.jpg) |
| Panorama | Normal lighting updates overwrote the cinematic fog range. Keep fog and haze clear during the pullback, increase camera far range and preserve depth precision with a proportional near plane. Hide the redundant detailed terrain layer in the map view. The 55–60 s shots now show roads, the level footprint and landmark buildings. | [PASS · Panorama](panorama.jpg) |
| Ending geometry | Prepare an instanced building footprint LOD for the complete district; retain distinctive farm, campus and dispersal silhouettes at LOD2. Enter it before the transient pullback peak, skip minor dressing, and cull actors once subpixel. Restore normal visibility for the closing shot. Counters are measured on every rendered ending frame, including transitions and credits. | [PASS · Ending budget](ending-budget.jpg) |
| Closing composition | Space the named survivor tableau and the cured console crowd; place courier and corgi on the clear apron. Fit portrait cameras and view the closing cast from the side clear of foreground vessels. Continue the pullback from that same pose to avoid a camera turn at 50 seconds. Extend staged ground and road context. The full console and separated cast are visible. | [PASS · Closing cast](closing-cast.jpg) |
| Sparse farm | Continue the southern crop edge around `(858.66,-93.68)` with a tractor, fence and scarecrow. Add broken crop strips beside both authored and direct walking lines through 1250–1750 and 3050–3650. Try the opposite verge when a building occupies the first side. Keep crops out of the mown center and solid footprints. | [PASS · Farm](farm.jpg) |
| Propane placeholder | Replace the box with a grounded rounded cylinder, feet, protective collar and transverse valve. Integrate all three LODs in the asset manifest. Asset validation and browser captures show the pressure vessel without a placeholder warning. | [PASS · Propane](propane.jpg) |

## Capture method and provenance

`capture.ts` uses the existing SceneSession/browser pool: one headless context at a time, Metal WebGL2 or explicitly selected WebGPU, one 600-second reservation per command, preview port 4351. Landscape is 1280×720; portrait is 720×1280. Each photographed state is paused and captured at game zoom 1 and 1.5. Cinematic cameras own their framing, so those zoom pairs can be identical.

Environment fixtures load real seed-42 L10, protect and teleport the courier to the reviewed poses, and keep normal follow-camera framing. Barn collapse damages the real placement parts; the separate grave captures wait for the opening caption to expire. The propane fixture spawns the actual hazard beside the courier. These fixtures establish appearance, not gameplay difficulty.

Ending runs resume the original quality-specific QA pre-release saves and the actual carried L9 roster save retained in `seeds/`. The production completion bot releases the cure, then detaches; the ending runs on the natural clock through credits and return. Captures cover 0–60 s every five seconds, title, credits and thanks. A separate accelerated default-save replay is only an appearance control. Geometry maxima include **every rendered frame**, not just photographed timestamps. This is a draw/triangle budget check; no FPS or quiet frame-time claim is made.

Each compressed run receipt retains source revision/diff, seed hash, producer hash, screenshot path/hash, actual backend and quality, camera, simulation tick and measured geometry. `sheets.json` maps each retained full-frame thumbnail to its original capture and SHA-256. Raw full-size JPEGs are temporary local captures under `/private/tmp/r17-l10polish/`; the seven compact sheets are the retained visual evidence. `sheets.py` regenerates them while those raw files remain available. `audit.py` checks matrix completeness, counters, roof/decal state, asset tiers, route source and artifact hashes.

## Verification

- `npm run verify -- E32` — **PASS**: typecheck, lint and the shared unit suite (107 tests / 27 files). `test:unit` aliases this same unit command. [Gate receipt](E32-checks.json), [full log](validation.log.gz).
- `npm run build:qa` — **PASS**. [Build revision and bundle hashes](build.json), [build log](build.log.gz).
- Both changed assets validate at LOD0/1/2; the shelter retains a semantic roof at every tier and the propane vessel is grounded. [Validation](assets-validation.json), [GLB hashes and bounds](asset-contracts.json).
- **504 screenshots in 21 retained run receipts**, including twelve natural ending replays and one accelerated default-save appearance control. Actual backend/quality checks pass; no captured runtime errors or environment placeholder warnings.
- **Seven reviewed sheets**, with 78 selected full-frame thumbnails. [Screenshot provenance](sheets.json). `python3 docs/reports/r17-l10polish/audit.py` — **PASS** ([receipt](audit.json)).

### Every-frame ending geometry

Maxima include all 53,707 rendered ending frames plus paused zoom captures. Low limits are **300 draws / 500,000 triangles**; high limits are **600 / 1,500,000**. All rows pass. The budget sheet labels photographed frames; the table below reports the full-run peaks.

| Save | Tier | Renderer / aspect | Max draws | Max triangles | Rendered frames |
|---|---|---|---:|---:|---:|
| Carried L9 | low | WebGL2 / landscape | 209 | 201,998 | 4,505 |
| Carried L9 | low | WebGPU / landscape | 209 | 201,998 | 4,506 |
| Carried L9 | low | WebGL2 / portrait | 209 | 166,989 | 4,497 |
| Carried L9 | high | WebGL2 / landscape | 215 | 273,545 | 4,454 |
| Carried L9 | high | WebGPU / landscape | 215 | 273,545 | 4,457 |
| Carried L9 | high | WebGL2 / portrait | 215 | 241,213 | 4,432 |
| Original QA | low | WebGL2 / landscape | 209 | 236,652 | 4,509 |
| Original QA | low | WebGPU / landscape | 209 | 236,652 | 4,505 |
| Original QA | low | WebGL2 / portrait | 207 | 190,783 | 4,496 |
| Original QA | high | WebGL2 / landscape | 232 | 367,155 | 4,455 |
| Original QA | high | WebGPU / landscape | 232 | 367,157 | 4,453 |
| Original QA | high | WebGL2 / portrait | 230 | 262,637 | 4,438 |

### Runner route

`sh tools/remote/run.sh "$PWD" --pull test-results/l10-pacing -- node --import tsx/esm tools/qa/l10-pacing.ts` — **PASS**, remote runner `2.31.170.171`, seed 42. Both tiers complete with all six finds. [Runner receipt](route-runner.json.gz).

| Tier | Outcome | Simulated seconds | Deaths | Finds |
|---|---|---:|---:|---:|
| low | complete | 1152.02 | 5 | 6 |
| high | complete | 1120.43 | 1 | 6 |

### Source scope

The ending captures, QA build and final shared gate use `b669e3cd`. Environment captures use `8141565a`; the runner uses `08441757`. Subsequent source changes are confined to five camera-parameter lines in `src/render/LevelTenEndingView.ts` (three lines after the environment captures). The audit verifies those source diffs and the runner's exact content hash. Assets are separately checked against their retained GLB hashes.

Regenerate the sheets with `python3 docs/reports/r17-l10polish/sheets.py` while the raw capture files are available. No specification changes.
