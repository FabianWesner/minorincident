# L2 / L4 finale stretches — PO #7, #7b, #17, #17b

## Result and measurement

One existing-runner simulation test per PO bug, with high and low quality. Seed 1 uses ordinary newbie inputs; the L2 police reproduction also uses the riverside bypass, which previously arrived alone. An engagement is a unique infected chasing/biting the courier, or hit by the courier, within 16 m and with clear line of sight. Police counts require a checkpoint officer firing while both officer and target are in the game-camera frustum, with the courier within 12 m of the gate. Rates include retries; the death counts are shown alongside them.

| Reproduction | Before high / low | After high / low |
| --- | --- | --- |
| L2 all infected engaging per minute on the direct supermarket→bridge stretch | 36.69 / 21.65 | 51.60 / 23.31 |
| L2 street infected engaging per minute, excluding the market and bridge cluster | 7.98 / 1.67 | 16.64 / 6.66 |
| L2 police targets visibly engaged on bypass arrival | 0 / 1 | 11 / 7 |
| L2 direct-route newbie deaths | 1 / 0 | 0 / 0 |
| L4 infected engaging per minute, from Fall back through the cellar approach | 36.96 / 7.29 | 35.66 / 13.22 |
| L4 active 15-second intervals | 1/3 / 1/3 | 5/6 / 6/6 |
| L4 newbie deaths | 2 / 1 | 2 / 1 |

The L4 high-tier baseline rate was concentrated entirely in the first interval beside the army. The longer ending now engages 51 distinct infected at high quality and 18 at low quality. Its 15-second counts are `[41,1,0,2,16,2]` / `[4,4,5,1,6,5]`, versus `[23,0,0]` / `[4,0,0]` before. The final-source pressure rerun passes; JSON is in [after/](after/).

The unchanged caps are L2 60/30 infected, L4 120/60 infected and 190/95 characters. Death limits remain L2 ≤1 and L4 ≤2; no test or performance budget was relaxed. Baseline JSON is in [before/](before/); after JSON and the final checks accompany this report.

## What changed

- L2 street homes now have actual street emergence anchors, watch the incoming street, and use normal sight/LOS. The phone population reserves its first two street beats before admitting the bridge cluster. Recovering bodies retain cap slots after the escape starts; restoring an earlier checkpoint restores its population mode.
- The arriving courier draws the bridge group toward a fixed point eight metres in front of the police line. Police engage it on camera; the road and riverside escape remain open. The supermarket sequence is untouched: alarm, departure, arrival and doors-open timestamps match the baseline exactly.
- L4 keeps the tank, helicopter, soldiers, collapse beats and original 40-second break-away corridor. Street groups are staged by remaining route distance, preventing nearby-but-much-later Harbor groups from spending the Lakeshore slots. When the war already occupies those slots, nearby unseen regulars travel to the street beat on foot, retaining HP and identity. There are no teleports or live-player pursuit goals in this staging.
- The cellar moves to the far northwest Harbor frontage by swapping two existing building shells and their solids. L5 uses the same shared transformation and matching exit. One existing street-end pallet moves to the opposite curb, clearing the doorway and its westward pavement approach.
- Both HUD paths show route distance and a next-turn minimap pin. The gold direction arrow follows the next street turn and switches to the destination nearby; the 3D destination beacon remains attached to the real cellar door. The objective and radio name the streets.

## E22 update for the orchestrator

D-FAIR only: plaza east exit → Lakeshore Avenue east → Metro Road north → Harbor Street west → cellar at `(-79.3, -45.2801)`. The full polyline and existing time bands are in [route.json](route.json). The added Metro blocks, eastern Lakeshore and outer Harbor frontage were outside the original ending.

The duration refers to the marked Lakeshore–Metro–Harbor route. The existing Harbor escape remains a shorter alternate route, preserving the independent-route criterion.

The polyline is 297.2 m; navigation measures approximately 302–305 m, or **2:31–2:33 at 2 m/s walking speed**. Running shortens it. Measured newbie totals are 351.02 s high and 359.27 s low, within the existing 275–490 s band; the complete-bot band stays 260–460 s. Existing medkits offer optional stops along Lakeshore, Metro and Harbor. No spec file was edited; the orchestrator owns the requested E22 route/time update.

## Camera review and QA

Seven Scene Lab scenes are in the matrix catalog: bridge, L2 streets, L4 egress, Lakeshore, Metro, reused frontage and relocated cellar. All **84/84** matrix rows pass ([gate records](qa-matrix.json)). The matrix covers WebGL2/WebGPU × high/low × zoom 1.5/1.0/0.5, including both PO-required zooms. Frame/draw/triangle gates use existing E18 limits; the bridge's high/low triangle limits are 1.5M/500k. A small optional low-tier limit in the existing Scene Lab evaluator expresses that existing tier distinction.

Inspected [game-camera sheets](captures/) show:

- **L2 streets:** the four figures enter the frame and close on the courier; both sidewalks remain clear. At zoom 0.5, individual bodies and weapon poses remain legible.
- **Bridge:** police lightbars, officers and the approaching group read as a defended line. Officers enter the close camera as the courier crosses the open central barriers and fire at the crowd.
- **L4 egress:** the courier/corgi stay visible through the garden exit and onto the road; foliage briefly overlaps the foreground without filling the viewport.
- **Lakeshore:** [the approach sheet](captures/l4-finale-lakeshore.jpg) shows two stragglers closing through the junction while the road and opposite sidewalk remain open.
- **Metro:** infected approach the courier along the road; the parked car leaves the opposite side open. A foreground facade initially overlaps the wide camera edge, then clears as the courier advances.
- **Reused frontage:** the moved apartment and retained shopfronts align; the road and pavement are clear, with no overlapping facade or roof-filled frame.
- **Cellar:** the Harbor doorway and objective ring are visible, the courier walks up to them, and pursuers remain on the open road behind. The curb approach and real-input descent/brace/L5 exit pass after moving the pallet.
- **HUD:** the plaza tracker reads approximately 310 m along the street route; at the door it reads 3 m. The gold arrow points toward the next street turn from the plaza, then toward the visible doorway on arrival; the 3D beacon stays at that doorway. All eight final guidance checks pass ([summary](guidance-final.json)).

The initial fresh-build deploy-gate subset passed 94/99 browser checks. A fresh-build **15/15 rerun covers all five failures**: four relocated-entrance fixtures/curb checks, and a movement check that had clicked a visible infected instead of ground. All eight guidance configurations pass. Raw initial and rerun summaries are linked beside this report.

## Validation and remaining evidence

- Typecheck, lint and production build pass.
- All four new PO tests fail against the original runtime. Focused pressure tests pass after the fixes. Existing L2 newbie/gate/restore and final L4 complete/newbie/evade checks pass; [final check summary](final-checks.json).
- The full remote unit + sim + levels sweep completed: **2,794 passed, 24 failed, 9 pending**, on the initial implementation snapshot. [Initial failures](full-suite-initial.json) retain the distinction between subsequently fixed lane failures, shared-runner timing failures and the campaign failure at L7 bus-departure. The continuous campaigns reached L4 successfully, then stalled in L7 with shelter followers not marked passed; this report does not claim that campaign gate green.
- The [isolated remote timing rerun](timing-isolated.json) passed **196/197** tests: all numeric CPU budgets passed, including E18 200/100 infected. The remaining failure is the L10 seed-32 rocket-arrival test exceeding its unchanged 120 s deadline. L2 objective-patrol sim p95 was 0.93/0.85 ms high/low; L4 was 0.42/0.31 ms, against 4/6 ms. The [native timing attempt](native-timing.json) ended at its 15-minute limit before admission and released its locks. **Native frame and hitch budgets remain unmeasured.** No timing budget was changed.
- Repeated-death relief passes its unchanged density test: counts within 25 m after deaths 1–4 are **22, 15, 8, 1**. The same relief fractions remove the closest share, including recovering bodies, only after the escape has started. Earlier checkpoint behavior is retained.
- The evade-only trace exposed waypoint advancement occurring after dodge planning: the bot kept circling a reached Metro Road corner. Advancement now precedes dodge planning; all three final legacy-route tests pass (complete seed 3, newbie seed 4, evade seed 2 plus low-tier completion). No attack, death or time limit was loosened.

Implementation commits before the final QA handoff: `5e247bcf3` (#7/#7b), `5b7d409c9` (#17), `a695c46ad` (#17b), `fbb6200e8` (L2 slot/arrival tuning), `24e6a8896` (L2 retry relief), `617536049` (L4 staging and route QA), `07f2a3bf6` (turn-by-turn street guidance).

No deploy or merge was performed. Forbidden directories and `src/assets/staticCollision.ts` were not changed.
