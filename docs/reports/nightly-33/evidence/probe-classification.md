# Appearance probe corrections

Base: `165e05cd2`; corrected probes: `c73c36789`. These changes affect QA measurements only. The game rendering and the limits remain unchanged: L5 body luma rise ≤ 1.6, corpse-scene luma rise ≤ 2.2, white share ≤ 0.03, silhouette roughness ≤ 15.5. [All ten scenes retain their original thresholds](../checks/probe-thresholds.json). The L7 foot-sink limit remains zero and is not changed by this patch.

## Why the old measurements were stale after the figure rollout

The colour probe used the difference between frames with and without the crowd. That selection includes cast/contact shadows, and excludes figure pixels whose colour happens to resemble the background. The corrected selection uses the existing production infected geometry ID pass at the same pose. The normal rendered colours are still sampled; the ID pass supplies only the selection. [Independent z0.5 comparison](l5-body-z0.5.json), [z1 comparison](l5-body-z1.json), and the normal/mask PNG pairs in this directory preserve the evidence.

The silhouette probe segmented dark pixels relative to the crop border. Bright clothing, skin and textures cut holes in that selection; their internal boundaries then increased its supposed outline length. The production geometry ID mask gives the actual drawn infected outline instead. The normal-frame black/white edge guard is retained independently. [Independent comparison](alpha-mask.json), [normal frame](alpha-f0-normal.png), [geometry mask](alpha-f0-mask.png).

| Measurement | Original probe | Geometry mask | Unchanged limit |
| --- | ---: | ---: | ---: |
| L5 fire, high z0.5, peak/initial luma | 1.81213 | 1.44697 | 1.6 |
| L5 fire, high z1, peak/initial luma | 1.68003 | 1.39637 | 1.6 |
| Alpha silhouette, high z0.5, frame 0 | 16.74860 | 5.89704 | 15.5 |
| Alpha silhouette, high z0.5, frame 30 | 15.9550 | 5.64087 | 15.5 |

The original high-tier failures reproduced twice with the same strict checks: [rerun 1](../checks/repro1.json), [rerun 2](../checks/repro2.json). The low-tier cases also reproduced twice: [low rerun 1](../checks/low-repro1.json), [low rerun 2](../checks/low-repro2.json). These were deterministic measurement errors, not intermittent browser failures. The full final matrix audit records both qualities and all affected rows.

## Controls and scope

The existing shared QA-driver test was extended without increasing the test count. It checks that a real selected-body brightness increase still exceeds 1.6, a white fallback still reports white share 1, a jagged geometric outline still exceeds 15.5, and an empty geometric mask fails with infinite roughness. Painted internal noise no longer changes a compact geometric silhouette, while the normal black/white edge check still catches that noise.

The correction uses `GameView.probeCrowdMask` / the existing infected ID pass, exposes a small Scene Lab wrapper and restores the normal render in `finally`. It rejects mismatched mask dimensions. All consumers are infected appearance fixtures: nine colour scenes (54 tier/zoom rows) and one silhouette scene (six rows). The completed 60-row rerun and original 2,190-row sweep are reconciled, with per-row metrics hashes, in [matrix audit](../checks/matrix-final.json). No foot probe or geometry is modified.
