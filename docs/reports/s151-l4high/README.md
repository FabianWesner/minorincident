# s151 — L4 HIGH cellar approach

## Status

The goal remains unqualified. Preview/Git permissions are now available. The first candidate HIGH WebGPU run completed in 483 seconds with six escape deaths. A subsequent candidate run capped at 542 seconds with nine escape deaths (one on Lakeshore and eight near central Harbor), so neither meets the five-death target. LOW remains pending. Further experiments with a 150-second diversion capped with nine escape deaths; reducing the near-pursuer exemption to three metres capped with eighteen escape deaths on Lakeshore. Both diversion experiments were reverted to the existing 75 seconds / seven metres.

The prescribed remote suite now passes on 46.225.66.90: 174 seconds overall, with the original-route contact test taking 103.2 seconds. The test defers expensive connectivity searches until the stationary observation window is full and resets that window when breaches change. The Harbor shortcut was removed after its Linux timeout.

## Batch-114 diagnosis

The retained HIGH WebGPU log records 26 deaths: 11 during `hold` and 15 during the cellar `hide` objective. Those 15 escape deaths cluster on western Harbor, mostly around x=-49 to -54, z=-34 to -41, while the courier repeatedly approaches the marker at (-64,-39.5). Representative death-adjacent observations show three to sixteen drawn infected within roughly 1–4 m (for example IDs 475, 301 and 469 at tick 20920, and IDs 467, 308 and 465 at tick 21880). Some samples occur after a respawn and show no nearby enemies, so browser proximity cannot identify every killing blow.

The most likely HIGH/LOW difference is encounter admission and crowd size, not renderer draw distance. The collapse uses full authored group sizes on HIGH and half sizes on LOW: the heavy/Alpha groups beside western Harbor were four bodies on HIGH versus two on LOW. At line-break, the street gap lasts 75 seconds and prevents those homes from emerging while open. The first hide-death observations are more than 120 seconds after line-break; they coincide with arrivals and a dense crowd on the route. Nearby infected in sampled death observations are marked `drawn: true`, so hidden threats are not the primary explanation. The exact attacker-to-death mapping remains unproven.

## Changes

- Moved the four-body Alpha encounter from (-66,-40.2) to the reachable north side street at (-60,-20).
- Moved the four-body heavy encounter from (-74,-40.4) to a reachable south side street at (-60,-54).
- Kept the HIGH/LOW size scaling, enemy archetypes and stats, horde population, corpse persistence and all authored encounter bodies. The new test checks that both homes are walkable, connected to western Harbor and more than 8 m from the cellar route.
- Kept the final waypoint at the actual cellar interaction anchor. Its ground ring now renders through the storefront shell on the final L4 approach, and the contact test verifies that the last Harbor turn points to the cellar door and that the door is clear and path-connected.
- Kept the original LOW full-route replay and all its completion/stall assertions. Expensive path connectivity is checked only after a stationary observation window fills; breach changes reset that window. The focused test took 33.9 seconds locally, 103.2 seconds on runner 46.225.66.90 and 114.6 seconds on previously failing runner 94.130.181.173.

## Validation

| Check | Result |
| --- | --- |
| Native HIGH L4, seed 1 | Complete in 301.5 sim seconds; 8 deaths, all during the war at ticks 79–216 s; no escape deaths. |
| Focused `tests/engine/l4-contact.test.ts` | Passed, 33.9 s locally. |
| `npm test` unchanged | Passed: 27 files, 106 tests; 109.2 s, under the 240 s budget. |
| Typecheck / lint / QA build | Passed. |
| Remote `sh tools/remote/run.sh "$PWD" -- npm test` | Passed on both runners: 174 s on 46.225.66.90; 204.4 s on 94.130.181.173 (150-case inventory). |
| Real-input HIGH / LOW WebGPU | HIGH completed once with six escape deaths; later candidates capped with nine or eighteen. Target remains unmet; LOW pending. |

The reviewed [approach sheet](approach-review.jpg) pairs the batch-114 western Harbor frame at 20 m with an earlier HIGH cellar-interaction frame at 5 m. Both depict the existing marker/door treatment; neither is a screenshot of this candidate after the level-design change. The batch-114 capture shows the off-screen route arrow and readable objective text. The earlier close frame shows the cellar objective and map pin, though the storefront entrance itself is partly occluded; the candidate-only WebGPU visual check remains open.

`qa.json` is the compact evidence record (under 200 KB). Raw batch-114 logs and captures remain in the archived s149 scratchpad, not in this report. No `tools/playtest` files, specs, protected references, main branch, deployment or remote publishing were changed.
