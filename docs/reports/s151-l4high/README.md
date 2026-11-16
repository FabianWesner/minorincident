# s151 — L4 HIGH cellar approach

## Status

HIGH WebGPU visible-input L4 completes in **429 seconds with four escape deaths** (eight defense deaths), no skips. Native HIGH completes in 302.3 sim seconds with zero escape deaths. LOW ran after HIGH on the same build and capped at 541 seconds with eleven escape deaths on central Harbor; LOW completion/regression remains open.

The final prescribed remote suite passed on 94.130.181.173 in 201.9 seconds. Earlier checks confirmed the cheaper original-route contact test at 103.2 seconds on 46.225.66.90 and 114.6 seconds on 94.130.181.173. Build, typecheck and lint passed. All browsers were headless, one at a time through the pool/e2e lock, with ten-minute reservations, ports5039/5040, `PLAYTEST_VISIBLE_ONLY=1`, `PLAYTEST_BACKEND=webgpu`, zoom1.5.

Earlier HIGH candidates completed with six or eight escape deaths or capped. Extending diversion to150 seconds and narrowing the pursuer exemption to3 m did not help; both were reverted. The successful final change adds health kits at (-4,38), (-1,42), (-73,-39.5), (-79,-42) and checkpoints at more existing route corners. Bodies, counts, stats and corpses remain intact.

## Batch-114 diagnosis

The retained HIGH WebGPU log records 26 deaths: 11 during `hold` and 15 during the cellar `hide` objective. Those 15 escape deaths cluster on western Harbor, mostly around x=-49 to -54, z=-34 to -41, while the courier repeatedly approaches the marker at (-64,-39.5). Representative death-adjacent observations show three to sixteen drawn infected within roughly 1–4 m (for example IDs 475, 301 and 469 at tick 20920, and IDs 467, 308 and 465 at tick 21880). Some samples occur after a respawn and show no nearby enemies, so browser proximity cannot identify every killing blow.

The most likely HIGH/LOW difference is encounter admission and crowd size, not renderer draw distance. The collapse uses full authored group sizes on HIGH and half sizes on LOW: the heavy/Alpha groups beside western Harbor were four bodies on HIGH versus two on LOW. At line-break, the street gap lasts 75 seconds and prevents those homes from emerging while open. The first hide-death observations are more than 120 seconds after line-break; they coincide with arrivals and a dense crowd on the route. Nearby infected in sampled death observations are marked `drawn: true`, so hidden threats are not the primary explanation. The exact attacker-to-death mapping remains unproven.

## Changes

- Moved the four-body Alpha encounter from (-66,-40.2) to the reachable north side street at (-60,-20).
- Moved the four-body heavy encounter from (-74,-40.4) to a reachable south side street at (-60,-54).
- Kept the HIGH/LOW size scaling, enemy archetypes and stats, horde population, corpse persistence and all authored encounter bodies. The new test checks that both homes are walkable, connected to western Harbor and more than 8 m from the cellar route.
- Kept the final waypoint at the actual cellar interaction anchor. Its ground ring now renders through the storefront shell on the final L4 approach, and the contact test verifies that the last Harbor turn points to the cellar door and that the door is clear and path-connected.
- Kept the original LOW full-route replay and all its completion/stall assertions. Expensive path connectivity is checked only after a stationary observation window fills; breach changes reset that window. The focused test took 33.9 seconds locally, 103.2 seconds on runner 46.225.66.90 and 114.6 seconds on previously failing runner 94.130.181.173.

## Final evidence and limits

Raw final runs: `test-results/s151-l4high/gpu-high-recovery` and `gpu-low-recovery`. JSON records both results, renderer receipts and death counts. The reviewed [approach sheet](approach-review.jpg) now uses the successful candidate HIGH capture at tick24452 and its cellar bar-door capture. The Harbor frame shows readable text, direction arrow and open street; the cellar frame confirms entry and readable bar-door objective. The actual external door ring is not captured at close range, so its visual assessment is limited; navigation and real-input entry prove reachability.

The unchanged 150-case inventory and all existing contact assertions remain. Connectivity searches are deferred until a stationary window fills; breach changes reset the window. No timeout increase or other test trimming. Each final browser run emitted one provisional stationary-infected warning during defense. LOW completion remains a regression follow-up; it is not an accepted pass.

No tools/playtest, specs or protected references changed. No deploy, push or main movement. Report JSON is below200KB and only one small reviewed sheet is committed.
