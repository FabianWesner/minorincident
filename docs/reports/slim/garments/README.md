# Garment follow-up (slim-c)

The earlier rollout approval is superseded by this garment review. The orchestrator found detached cardigan/bag flaps on woman-a and a lumpy man-b hoodie hem.

## Change

Spatial nearest-arm classification is retained for anatomical measurement only. Export deformation now uses each vertex's authored body influences, so a torso-weighted garment cannot receive an arm-axis displacement just because it lies close to an arm. UVs, atlas bytes, skin weights, rig, heads and hand props remain exact.

The attempted woman-a refits did not pass visual review. Following the requested fallback, woman-a and its shared adult-f variant are restored to their complete pre-slim exports, at every LOD/tier. Seven more variants are restored because the coherent field would exceed the unchanged q249 head/shoulder cap. [Explicit list](reverted.json). No cap or automated offset threshold was increased.

## Automated offset check

The unchanged limit is **10 mm**, for both nearest surface offset and corresponding-point displacement offset. The reference surface is the original clothed body under the authored torso/limb field. These models have a single dressed mesh and no independent hidden nude body, so this is a body-following displacement check, not a claim to measure nonexistent nude surfaces. It covers garment vertices in every source/LOD/tier export, excluding exposed skin, heads, hands, weapons and hidden caps. It cannot judge bag shape or cloth folds by itself; every variant also requires visual review.

[Positive controls](offset-before.json) detect the previous bad woman-a and man-b exports at 72.8 mm and 65.6 mm nearest-surface offset respectively. This is why the check is paired with the crop review: removing that offset alone was insufficient to repair woman-a's bag shape cleanly.

## Crops

Source figures run through the production renderer/material conversion and the actual game camera at **zoom 1.5**, with native browser DPR 2. High uses LOD0/high atlas; low uses LOD1/512 atlas. Each sheet contains front, side and three-quarter close crops at both tiers. The skinned source is shown in its bind pose, without hiding garment layers. Four members of survivor-group are shown separately.

Final per-variant verdicts and release checks are pending below.
