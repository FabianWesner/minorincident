# Merge main into the approved slim lane

Parents: slim `146de330b`; main `b0aac03dd99be27e63c9737edc7de0c4759e7ea1`.

## Binary resolution

The six conflicts were resolved by regenerating the main repairs on the slim exports:

- **Q-269, `932e60f1f`:** run main's `courier-male-shirt-clean.py --hem-only` on the slim `model.skin.glb`. The enclosed-texel pass was already applied in the source baseline and must not be repeated. The hem repair repainted **2,903 texels**; a subsequent dry pass finds **zero** remaining candidates. Compress that source into both skin quality deliveries with main's `courier-tex-compress.ts`.
- **Q-274, `aafbd7c24`:** rebuild male tier gear from the repaired **slim body**, using main's `assets/acc.courier-gear/build.py` for LOD0, LOD1 and LOD2, then compress each delivery. This preserves main's current tier-4 painter and applies the updated tier-3 shoulder-rim painter in both tiers 3 and 4. No female asset was regenerated.
- The main builder also includes the Q-268 inner-rim projection from `9c7c3ade9`; rebuilding against the slim body retains that fix instead of transferring an old rim blindly.

[Asset audit](asset-audit.json): the slim source's complete accessor arrays and node matrices are exact, including positions, normals, UVs, weights, indices and inverse bind matrices. The recompressed delivery body is within **0.000887 mm** of the old slim surface. All three gear LODs retain the named rig and have inner contact offsets at most **3.0 mm**, below the unchanged 20 mm attachment limit.

[Painter check](painter-check.json): 10,000 varied rest positions/normals produce exactly `#e8892c` over the flat rim band, with **zero** grain or baked top-light variation. Natural runtime lighting remains enabled.

## Comparison capture

The production skinned male player, not a source stand-in, is captured at game zoom **1.5** and **0.5**, quality **high** and **low**, gear tiers **0–4**, front/side/three-quarter. Each comparison sheet uses three rows: main, approved slim before merge, combined repair. Rows use a common pixel scale. Baseline GLBs are supplied through exact browser request responses from the two Git parents, on the same merged runtime and with the same camera, pose, lighting and seed; this isolates the asset change.

A further 90 views exercise the actual LOD2 gear delivery through the production player, comparing both parents and the combined repair at every tier and both zooms. The runtime normally selects LOD0/high or LOD1/low; the LOD2 comparison explicitly substitutes that delivery for the gear URL.

Only `ambient-gpu-life` is omitted in these isolated asset crops: its drifting petals crossed the shirt in the initial probe. No garment, gear layer, body surface or rig part is hidden. The renderer, runtime material lighting and camera are unchanged.

## Reproduce

```sh
python3 tools/assets/courier-male-shirt-clean.py assets/char.courier-male-skin/model.skin.glb --hem-only
node --import tsx tools/assets/courier-tex-compress.ts assets/char.courier-male-skin/model.skin.glb public/assets/models/char.courier-male.skin.glb
python3 tools/blender/run.py assets/acc.courier-gear/build.py --variant male --out docs/reports/slim/merge/raw
node --import tsx tools/assets/courier-gear-compress.ts docs/reports/slim/merge/raw/acc.courier-gear.male.tiers.glb public/assets/models/acc.courier-gear.male.tiers.glb
node --import tsx tools/assets/courier-gear-compress.ts docs/reports/slim/merge/raw/acc.courier-gear.male.tiers.low.glb public/assets/models/acc.courier-gear.male.tiers.low.glb
node --import tsx tools/assets/courier-gear-compress.ts docs/reports/slim/merge/raw/acc.courier-gear.male.tiers.lod2.glb public/assets/models/acc.courier-gear.male.tiers.lod2.glb
node --import tsx tools/slim/audit-merge.ts
python3 tools/slim/check-merge-painter.py
MI_BROWSER_POOL=1 SCENE_PORT=4872 node --import tsx tools/slim/capture-merge.ts
python3 tools/slim/merge-sheets.py
python3 tools/slim/audit-merge-crops.py
```

## Visual verdict

**PASS: all 270 original crops and all 43 sheets personally reviewed; no new P1 defect found.** [Coverage](coverage.json), [sheet verdicts](visual-review.json), and [one description per original crop](visual-crops.json). All 334 other approved slim exports remain byte-for-byte exact to the approved lane; main’s female gear deliveries and repair scripts remain exact to main. The public-build copies of all five male deliveries match the repaired exports exactly ([receipt](public-delivery.json)).

The combined result keeps the clean white hem from Q-269 and the flat orange shoulder edging from Q-274 on the slimmer body. At tiers 2–4 the vest covers most of the undershirt; tiers 0–1 explicitly expose the repaired shirt. Orange sleeves remain orange. The darker pad centres retain their texture; only the orange rim excludes baked grain/top light. Runtime lighting is preserved.

LOD2 retains the intentionally polygonal distant-LOD gloves, pads and vest seen in both parents. Its forced close views expose that simplification; they show no newly detached layer. The production player normally uses high/low gear. The idle attachment probe improves from **1.6 cm** maximum in either parent to **1.4 cm** in the combined result, inside the unchanged **2 cm** limit.

| Sheet | Front | Side | Three-quarter | Verdict |
| --- | --- | --- | --- | --- |
| [detail-high-tier0](sheets/detail-high-tier0.jpg) | Combined white undershirt hem is clean like main; pre-merge slim retains the orange hem intrusion. Slim limb and waist outline retained. | Backpack and shoulder strap retain the slim-parent placement; no new stand-off at the shirt side. | White panel reaches the diagonal strap cleanly; bag and arm outline retain the approved slim build. | PASS |
| [detail-high-tier1](sheets/detail-high-tier1.jpg) | Clean shirt retained with gloves and kneepads on the slimmer body. | Glove/cuff fit follows the wrist and the pack follows the back. | Knee and wrist shells are attached; white hem and diagonal strap remain distinct. | PASS |
| [detail-high-tier3](sheets/detail-high-tier3.jpg) | Shoulder pads have consistent orange edging; neutral elbow pads and belt remain fitted. | Orange shoulder rim has no new stripe or flare; vest and elbow contacts remain close. | Main rim treatment is retained on the slim shoulder shape, with clear dark pad centre. | PASS |
| [detail-high-tier4](sheets/detail-high-tier4.jpg) | Vest and orange shoulder rims remain fitted to the slim torso; pad centres retain their dark texture. | Shoulder rim and elbow contacts are close; no added detached lip or orange grain stripe. | Flat shoulder edging is distinct from the orange sleeve; vest, belt and glove placement remain coherent. | PASS |
| [detail-low-tier0](sheets/detail-low-tier0.jpg) | Combined white undershirt hem is clean like main; pre-merge slim retains the orange hem intrusion. Slim limb and waist outline retained. | Backpack and shoulder strap retain the slim-parent placement; no new stand-off at the shirt side. | White panel reaches the diagonal strap cleanly; bag and arm outline retain the approved slim build. | PASS |
| [detail-low-tier1](sheets/detail-low-tier1.jpg) | Clean shirt retained with gloves and kneepads on the slimmer body. | Glove/cuff fit follows the wrist and the pack follows the back. | Knee and wrist shells are attached; white hem and diagonal strap remain distinct. | PASS |
| [detail-low-tier3](sheets/detail-low-tier3.jpg) | Shoulder pads have consistent orange edging; neutral elbow pads and belt remain fitted. | Orange shoulder rim has no new stripe or flare; vest and elbow contacts remain close. | Main rim treatment is retained on the slim shoulder shape, with clear dark pad centre. | PASS |
| [detail-low-tier4](sheets/detail-low-tier4.jpg) | Vest and orange shoulder rims remain fitted to the slim torso; pad centres retain their dark texture. | Shoulder rim and elbow contacts are close; no added detached lip or orange grain stripe. | Flat shoulder edging is distinct from the orange sleeve; vest, belt and glove placement remain coherent. | PASS |
| [high-z0.5-tier0](sheets/high-z0.5-tier0.jpg) | Close front confirms the clean white hem while keeping the diagonal teal strap and slimmer arm outline. | Shirt edge and backpack profile match the slim parent; the repair does not repaint the orange sleeve. | The old slim orange hem intrusion is removed; existing orange outer shirt remains intact. | PASS |
| [high-z0.5-tier1](sheets/high-z0.5-tier1.jpg) | Shirt front remains clean with the glove/kneepad tier drawn. | Wrist shells and kneepads sit on the slim limbs; pack retains the approved profile. | Clean white panel and diagonal strap remain distinct; no new glove or knee displacement. | PASS |
| [high-z0.5-tier2](sheets/high-z0.5-tier2.jpg) | Vest covers most of the shirt and follows the narrow waist; quilting and zipper stay readable. | Vest shoulder/side and pack sit on the slim surface; no detached hem sheet. | Vest and gloves follow the slim silhouette without restoring main torso bulk. | PASS |
| [high-z0.5-tier3](sheets/high-z0.5-tier3.jpg) | Shoulder pads have consistent orange edging; neutral elbow pads and belt remain fitted. | Orange shoulder rim has no new stripe or flare; vest and elbow contacts remain close. | Main rim treatment is retained on the slim shoulder shape, with clear dark pad centre. | PASS |
| [high-z0.5-tier4](sheets/high-z0.5-tier4.jpg) | Goggles and cap strap retain the original fit; the fitted vest and flat orange shoulder rims remain on the slim body. | Cap strap and lenses remain on the cap, shoulder and elbow shells follow the arm. | No renewed shoulder-rim streaks; bag, belt and glove placements are coherent. | PASS |
| [high-z1.5-tier0](sheets/high-z1.5-tier0.jpg) | Combined white undershirt hem is clean like main; pre-merge slim retains the orange hem intrusion. Slim limb and waist outline retained. | Backpack and shoulder strap retain the slim-parent placement; no new stand-off at the shirt side. | White panel reaches the diagonal strap cleanly; bag and arm outline retain the approved slim build. | PASS |
| [high-z1.5-tier1](sheets/high-z1.5-tier1.jpg) | Clean shirt retained with gloves and kneepads on the slimmer body. | Glove/cuff fit follows the wrist and the pack follows the back. | Knee and wrist shells are attached; white hem and diagonal strap remain distinct. | PASS |
| [high-z1.5-tier2](sheets/high-z1.5-tier2.jpg) | Vest covers most of the shirt and follows the narrow waist; quilting and zipper stay readable. | Vest shoulder/side and pack sit on the slim surface; no detached hem sheet. | Vest and gloves follow the slim silhouette without restoring main torso bulk. | PASS |
| [high-z1.5-tier3](sheets/high-z1.5-tier3.jpg) | Shoulder pads have consistent orange edging; neutral elbow pads and belt remain fitted. | Orange shoulder rim has no new stripe or flare; vest and elbow contacts remain close. | Main rim treatment is retained on the slim shoulder shape, with clear dark pad centre. | PASS |
| [high-z1.5-tier4](sheets/high-z1.5-tier4.jpg) | Goggles and cap strap retain the original fit; the fitted vest and flat orange shoulder rims remain on the slim body. | Cap strap and lenses remain on the cap, shoulder and elbow shells follow the arm. | No renewed shoulder-rim streaks; bag, belt and glove placements are coherent. | PASS |
| [lod2-parents-z0.5-tier0](sheets/lod2-parents-z0.5-tier0.jpg) | Clean undershirt and slim body retained; tier zero correctly draws no gear. | Pack/strap follow the unchanged slim body. | Clean hem and preserved orange outer shirt. | PASS |
| [lod2-parents-z0.5-tier1](sheets/lod2-parents-z0.5-tier1.jpg) | Glove and knee shells use coarse distant-LOD polygons. Contact remains on the wrists/knees. | The same angular distant-LOD glove design is present in main and slim; combined remains fitted at the wrist. | Knee and wrist shells stay placed; no displaced body surfaces. | PASS |
| [lod2-parents-z0.5-tier2](sheets/lod2-parents-z0.5-tier2.jpg) | Coarse vest follows narrow waist; zipper and quilting remain legible. | Vest side contacts remain close to the slim body. | Vest silhouette and glove placement follow the body. | PASS |
| [lod2-parents-z0.5-tier3](sheets/lod2-parents-z0.5-tier3.jpg) | Simplified shoulder pad retains flat orange border. | Pad rim has no grain stripe and remains attached. | Flat rim is consistent around the coarse pad silhouette. | PASS |
| [lod2-parents-z0.5-tier4](sheets/lod2-parents-z0.5-tier4.jpg) | Goggles/strap and coarse vest retain their placement. | Cap strap and shoulder/forearm contacts remain close. | Orange shoulder border and neutral pads are coherent with the slim build. | PASS |
| [lod2-parents-z1.5-tier0](sheets/lod2-parents-z1.5-tier0.jpg) | Clean undershirt and slim body retained; tier zero correctly draws no gear. | Pack/strap follow the unchanged slim body. | Clean hem and preserved orange outer shirt. | PASS |
| [lod2-parents-z1.5-tier1](sheets/lod2-parents-z1.5-tier1.jpg) | Glove and knee shells use coarse distant-LOD polygons. Contact remains on the wrists/knees. | The same angular distant-LOD glove design is present in main and slim; combined remains fitted at the wrist. | Knee and wrist shells stay placed; no displaced body surfaces. | PASS |
| [lod2-parents-z1.5-tier2](sheets/lod2-parents-z1.5-tier2.jpg) | Coarse vest follows narrow waist; zipper and quilting remain legible. | Vest side contacts remain close to the slim body. | Vest silhouette and glove placement follow the body. | PASS |
| [lod2-parents-z1.5-tier3](sheets/lod2-parents-z1.5-tier3.jpg) | Simplified shoulder pad retains flat orange border. | Pad rim has no grain stripe and remains attached. | Flat rim is consistent around the coarse pad silhouette. | PASS |
| [lod2-parents-z1.5-tier4](sheets/lod2-parents-z1.5-tier4.jpg) | Goggles/strap and coarse vest retain their placement. | Cap strap and shoulder/forearm contacts remain close. | Orange shoulder border and neutral pads are coherent with the slim build. | PASS |
| [lod2-tier0](sheets/lod2-tier0.jpg) | Clean undershirt and slim body retained; tier zero correctly draws no gear. | Pack/strap follow the unchanged slim body. | Clean hem and preserved orange outer shirt. | PASS |
| [lod2-tier1](sheets/lod2-tier1.jpg) | Glove and knee shells use coarse distant-LOD polygons. Contact remains on the wrists/knees. | Angular glove silhouette matches the main and slim distant-LOD design; no added stand-off at the wrist. | Knee and wrist shells stay placed; no displaced body surfaces. | PASS |
| [lod2-tier2](sheets/lod2-tier2.jpg) | Coarse vest follows narrow waist; zipper and quilting remain legible. | Vest side contacts remain close to the slim body. | Vest silhouette and glove placement follow the body. | PASS |
| [lod2-tier3](sheets/lod2-tier3.jpg) | Simplified shoulder pad retains flat orange border. | Pad rim has no grain stripe and remains attached. | Flat rim is consistent around the coarse pad silhouette. | PASS |
| [lod2-tier4](sheets/lod2-tier4.jpg) | Goggles/strap and coarse vest retain their placement. | Cap strap and shoulder/forearm contacts remain close. | Orange shoulder border and neutral pads are coherent with the slim build. | PASS |
| [low-z0.5-tier0](sheets/low-z0.5-tier0.jpg) | Combined white undershirt hem is clean like main; pre-merge slim retains the orange hem intrusion. Slim limb and waist outline retained. | Backpack and shoulder strap retain the slim-parent placement; no new stand-off at the shirt side. | White panel reaches the diagonal strap cleanly; bag and arm outline retain the approved slim build. | PASS |
| [low-z0.5-tier1](sheets/low-z0.5-tier1.jpg) | Clean shirt retained with gloves and kneepads on the slimmer body. | Glove/cuff fit follows the wrist and the pack follows the back. | Knee and wrist shells are attached; white hem and diagonal strap remain distinct. | PASS |
| [low-z0.5-tier2](sheets/low-z0.5-tier2.jpg) | Vest covers most of the shirt and follows the narrow waist; quilting and zipper stay readable. | Vest shoulder/side and pack sit on the slim surface; no detached hem sheet. | Vest and gloves follow the slim silhouette without restoring main torso bulk. | PASS |
| [low-z0.5-tier3](sheets/low-z0.5-tier3.jpg) | Shoulder pads have consistent orange edging; neutral elbow pads and belt remain fitted. | Orange shoulder rim has no new stripe or flare; vest and elbow contacts remain close. | Main rim treatment is retained on the slim shoulder shape, with clear dark pad centre. | PASS |
| [low-z0.5-tier4](sheets/low-z0.5-tier4.jpg) | Goggles and cap strap retain the original fit; the fitted vest and flat orange shoulder rims remain on the slim body. | Cap strap and lenses remain on the cap, shoulder and elbow shells follow the arm. | No renewed shoulder-rim streaks; bag, belt and glove placements are coherent. | PASS |
| [low-z1.5-tier0](sheets/low-z1.5-tier0.jpg) | Combined white undershirt hem is clean like main; pre-merge slim retains the orange hem intrusion. Slim limb and waist outline retained. | Backpack and shoulder strap retain the slim-parent placement; no new stand-off at the shirt side. | White panel reaches the diagonal strap cleanly; bag and arm outline retain the approved slim build. | PASS |
| [low-z1.5-tier1](sheets/low-z1.5-tier1.jpg) | Clean shirt retained with gloves and kneepads on the slimmer body. | Glove/cuff fit follows the wrist and the pack follows the back. | Knee and wrist shells are attached; white hem and diagonal strap remain distinct. | PASS |
| [low-z1.5-tier2](sheets/low-z1.5-tier2.jpg) | Vest covers most of the shirt and follows the narrow waist; quilting and zipper stay readable. | Vest shoulder/side and pack sit on the slim surface; no detached hem sheet. | Vest and gloves follow the slim silhouette without restoring main torso bulk. | PASS |
| [low-z1.5-tier3](sheets/low-z1.5-tier3.jpg) | Shoulder pads have consistent orange edging; neutral elbow pads and belt remain fitted. | Orange shoulder rim has no new stripe or flare; vest and elbow contacts remain close. | Main rim treatment is retained on the slim shoulder shape, with clear dark pad centre. | PASS |
| [low-z1.5-tier4](sheets/low-z1.5-tier4.jpg) | Goggles and cap strap retain the original fit; the fitted vest and flat orange shoulder rims remain on the slim body. | Cap strap and lenses remain on the cap, shoulder and elbow shells follow the arm. | No renewed shoulder-rim streaks; bag, belt and glove placements are coherent. | PASS |

## Gate

| Check | Result | Evidence |
| --- | --- | --- |
| `npx tsc --noEmit` | PASS | [log](qa/tsc.log) |
| `npm run lint` | PASS | [log](qa/lint.log) |
| `npm test` | 110/110, 26 files | [log](qa/unit.log) |
| `E2E_PORT=4871 SCENE_PORT=4872 npm run test:smoke` | 7/7; 92.2 s | [log](qa/smoke.log) |
| `npm run scene:gate` | **48/48**, 0 known, 0 not run; 7.7 min | [summary](qa/scene-gate/summary.md), [log](qa/scene-gate.log) |
| Final reporting tools TypeScript/lint rerun | PASS | [types](qa/final-tools-tsc.log), [lint](qa/final-tools-lint.log) |
| Crop coverage and contact | 270/270; maximum combined 1.4 cm, limit 2 cm | [receipt](coverage.json) |

The gate ran against the complete merged runtime and final repaired assets before the merge commit; no runtime or asset changed afterward. All shared browser contexts closed. The temporary raw build folder was removed, no baseline worktree/copy or browser profile was created, private ports 4871/4872 are closed, and 17.55 GiB remained free ([cleanup](cleanup.json)). No deployment, push or publication.
