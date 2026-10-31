# Garment follow-up (slim-c)

The earlier rollout approval is superseded by this garment review. The orchestrator found detached cardigan/bag flaps on woman-a and a lumpy man-b hoodie hem.

## Change

Spatial nearest-arm classification is retained for anatomical measurement only. Rigid backpacks receive the torso-relative translation, and segmented jacket shoulder contacts retain their original connecting volume. Export deformation now uses each vertex's authored body influences, so a torso-weighted garment cannot receive an arm-axis displacement just because it lies close to an arm. UVs, atlas bytes, skin weights, rig, heads and hand props remain exact.

The attempted woman-a refits did not pass visual review. Following the requested fallback, woman-a and its shared adult-f variant are restored to their complete pre-slim exports, at every LOD/tier. Mrs Alvarez and the butcher also use the fallback because their apron fronts/ties kinked in the crop review. Seven more variants are restored because the coherent field would exceed the unchanged q249 head/shoulder cap. [Explicit list](reverted.json). No cap or automated offset threshold was increased.

## Automated offset check

The unchanged limit is **10 mm**, for both nearest surface offset and corresponding-point displacement offset. The reference surface is the original clothed body under the authored torso/limb field. These models have a single dressed mesh and no independent hidden nude body, so this is a body-following displacement check, not a claim to measure nonexistent nude surfaces. It covers garment vertices in every source/LOD/tier export, excluding exposed skin, heads, hands, weapons and hidden caps. It cannot judge bag shape or cloth folds by itself; every variant also requires visual review.

[Positive controls](offset-before.json) detect the previous bad woman-a and man-b exports at 72.8 mm and 65.6 mm nearest-surface offset respectively. This is why the check is paired with the crop review: removing that offset alone was insufficient to repair woman-a's bag shape cleanly.

## Crops

Source figures run through the production renderer/material conversion and the actual game camera at **zoom 1.5**, with native browser DPR 2. High uses LOD0/high atlas; low uses LOD1/512 atlas. Each sheet contains front, side and three-quarter close crops at both tiers. The skinned source is shown in its bind pose, without hiding garment layers. Four members of survivor-group are shown separately.

## Visual review result

**43 fixed, 1 already OK, 11 reverted**. All **58 individual figure sheets** (including the four survivor-group members) were inspected at full resolution, plus the actual skinned male courier with tier-4 gear. Every sheet has front/side/three-quarter close crops for high and low at game zoom 1.5. The pre-slim high/low crops are retained in `before-crops-high/` and `before-crops-low/` for comparison. The remaining stylized segmented/ripped low-LOD surfaces are present in the pre-slim exports too; the review rejects new outer-layer stand-off and accordion folds.

The man-b hem now follows the torso. Woman-a/adult-f are restored to their pre-slim build so the cardigan, bag and strap retain their original fit. Mrs Alvarez and the butcher likewise retain their original apron/tie fit. The seven cap-related fallbacks retain their original complete outfits. All fallback exports are verified byte-for-byte against `53949e814` in [the per-file status receipt](status.json).

[Automated offset check](offset-check.json): **55 variants / 337 source, LOD and texture-tier exports pass**, with both limits fixed at 10 mm. This is a displacement/reference-surface regression check; the visual review remains the authority on cloth folds and bag shape.

## Per-variant verdicts

| Variant | Verdict | Crop sheet(s) | Observation |
| --- | --- | --- | --- |
| char.survivor-male | fixed | [1](sheets/char.survivor-male.jpg) | Jacket/vest waist and shoulder contacts retained; pack translated with the back. |
| char.survivor-female | fixed | [1](sheets/char.survivor-female.jpg) | Shirt and pack straps remain fitted; pack translated with the back. |
| inf.common-worker | fixed | [1](sheets/inf.common-worker.jpg) | Clothing follows the body in front, side and three-quarter views at both tiers; authored segmented/ripped details retained. |
| inf.jogger | fixed | [1](sheets/inf.jogger.jpg) | Clothing follows the body in front, side and three-quarter views at both tiers; authored segmented/ripped details retained. |
| inf.baseball-cap | fixed | [1](sheets/inf.baseball-cap.jpg) | Clothing follows the body in front, side and three-quarter views at both tiers; authored segmented/ripped details retained. |
| inf.suburban-mom | fixed | [1](sheets/inf.suburban-mom.jpg) | Clothing follows the body in front, side and three-quarter views at both tiers; authored segmented/ripped details retained. |
| inf.delivery-driver | fixed | [1](sheets/inf.delivery-driver.jpg) | Rigid delivery pack translated with the back; coat contact retained. |
| inf.skater | fixed | [1](sheets/inf.skater.jpg) | Clothing follows the body in front, side and three-quarter views at both tiers; authored segmented/ripped details retained. |
| inf.college-student | fixed | [1](sheets/inf.college-student.jpg) | Clothing follows the body in front, side and three-quarter views at both tiers; authored segmented/ripped details retained. |
| inf.bbq-dad | fixed | [1](sheets/inf.bbq-dad.jpg) | Clothing follows the body in front, side and three-quarter views at both tiers; authored segmented/ripped details retained. |
| inf.cashier | fixed | [1](sheets/inf.cashier.jpg) | Clothing follows the body in front, side and three-quarter views at both tiers; authored segmented/ripped details retained. |
| inf.bathrobe-neighbor | fixed | [1](sheets/inf.bathrobe-neighbor.jpg) | Clothing follows the body in front, side and three-quarter views at both tiers; authored segmented/ripped details retained. |
| inf.construction-worker | fixed | [1](sheets/inf.construction-worker.jpg) | Clothing follows the body in front, side and three-quarter views at both tiers; authored segmented/ripped details retained. |
| inf.crawler | ok | [1](sheets/inf.crawler.jpg) | Already coherent; tank top follows the crouched torso. |
| inf.riot-cop | fixed | [1](sheets/inf.riot-cop.jpg) | Clothing follows the body in front, side and three-quarter views at both tiers; authored segmented/ripped details retained. |
| inf.hazmat | fixed | [1](sheets/inf.hazmat.jpg) | Clothing follows the body in front, side and three-quarter views at both tiers; authored segmented/ripped details retained. |
| inf.firefighter | fixed | [1](sheets/inf.firefighter.jpg) | Clothing follows the body in front, side and three-quarter views at both tiers; authored segmented/ripped details retained. |
| inf.screamer | fixed | [1](sheets/inf.screamer.jpg) | Clothing follows the body in front, side and three-quarter views at both tiers; authored segmented/ripped details retained. |
| inf.sprinter | fixed | [1](sheets/inf.sprinter.jpg) | Clothing follows the body in front, side and three-quarter views at both tiers; authored segmented/ripped details retained. |
| inf.armored-football | fixed | [1](sheets/inf.armored-football.jpg) | Clothing follows the body in front, side and three-quarter views at both tiers; authored segmented/ripped details retained. |
| inf.butcher | reverted | [1](sheets/inf.butcher.jpg) | Restored complete pre-slim exports: apron front/ties kinked in the close side view. |
| inf.nurse | fixed | [1](sheets/inf.nurse.jpg) | Clothing follows the body in front, side and three-quarter views at both tiers; authored segmented/ripped details retained. |
| npc.civilian-adult-m | fixed | [1](sheets/npc.civilian-adult-m.jpg) | Polo/shirt waist and sleeve contacts remain continuous. |
| npc.civilian-adult-f | reverted | [1](sheets/npc.civilian-adult-f.jpg) | Restored complete pre-slim exports: cardigan/bag refits still folded away from the torso. |
| npc.civilian-elderly | reverted | [1](sheets/npc.civilian-elderly.jpg) | Restored complete pre-slim exports: coherent refit exceeded the unchanged head/shoulder cap. |
| npc.patient-zero-courier | fixed | [1](sheets/npc.patient-zero-courier.jpg) | Courier shirt, shoulder straps and rigid pack retain their body-relative placement. |
| npc.mrs-alvarez | reverted | [1](sheets/npc.mrs-alvarez.jpg) | Restored complete pre-slim exports: apron front/ties kinked in the close side view. |
| npc.police-officer | fixed | [1](sheets/npc.police-officer.jpg) | Uniform/vest and belt remain fitted. |
| npc.paramedic | fixed | [1](sheets/npc.paramedic.jpg) | Medical vest, straps and pack follow the torso. |
| npc.firefighter-alive | reverted | [1](sheets/npc.firefighter-alive.jpg) | Restored complete pre-slim exports: coherent refit exceeded the unchanged head/shoulder cap. |
| npc.national-guard | fixed | [1](sheets/npc.national-guard.jpg) | Armour vest and pouches follow the torso. |
| npc.survivor-group | fixed | [1](sheets/npc.survivor-group-survivor01_root.jpg) · [2](sheets/npc.survivor-group-survivor02_root.jpg) · [3](sheets/npc.survivor-group-survivor03_root.jpg) · [4](sheets/npc.survivor-group-survivor04_root.jpg) | All four members reviewed: jackets/hoodies, packs and straps remain attached. |
| npc.helicopter-pilot | fixed | [1](sheets/npc.helicopter-pilot.jpg) | Harness, vest and pack remain fitted. |
| npc.civilian-man-a | fixed | [1](sheets/npc.civilian-man-a.jpg) | Polo/shirt waist and sleeve contacts remain continuous. |
| npc.civilian-man-b | fixed | [1](sheets/npc.civilian-man-b.jpg) | Hoodie hem and pocket area continuous; no detached hem lip. |
| npc.civilian-woman-a | reverted | [1](sheets/npc.civilian-woman-a.jpg) | Restored complete pre-slim exports: cardigan/bag refits still folded away from the torso. |
| npc.civilian-woman-b | fixed | [1](sheets/npc.civilian-woman-b.jpg) | Blouse and black shoulder bag retain a close, uncreased side profile. |
| inf.teen-skater | fixed | [1](sheets/inf.teen-skater.jpg) | Clothing follows the body in front, side and three-quarter views at both tiers; authored segmented/ripped details retained. |
| char.courier-male | fixed | [1](sheets/char.courier-male.jpg) | Torso, cross-body strap and bag follow the body; actual skinned tier-4 courier reviewed separately. |
| npc.lab-tech-a | reverted | [1](sheets/npc.lab-tech-a.jpg) | Restored complete pre-slim exports: coherent refit exceeded the unchanged head/shoulder cap. |
| npc.lab-tech-b | fixed | [1](sheets/npc.lab-tech-b.jpg) | Lab-coat front/hem and sleeves follow the torso; open lapels retain their shape. |
| npc.lab-guard | fixed | [1](sheets/npc.lab-guard.jpg) | Clothing follows the body in front, side and three-quarter views at both tiers; authored segmented/ripped details retained. |
| npc.depot-clerk | reverted | [1](sheets/npc.depot-clerk.jpg) | Restored complete pre-slim exports: coherent refit exceeded the unchanged head/shoulder cap. |
| npc.dale.aftermath | fixed | [1](sheets/npc.dale.aftermath.jpg) | Clothing follows the body in front, side and three-quarter views at both tiers; authored segmented/ripped details retained. |
| npc.rosa.aftermath | fixed | [1](sheets/npc.rosa.aftermath.jpg) | Clothing follows the body in front, side and three-quarter views at both tiers; authored segmented/ripped details retained. |
| npc.mr-okafor.aftermath | reverted | [1](sheets/npc.mr-okafor.aftermath.jpg) | Restored complete pre-slim exports: coherent refit exceeded the unchanged head/shoulder cap. |
| npc.mia.aftermath | reverted | [1](sheets/npc.mia.aftermath.jpg) | Restored complete pre-slim exports: coherent refit exceeded the unchanged head/shoulder cap. |
| npc.sam.aftermath | reverted | [1](sheets/npc.sam.aftermath.jpg) | Restored complete pre-slim exports: coherent refit exceeded the unchanged head/shoulder cap. |
| npc.civilian-man-a.aftermath | fixed | [1](sheets/npc.civilian-man-a.aftermath.jpg) | Polo/shirt waist and sleeve contacts remain continuous. |
| npc.civilian-man-b.aftermath | fixed | [1](sheets/npc.civilian-man-b.aftermath.jpg) | Hoodie hem follows the torso in both tiers. |
| npc.civilian-woman-b.aftermath | fixed | [1](sheets/npc.civilian-woman-b.aftermath.jpg) | Blouse and shoulder bag remain fitted. |
| npc.marcus.aftermath | fixed | [1](sheets/npc.marcus.aftermath.jpg) | Polo/shirt waist and sleeve contacts remain continuous. |
| npc.shelter-survivor.bandaged | fixed | [1](sheets/npc.shelter-survivor.bandaged.jpg) | Polo/shirt waist and sleeve contacts remain continuous. |
| npc.shelter-survivor.lying | fixed | [1](sheets/npc.shelter-survivor.lying.jpg) | Polo/shirt waist and sleeve contacts remain continuous. |
| npc.shelter-survivor.sitting | fixed | [1](sheets/npc.shelter-survivor.sitting.jpg) | Polo/shirt waist and sleeve contacts remain continuous. |

## Release checks

Runtime/assets: `a4935e9e6` on `lane/slim`.

| Check | Result |
| --- | --- |
| `npx tsc --noEmit` | PASS |
| `npm run lint` | PASS |
| `npm test` | 110/110, 26 files |
| `E2E_PORT=4871 SCENE_PORT=4872 npm run test:smoke` | 7/7; 111.6 s |
| `npm run scene:gate` | **48/48**, no known failures, no skipped rows; 3.9 min |
| Garment/reference-body offsets | 55 variants / 337 exports PASS, fixed 10 mm limits |
| Head caps, heights, retained attributes/UV/weights/textures/rig | 337 exports PASS |
| GPU delivery normals / runtime LOD fallback / contract delta | 192 pass / 0 added / 0 new errors |
| Final L1 load, 10 alternating pairs | Median 2194.3 → 2193.4 ms; p90 2210.1 → 2210.4 ms |

[Scene summary](qa/scene-gate/summary.md), [smoke log](qa/smoke.log), [unit log](qa/unit.log), [offset receipt](offset-check.json), [source invariant audit](../rollout/audit.json). All 192 GPU deliveries were regenerated from the final exports, including healthy/infected corpse surfaces. The actual male tier-4 outfit was additionally reviewed in [this sheet](sheets/char.courier-male.skin-gear4.jpg). No heroine asset, original cap, export tolerance, or check threshold was relaxed.

The lineup high/low sheets, woman-a pilot studio views and L1 depot/bench sheets were refreshed from the final assets. The earlier 55-variant slim rollout is historical: **44 variants remain slimmed** (43 fixed and 1 already OK), and the 11 listed fallbacks use their complete pre-slim geometry.

## Reproduce

```sh
node --import tsx tools/slim/refit-garments.ts
node --import tsx tools/slim/revert-garments.ts $(node -e "process.stdout.write(JSON.parse(require('fs').readFileSync('docs/reports/slim/garments/reverted.json')).join(' '))")
node --import tsx tools/slim/sync-dimensions.ts
node --import tsx tools/slim/pack-normals.ts
node --import tsx tools/slim/refit-gear.ts
node --import tsx tools/slim/audit.ts rollout
node --import tsx tools/slim/garment-offset.ts
# Capture sequentially through the shared pool, using private SCENE_PORT=4871/4872.
MI_BROWSER_POOL=1 SCENE_PORT=4872 node --import tsx tools/slim/capture-garments.ts high
MI_BROWSER_POOL=1 SCENE_PORT=4872 node --import tsx tools/slim/capture-garments.ts low
python3 tools/slim/garment-sheets.py
```

`prepare-garment-baseline.ts` creates the small local original-export set for `SLIM_CROP_BEFORE=1` comparisons. That temporary input set was removed after capture; all baseline crop images remain committed. The 15 `review-NN.jpg` pages cover every individual crop sheet. The source-bake generator writes content-hashed deliveries; remove only superseded paths no longer referenced by `src/assets/civilianBakes.json`. No deployment or publication was performed.

The [final paired L1 load comparison](load/summary.json) uses native Apple WebGPU in fresh contexts from the shared headless pool. Median delta is −0.9 ms, p90 +0.3 ms, maximum +16.3 ms; all remain inside the existing 300 ms limit. Both public bundles passed the public-build hook check. This supersedes the earlier body-only load result.

Cleanup: the only `/tmp` baseline was deleted, both private timing ports are closed, all owned shared-pool contexts were closed, no browser profiles were created, and 18.09 GiB remained free ([receipt](cleanup.json)). The final TypeScript/lint/unit rerun also passed after the reporting-tool edits; runtime assets remain at `a4935e9e6`, the revision used by the full smoke and scene gate.
