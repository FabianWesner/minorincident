> **Superseded by the garment review:** woman-a is restored to her complete pre-slim export after the bag/cardigan refits failed close review. The historical ratios and decision below describe the earlier body-only pilot, not the final garment candidate. See [slim-c](../garments/README.md).

# Pilot review — body build

Decision: **PASS for the body-build change; proceed to the adult rollout.** Reviewed the final front / three-quarter / side studio pairs, game zoom 1.5, literal 3 m upper/lower views, both quality tiers, walking, a full `civ-flee` running stride, `npc-sit`, the mid-swing attack pose, infected attack/windup and settled death. The heroine uses her original mesh; the pilot uses the existing q257 delivered height classes in every comparison.

Both pilots are closer to the heroine: the man retains a polo and cargo-trouser silhouette with a narrower waist, forearms, calves and shoe footprint; the woman retains her cardigan, floral dress, handbag and shoes with a narrower torso, arms and legs. Neither becomes an emaciated anatomical silhouette. The man’s upper arm and thigh were already close to the reference and receive little or no contraction. Axes already slimmer than the reference are not enlarged. The 0.65 limb contraction floor retains clothing volume; limbs are therefore directed toward, rather than forced into, a ±15% interval. The torso upper limit is enforced.

Two design corrections were made to the first WIP: weld identical UV-split bind points / treat shoe sides independently, then use smooth influence fields and preserve a shoulder rim rather than pinching elbow/knee joints. The final export audit passes all 14 pilot source/LOD/tier files. No new opened joint seam or detached hand prop was found in the paired motion views.

## Existing source/render limitations

Close views expose angular cardigan/handbag folds, fine atlas seam lines and partially ground-occluded death surfaces in the untouched baseline too. These are visible in the before images and the saved q257 coffee evidence. An isolated standard-Three source-versus-bake comparison, both browser backends, a no-prop fixture and a double-sided/mask diagnostic reproduce the source/delivery artifacts; they are not evidence that this edit repairs them. This review approves the relative body-build improvement. Those existing surfaces remain visible in both states. Texture pixels, topology, weights, head/neck/hands and props remain unchanged. The orchestrator was notified before rollout.

## Ratios to height

| Figure | State | Upper arm r/H | Forearm r/H | Thigh r/H | Calf r/H | Torso W/H | Torso D/H | Shoe L/H | Shoe H/H |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| char.courier-female | before | 0.0377 | 0.0434 | 0.0712 | 0.0369 | 0.1669 | 0.1561 | 0.1598 | 0.1178 |
| npc.civilian-man-a | before | 0.0413 | 0.0617 | 0.0806 | 0.0964 | 0.2008 | 0.1342 | 0.1932 | 0.1372 |
| npc.civilian-man-a | after | 0.0420 | 0.0487 | 0.0797 | 0.0627 | 0.1869 | 0.1342 | 0.1783 | 0.1336 |
| npc.civilian-woman-a | before | 0.0732 | 0.0864 | 0.1121 | 0.0772 | 0.3740 | 0.1944 | 0.2486 | 0.1271 |
| npc.civilian-woman-a | after | 0.0540 | 0.0561 | 0.0855 | 0.0611 | 0.1870 | 0.1748 | 0.1790 | 0.1267 |

After comparisons freeze the baseline anatomical vertex ownership and cross-section samples. The final numerical rebuild corrects sample-membership drift on sparse figures; the style parameters remain the same. Final source and game sheets were reviewed again.

Evidence: [studio sheet](studio-sheet.jpg), [zoom 1.5](game-sheet-zoom15.jpg), [3 m upper views](game-sheet-close3m.jpg), [3 m lower views](lower-sheet-high.jpg), [motion high](motion-sheet-high.jpg), [motion low](motion-sheet-low.jpg), [lower low](lower-sheet-low.jpg), [export audit](audit.json), [height census](height-census.json). Raw screenshots and animation receipts remain beside the sheets.

The rollout preflight covers 55 adult variants / 58 figures / 337 source and LOD/tier files. Every measured torso previously above the heroine ×1.15 upper limit is now below it; q249 head upper caps and exact source heights pass. The q260 crawler keeps its approved full crouched head and receives the standing male pilot’s body reduction profile instead of comparing crouched height to standing height.
