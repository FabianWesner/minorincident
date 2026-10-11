# Fire engine doors and char review

Both damage variants are rebuilt through `assets/veh.fire-engine/build.py --decay` from the current pristine authored LOD1/LOD2 shells. Their near shell continues to use LOD1, as the existing damage pipeline intends. Door hinges now own their deformed panels rather than having their geometry merged into the root. All wheel/seat/exit socket matrices remain unchanged.

Burned paint uses `pal_uiDark` instead of `pal_blood`; formerly bright trim uses `pal_asphalt`. Existing AO receives deterministic soot variation. Glass remains as smoke-black panes, and authored lamps remain disabled. Buckled equipment panels, collapsed cab roof and bent ladder distinguish heat damage from the impact wreck.

## Captures

`captures/lod{0,1,2}-game.png` show the same scene, game camera, L2 lighting and fixed zoom at 1600×900: pristine upper right, wrecked center, burned lower left. `captures/lod{0,1,2}-close.png` show the opposite side with a fixed close camera. Every tier was explicitly pinned through the real vehicle registry. No placeholders or console errors; both door nodes contain meshes on all three vehicles in every capture (`captures/metrics.json`).

Reviewed all three game-camera captures and their opposite-side close views: PASS. The burned body is soot-black, glass is dark, trim reads as scorched/ashy, the crushed cab and bent ladder remain recognizable, and its appearance is immediately distinct from the pristine red engine at every tier. The wreck retains red paint with a visibly folded nose. Wheel/ladder silhouettes survive LOD2.

## Authored damage budgets

| Variant | LOD0 triangles/draws | LOD1 triangles/draws | LOD2 triangles/draws |
| --- | --- | --- | --- |
| Wrecked | 4682 / 34 | 4682 / 34 | 1928 / 25 |
| Burned | 4822 / 20 | 4822 / 20 | 1988 / 16 |

All are within 15000/6000/2000 triangles and 40 draws. Exact raw export metrics are in `asset-budgets.json`; runtime validation passes the same budgets. Scene traversal counts in capture metrics include the 384-triangle interaction ring added by `VehicleView`; the asset validator counts only the exported GLB geometry.

Reproduce captures headlessly on an isolated port:

```sh
SCENE_PORT=3378 sh tools/e2e-lock.sh npx tsx tools/scenelab/engine-wreck-doors.ts
```

## Main integration repair

Merged main at `580b3d17` into this lane after committing the reviewed engine assets (`c9322d2e`). The resulting manifest contained two `inf.alpha` entries: the accepted integrated model with LOD0/1/2 and a trailing placeholder without distance-tier paths. Removing the obsolete placeholder repairs both manifest uniqueness checks (T-E06-08 and T-E17-06) and the two missing-LOD findings in T-E17-02b. The registry uses a Map, so this also stops the placeholder from overriding the accepted Alpha at runtime. No action mappings, accepted Alpha exports, test assertions or inventory criteria were changed.

The earlier 807-test result and E09/E17 broad verification artifacts describe the branch before this main merge. Final merged-head checks are recorded separately in `checks.json`.
