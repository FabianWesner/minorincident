# P01 rigid crowd retirement

Implemented on `lane/p01-rigid-retire`, based on `6363147b2`. Runtime crowd shaders, geometry preparation, Motion Lab crowd previews, bake tools, corpse freezing and picking require skinned v2 data. The rigid crowd branches, placeholder figure, obsolete bake scripts and baseline-validation route are deleted. The existing v2 runner routing remains; no rigid fallback flag was added. Courier contact/toggle retirement (P04) is separate.

## Verification

See [check receipts](checks.json), [retirement audit](retirement-audit.json), and [pixel comparison](pixel-comparison.json). Asset validation has 1,235 rows and zero errors; all 104 default tests, typecheck, lint and the accessory geometry invariant pass. The curated gate keeps all 48 rows: 43 pass and five existing exceptions remain (cane/watering-can/held-prop overlaps and low-tier dog foot sliding). Smoke includes the freeze guard, portable GPU limits on both backends, visible pedestrians, native WebGPU and public-build surface checks. Full command logs are under `checks/`.

## Fixture decision

[Every affected actor and decision](fixture-retirement.json): 22 behavior actors re-pointed, 10 cases deleted. No retired actor appearance was found in campaign spawn selections, story data or layout manifests. The sprinter brain remains in gameplay with v2 appearances assigned by `InfectedSystem.spawn` and L4's authored look list. Unspawned balance archetype definitions are not campaign selections.

| Previous fixture figure | Accepted v2 figure for behavior fixtures |
|---|---|
| elderly aftermath | Mr. Okafor aftermath |
| woman-A aftermath | woman-B aftermath |
| paramedic aftermath | Rosa aftermath (the campaign paramedic) |
| survivor-group Dale / Sam | canonical Dale / Sam aftermath |
| survivor-group cap woman / bun woman | woman-B / Mia aftermath |
| brute / butcher | `inf.alpha`, retaining the original simulation archetype |
| sprinter | `inf.jogger`, retaining the original simulation archetype |

Deleted cases: seven retired actors in the two idle showcases, the old woman-A build-pipeline spin showcase, and cat/crow cases in the cure scene (no accepted v2 counterpart). The now-empty idle-0 spec and its catalog wrapper were deleted; mixed scenes remain. Both curated pedestrian rows retain their existing names and behavior. The [eight retired fixture asset records and their files](fixture-assets-retired.json) were also removed, together with the obsolete aftermath builder and its old asset QA cases. Protected reference PNGs and historical prose remain.

## Pixels and figure preservation

Six scenes, two tiers, 26 sampled frames: 14 pixel-identical; all remaining differences explained, with no tolerance threshold used. The zoo and Mega scenes match exactly. Unchanged-baseline A/A repeats demonstrate existing presentation variation; the high-tier corpse after-frame exactly matches the repeat. The existing last-completed-LOD brow measurement can move a sun-hat pivot by 2.8 mm; held poses in low tier also vary with loading order. Rocket accessory conversion has one-value raster rounding. [Diagnostic crops](diagnostics/) and [captured fitting data](pixels-investigation/) preserve the investigation. A deterministic fitting experiment was reverted; existing authored fits and all campaign figure bytes are preserved.

The [rollout census audit](retirement-audit.json) verifies all ten levels at 100% v2: 63 unique figure identities and 370 shipped figure/coat/LOD files with identical hashes to the baseline. [Source hashes](render-source.json) identify the final renderer. The pixel capture preceded the final fixture-only registry deletions; none of the six pixel scene inputs or their accepted figure assets changed.

## Reproduce and size

Run `npx tsx tools/scenelab/p01-retirement-audit.ts` and `npx tsx tools/scenelab/p01-ab-compare.ts` from the repository root. The latter reads original PNGs and gzip-compressed metrics, reconstructs each full A/A control image from lossless sparse patches, and verifies its RGBA hash. The capture tool uses the shared headless browser pool, seed 1, ANGLE Metal WebGL2 at 1280×720. Use an isolated baseline worktree to repeat the before side; never replace renderer files in a live worktree.

[Removal accounting](removal-stats.json) includes deleted files, source lines and bytes. Shipped assets alone shrink by 63,203,876 bytes across 280 files. Repository totals include source model outputs and the retained pixel evidence; Git history is not rewritten.
