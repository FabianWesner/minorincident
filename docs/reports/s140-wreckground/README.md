# s140-wreckground — native audit in progress

## Outside-wire standstill

Ran the full registered L4 mission on the native simulation (seed 1, HIGH, complete bot): 18,468 ticks through mission progression. Every tick, the observer considered living, visible, non-emerging infected outside the perimeter and within 2 m of the authored perimeter walls. It counted a tick only when the infected `NavGrid` had a path from that actor to the courier. The scan recorded 29 actor intervals lasting at least five seconds; none accumulated less than 1 m of travel during its interval. This aggregate does not exclude a stationary five-second subwindow inside a longer moving interval. Closure requires a rolling-window scan with actor target and attack state. IDs, archetypes, interval ticks, duration, travel and closest wire distance are in `qa.json`.

The existing `checkOutsideWireRouting` regression also passes. It covers one actor following the perimeter to an opened north breach for 600 ticks. The full-run scan extends that evidence to real actors and path validity without changing AI stats or corpse handling.

## Wreck grounding

The source-layout inventory is 414 vehicle wrecks. The renderer-shared resolved `district.decay.placements` inventory contains 409 at-load placements: L1 0, L2 0, L3 23, L4 0, L5 25, L6 1, L7 38, L8 0, L9 84, L10 238. Five L8 candidates are filtered before rendering. This turn did not measure contact gaps against resolved terrain heights and did not perform the requested full-level backend close-ups. `isolated-wreck-reference.jpg` is only the previously reviewed isolated HIGH WebGPU comparison; it is not campaign grounding evidence.

## Remaining work

- Measure the lowest wheel/body contacts against terrain and raised-road support for the renderer-resolved placements, including L9 and streamed L10. Then list offenders and fix placement data if needed.
- Render and review HIGH WebGPU and WebGL2 full-level close-ups at zoom 1.5 for the worst ten and five random in-range wrecks, with identity-checked rendered matrices.
- Add any discovered ground-gap condition to the existing placement gate and extend existing tests only.

## Measurement follow-up

`DistrictBuild.restOnGround` changes rendered vehicle Y using the median of four support samples when authored Y is at most 1 cm. A native contact scan must reproduce this renderer adjustment as well as asset mesh transforms; raw resolved placement coordinates are insufficient. The L4 preliminary scan also needs rolling five-second windows before standstill can be ruled out.

## Rolling-window reproduction

The repeated native seed-1 HIGH complete run finished at tick 18,468 and evaluated 15,405 eligible rolling windows longer than five seconds. Three identities travelled less than 10 cm during a window: Alpha #296 (ticks 3005–3306, zero movement), Alpha #372 (7584–7885, 9.87 cm), and crawler #233 (15676–15977, 9.69 cm). All three retained a scripted destination and targetId 0 despite the independently checked route to the courier. This contradicts a broad no-standstill conclusion from the aggregate scan. Navigation/script ownership still needs diagnosis and correction; no fix is claimed. Exact states and positions are in `qa.json.outsideWireRollingScan`.

## Script ownership diagnosis

`InfectedSystem.followScript` suppresses ordinary targeting while a scripted destination remains set and stops seeking within 0.6 m of it. `LevelFourWar.funnel` excludes Alphas from its open-breach routing loop. `L4Collapse` also deliberately assigns stationary scripted holds before battle beats. These sources explain why targetId 0 alone cannot establish a navigation defect. Next capture must match each flagged identity to its director Alpha job, breachApproach and pressure target before changing ownership. The exact rolling-scan source is preserved in `qa.json.rollingScanReproduction` using repository-relative imports.
