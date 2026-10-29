# l10-narrow-roads (Opus, 2026-10-29)

PO decision 10-29: "Narrow roads + verges". Base: main `28e7c1a8a`.

## Change (layouts/D-CURE/layout.py)
- R1–R7 carriageway 8 m → 6 m (two 3 m lanes; road edges `laneWidth` 6). The tank (3.35 m) and the APC (2.95 m) fit one lane plus margin.
- R1/R3/R4 (rural): no sidewalk; a worn edge line at 2.7 m and the gravel shoulder band from the asphalt edge.
  R2/R5/R6: a 0.8 m kerbed sidewalk (3.0–3.8 m).
- Verge dressing, crop fields, lawns, R5 parking bays and road-life pieces move in by 2.0 m in R1/R3/R4 and 1.5 m in R2/R5.
  The dressing clearances shrink by the same amount. Detours, R5's finale approach (x ≥ 2800), R6 and R7 keep their solids.
  Field pole lines follow the road at 7.5–10 m (were 17–21 m, outside the frame). Story spots move in at most 1 m.
- `NightAccents.cureAccents` measures the lane from the 3 m edge. That keeps the story fires 8.5 m past the edge.
  The AC16 night-read specs sample the real 3 m half width (`halfWidthM: 3`), so the verge samples sit 4.5/6/7.5 m out.

## Finale calibration finding (important for later L10 layout work)
`tools/qa/l10-arrival-check.ts` (high tier) does not follow the geometry. It follows the **number of pushable props**.
Every pushable becomes a sim entity before the infected and the Mega spawn, so adding one shifts all their entity ids.
Bisected with layout-JSON variants on the runners (high tier):

| variant | arrival | released |
| --- | --- | --- |
| main | 143.15 | yes |
| new placements + colliders | 142.85 | **no** |
| new roads/paving only | 143.15 | yes |
| new colliders only | 143.15 | yes |
| main, R1/R2 colliders moved 0.3 m | 143.15 | yes |
| main, one extra static collider (first or last) | 143.15 | yes |
| main + 4 trash bags 1.3 km west of the finale | 142.85 | **no** |
| main placements from x ≥ 1837 (R4–R7 identical), new R1–R3 | 142.22 | **no** |

The layout now keeps the authored count of 97 pushables and fails the build when it falls short. Surplus R1–R4 verge and
field pushables are removed. This probably also explains the earlier "R3 field pieces moved the finale" note in this file.
A sim-side fix would remove the coupling, for example entity ids for infected and the boss that do not depend on how many
props exist. That is left to the orchestrator.

## Evidence
- `before-after.jpg`: world-fill L10 stations R1–R6. Before = WebGPU high z1/z1.5; after = WebGPU high and low z1/z1.5 plus WebGL2 z1.
- Arrival: high 143.15 s, low 143.22 s, cure released, 0 deaths (identical to main).
- Night read (AC16, WebGPU, 3 m half width): R1 4.2, R2 3.4, R3 3.2, R4 3.3, R5 2.9, R6 3.5 (gate 2.5).
- Scene gate 48/48. Catalog `world-fill-l10-*,look-l10-*,l10-roadlife-*,l10-region-seam,l10-d*` 49/49 (clipping, draws ≤ 300, triangles ≤ 500k).

## Honest look score
Before ~4.5/10, after ~5/10. At zoom 1.5, hedges, houses, parked cars, the R4 tank, sandbags and the R1 fences, pickup and
crop rows now sit right at the road edge. At zoom 1 the game camera spans only about ±6 m across the road, so even a 6 m
road fills about half of the frame. Fields, camps and burning cars at 11 m or more stay out of frame unless the camera or
the AC16 light clearances change. R1's station is now lit by an evac light tower's flood, which reads like daylight.
