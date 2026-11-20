# s192-l7harder — L7 encounter pass

## Result

L7 now authors **560 HIGH / 280 LOW** regular infected (+40%) and keeps concurrent caps at **200 / 100**. The higher 240 / 120 caps were not enabled: the native sim proxy measured HIGH update p95 at **4.12 ms** at 200 active and **4.31 ms** at 240, against the 4 ms HIGH budget. HIGH peak active count in the final native acceptance route was 200; peak living characters were 236. Real-device frame timing remains pending.

Opening and subsequent street groups use road-connected placements spread across the road and its verges, with each scheduled wave requested in one tick. The opening selects a 16-runner advance party using angular sectors; the authored population is delivered through the existing queue/recycling path. Requests do not prove actual arrivals from three directions within five seconds: admission, pathing, and the moving column must be measured for every fight. That requirement remains open. A native skilled-route admission trace on both tiers found opening group 701 across four cardinal sectors in its first five seconds, but each later group occupied only one sector relative to the courier during its first five seconds of admission. These measurements describe spawn admission positions, not subsequent approach or contact. A further native skilled-route proximity trace sampled visible living infected within 12 m of the courier at 2 Hz while she was within 18 m of each street anchor. In the best five-second window, opening street 0 had four sectors on both tiers; street 1 had one on both, street 2 had zero LOW / one HIGH, and street 3 had zero LOW / four HIGH. This is a proximity measure rather than a count of attack windups, but it confirms the current street layout needs more pressure from other sides. The diagnostic is `tools/qa/l7-direction-probe.ts`. The final HIGH horde is 168 (LOW 84). Zombie stats are unchanged.

## Survival and completion

| HIGH skilled native route | Before (400 regulars) | After (560 regulars) |
|---|---:|---:|
| Route | Complete, 107.67 sim s | Complete, 107.48 sim s |
| Courier deaths | 0 | 0 |
| Damage taken | — | 190 |
| Evacuees saved | 14 / 24 | 7 / 24 |
| Evacuees killed / turned | 0 / 10 | 12 / 2 |

The harder HIGH route still completes through bus departure. The larger stream shifts more losses from turning to direct deaths while keeping courier deaths at zero. The passive LOW threat route also completes with 24 / 24 saved.

## Checks

- `npm run typecheck` — pass.
- `npm run lint` — pass.
- `npm test` — pass, 106 tests in 27 files.
- `npm run qa:threat` — pass, **0 flags**; L7 skilled and passive routes complete, kiting probe landed 1 hit in 20 seconds (3/min), and follower pace passes across seeds 1–3.
- HIGH local acceptance command `npm run qa:accept -- --level L7 --skip-browser --tier high --policy complete` — native route complete; 8 fixture clauses and 3 checkpoints pass with 0 errors. Report assembly then exits because historical criterion `G-28` is missing from the report source rows in `tools/qa/accept/report.ts`.
- Remote unit suite passed: 105 passed, 1 skipped, 27 files. Both remote HIGH and LOW acceptance routes completed, with 8 fixture clauses and 3 checkpoints passing per tier; both report assemblies exited on missing historical criterion `G-28`. The pulled `docs/reports/fix51-verify` files were restored.
- Native proxy timing is recorded above; real-device timing is pending.

## Visual capture

The HIGH zoom-1 headless playtest ran under the browser lock on port 5125, but its input bot remained at the launcher until the five-minute cap. No junction capture is claimed.

## Changed acceptance rows

`docs/qa/level-acceptance.md` L7-04 / L7-05 and Epic 29 AC08 / AC19 record the PO quote, revised population, conditional cap ceiling and the requirement for at least three road-connected arrival directions within five seconds per street/junction fight. Existing unrelated targets are retained.

## Acceptance report repair

The report inventory now recognizes G-28 and G-29 as new, historically unqualified rows. A fresh HIGH complete acceptance run assembled successfully but returned exit 1: current G-13 / L7-09 follower pace flags include survivor 107, and L7-01 lacks a passing physical pickup/frame gate. Ten L7 rows remain incomplete. These results require follow-up and are not a passing acceptance report.

A trial that repeatedly activated each staged street group within 45 m did not improve the LOW direction trace and left the HIGH native route incomplete at its tick budget. The trial was reverted. Later waves need different road-connected approach placement or staging, with their admission and contact timing verified before retaining a change.

A subsequent trial spreads each later street group across four road-connected approach locations. With the existing recycling rule, both native skilled routes complete: HIGH has at least three proximity sectors in all four sampled streets, and LOW has at least three in streets 0, 1 and 3 but none at street 2. A further trial recycling stragglers earlier improved LOW street 2 to three sectors, but left HIGH incomplete and reduced LOW street 3 to one; that recycling change was reverted. The approach placement is retained as work in progress, not a validated completion; threat audit, offscreen visual review, and final tier-wide direction proof remain required.

LOW middle-street requests now start 30 m earlier. The native skilled proximity trace then shows three or more sectors at LOW streets 0–2 and all HIGH streets, with both routes completing; LOW street 3 shows none in its sampled window. Earlier LOW final-street requests and delaying the corridor horde were also tried, without improving that window, and were reverted. The full threat audit and population delivery must be rerun after the final timing is settled.

The LOW director cap was inadvertently halved twice: assigning 100 as `levelCap` produced an effective cap of 50. Setting the shared director input to 200 restores the intended effective LOW cap of 100. The skilled native proximity diagnostic now sees all four sectors at every sampled street on both tiers, and both routes complete. This is a five-second proximity window, not proof of simultaneous attacks or a visual review. The subsequent full `qa:threat` run has one flag, `L7/step/departure:SLOW_FOLLOWER:105`; LOW skilled completed with 24/24 saved and 0 courier deaths. Typecheck and lint pass. The zero-flag requirement and visual capture remain open.

Guard catch-up speed 7.2 m/s cleared the LOW follower-pace flag but caused the retreat kiting sample to fall to zero landed hits. Expanding the opening advance party from 16 to 20 with that speed still had zero landed hits and introduced two follower-pace flags. Both trials were reverted; the retained version has one follower-pace flag and needs a formation fix that preserves threat pressure.

A departure-only guard catch-up increase to 7.2 m/s was also tested. The full threat audit returned two follower pace flags (105 and 106), so the trial was reverted.

Widening the armed escorts’ formation slots during departure clears the follower pace issue without changing opening pressure. The full `npm run qa:threat` audit then completed with **0 flags**, including all LOW follower seeds; typecheck and lint pass. The per-street proximity trace is not a visual capture or proof of attack windup directions, and those checks remain open.

A headless HIGH WebGL2 capture at zoom 1 was taken at tick 2040, near the second street anchor, using the native completion bot under the browser lock. I inspected [the frame](junction-high-z1.jpg): it shows the courier, escort and a dense battle with many bodies, but separate directions of live arrivals are not legible in the still. It does not establish the requested multi-side visual proof.

`tools/qa/l7-windups.ts` observes targeted infected attack telegraphs against the courier or following humans, classifies the attacker relative to its target, and searches five-second windows while the courier is within 25 m of each street anchor. Both skilled routes complete. Opening and first later street show four directions, and the next street shows three, on both tiers. The final junction shows zero qualifying windups in that window on both tiers, so proximity alone overstated its combat pressure. This diagnostic excludes support roars, screams and revives.
