# E25-AC02 accepted-look preservation review

**PASS.** Reviewed all 17 changed-frame contact sheets. The 347 unchanged pairs are exact full-frame RGBA matches. The 65 changed pairs contain emitter/interior/glow changes and the native-capture variability documented below. No geometry, placement, diffuse repaint or scene-composition regression was found.

## Coverage and controls

- 93 accepted prop/decay cases: L1 23, L2 26, L4 24, L5 20; six equipment cases; four native level views.
- Both quality tiers and zooms 1 / 1.5: **412 pairs / 824 primary PNGs**, plus four repeat-control PNGs.
- Prop cameras use the production 25° FOV and 19 m / 28.5 m radii. Actual camera poses, player zoom, requested quality, drawn world-prop LODs, frame hashes and matching ticks are checked. Every zoom pair has distinct images.
- Seeds, simulation clocks, renderer node time and geometry-based depth ordering are controlled. Props are captured at tick 1; native entry/photo views at tick 0. Isolated props disable DOF; native views retain the level presentation.
- Every RGBA pixel is compared. No masks, ignored regions, pixel thresholds for passing, or replacement A/B frames are used. The repeat-control threshold described below is diagnostic only.

[Complete per-pair metrics and camera poses](evidence/visual-comparison.json), [fixture definitions](evidence/visual-fixtures.json), [baseline calibration](evidence/visual-baseline-calibration.json).

## What visibly changed

| Area | Observations |
| --- | --- |
| L1 | On high, houses C/D/E gain the existing mapped-room appearance: formerly flat warm/white windows become darker, cooler/cyan room panes with the corresponding bloom change. The brick main-street pharmacy sign follows its authored neon state on both tiers. Gas-station lamp glints change on both tiers; low also changes the fire-station entrance/window glints. Roofs, walls, signs, roads, foliage and object placement retain their shapes and paint. |
| L2 | The same house/interior and pharmacy/gas-station changes occur in the midday preset; low fire-station glints also change. The native wide view has a small practical-light glint difference. Street layout, parked vehicles, vegetation, daylight and shadows retain their appearance. |
| L4 | High houses D/E show the mapped-room change; house C's deck lights and house B's distant glint change. Low house B also changes a tiny glint. The low detached garage loses exactly one amber glint pixel at each zoom; surrounding pixels are identical. Native plaza differences are localized to practical-light glints; trucks, tents, barriers, crowds and plaza composition remain the same. |
| L5 | High house C's surviving windows/deck lights follow their repaired binding. Low detached-garage views lose the same single amber glint pixel. Decayed building silhouettes, broken variants, clutter, fog and sunset mood remain the same. Native-view edge variability is covered by the repeat control below. |
| Equipment at night | Headlamp differences are confined to the tiny source/glow; no second beam or new pool is introduced. The turbine hall retains its bright cool window strip and gains its intended subtle local spill. Console, filtration tower, cure canister and pedestal are exact matches in all four primary views each. |

These are binding/state changes using existing light settings, rather than new palette or scene tuning. All 370 pre-existing runtime anchors are field-for-field unchanged; only six missing equipment records were added. All 573 changed GLBs retain their binary payloads and original geometry/material/pose/animation data. All nonlighting static-bake attributes and the original 142-key cache set remain exact; all 258 civilian bakes are byte-identical.

[Runtime-anchor proof](evidence/runtime-table-integrity.json), [GLB proof](evidence/integrity-final.json), [bake proof](evidence/static-bake-integrity.json).

## Native L5 repeat control

The first high-tier A/B native pair included small health-bar edge shifts. Repeating the same repaired assets, seed, tick, tier and camera reproduced **the exact 844 / 520 pixel locations with channel deltas above 100**, at zoom 1 / 1.5. Baseline versus repeat instead differs by only 233 / 49 pixels, with maximum channel deltas 7 / 3 and no such large deltas. This identifies the conspicuous bar-edge difference as capture variability.

On low, the repaired repeat PNGs are **byte-identical to their baseline PNGs at both zooms**; they reproduce the original 747 / 325 differing pixels when compared with the first repaired capture. The original frames and all their raw differences remain in the primary 412-pair result. No region was removed or replaced to obtain the review result.

[Full repeat metrics and hashes](evidence/native-repeat.json), [repeat contact sheet](/Users/wesner/Workspace/mi-evidence-archive/docs/reports/e25-emitters/evidence/visual-sheets/native-repeat-control.webp).

## Preservation checklist

- **PASS — geometry and composition:** inspected sheets show unchanged silhouettes, poses, placement, terrain and decay; independent payload/attribute proofs cover the full assets.
- **PASS — paint and material identity:** original material data and nonlighting bake values are exact; visible color changes occur in controlled emissive/interior surfaces and their bloom/spill.
- **PASS — intended lighting:** existing light parameters and behaviors are retained, new equipment anchors derive from actual emissive geometry, and no practical lamp is exempted from coverage.
- **PASS — both quality tiers and zooms:** every required pair is present, calibrated, hash-verified and free of console errors; world props are actually drawn.
- **PASS — native accepted views:** L1 entry, L2 streets, L4 safe plaza and L5 pair plaza retain their look; the observed L5 health-bar edge variation is reproduced with identical inputs.

## Contact sheets

WebP sheets and full-resolution PNGs were moved intact to `/Users/wesner/Workspace/mi-evidence-archive/`, preserving their original repository paths. Their hashes and absolute archive locations are recorded in the metrics; a fresh checkout does not include this local archive.

[01](/Users/wesner/Workspace/mi-evidence-archive/docs/reports/e25-emitters/evidence/visual-sheets/changed-01.webp) · [02](/Users/wesner/Workspace/mi-evidence-archive/docs/reports/e25-emitters/evidence/visual-sheets/changed-02.webp) · [03](/Users/wesner/Workspace/mi-evidence-archive/docs/reports/e25-emitters/evidence/visual-sheets/changed-03.webp) · [04](/Users/wesner/Workspace/mi-evidence-archive/docs/reports/e25-emitters/evidence/visual-sheets/changed-04.webp) · [05](/Users/wesner/Workspace/mi-evidence-archive/docs/reports/e25-emitters/evidence/visual-sheets/changed-05.webp) · [06](/Users/wesner/Workspace/mi-evidence-archive/docs/reports/e25-emitters/evidence/visual-sheets/changed-06.webp) · [07](/Users/wesner/Workspace/mi-evidence-archive/docs/reports/e25-emitters/evidence/visual-sheets/changed-07.webp) · [08](/Users/wesner/Workspace/mi-evidence-archive/docs/reports/e25-emitters/evidence/visual-sheets/changed-08.webp) · [09](/Users/wesner/Workspace/mi-evidence-archive/docs/reports/e25-emitters/evidence/visual-sheets/changed-09.webp) · [10](/Users/wesner/Workspace/mi-evidence-archive/docs/reports/e25-emitters/evidence/visual-sheets/changed-10.webp) · [11](/Users/wesner/Workspace/mi-evidence-archive/docs/reports/e25-emitters/evidence/visual-sheets/changed-11.webp) · [12](/Users/wesner/Workspace/mi-evidence-archive/docs/reports/e25-emitters/evidence/visual-sheets/changed-12.webp) · [13](/Users/wesner/Workspace/mi-evidence-archive/docs/reports/e25-emitters/evidence/visual-sheets/changed-13.webp) · [14](/Users/wesner/Workspace/mi-evidence-archive/docs/reports/e25-emitters/evidence/visual-sheets/changed-14.webp) · [15](/Users/wesner/Workspace/mi-evidence-archive/docs/reports/e25-emitters/evidence/visual-sheets/changed-15.webp) · [16](/Users/wesner/Workspace/mi-evidence-archive/docs/reports/e25-emitters/evidence/visual-sheets/changed-16.webp) · [17](/Users/wesner/Workspace/mi-evidence-archive/docs/reports/e25-emitters/evidence/visual-sheets/changed-17.webp).
