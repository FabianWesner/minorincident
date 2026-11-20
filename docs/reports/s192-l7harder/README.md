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

On the current committed build, a fresh native skilled-route census reached the bus on both tiers with no courier deaths and no queued requests at departure: HIGH admitted 560 regulars and 5 Alphas, saved 18/24 (4 dead, 2 turned), cap 200; LOW admitted 280 regulars and 5 Alphas, saved 24/24, cap 100. This supersedes the earlier after-run survivor counts above. A trial moving the final junction approach 25 m east still yielded no LOW windups and only two directional windups on HIGH; it was reverted. The final junction requirement remains open.

Moving the two posted junction guards to the bus approach lets the final junction group engage before being cleared by guard fire. The targeted windup trace now sees two directions there in a five-second window on both tiers (previously zero), while all other streets retain at least three and both skilled routes complete. The full threat audit passes with 0 flags, as do typecheck and lint. A third final-junction attack direction and an updated visual capture remain open.

Correction to the earlier windup findings: the observer previously counted the same attacker in multiple sectors as it moved and included attacks on posted guards far from the column. The diagnostic now counts each source once per five-second window and only targets within 25 m of the courier. Both tiers show three sectors at the opening and four at the next street; LOW shows three at street 2, HIGH only one; both show zero at street 3. A trial narrowing the final junction side positions did not improve those results and was reverted. The three-direction criterion remains unmet at the affected fights.

Staging the final HIGH street group at x=140 rather than x=95 yields at least three distinct targeted windup directions within five seconds at all four HIGH anchors; the HIGH skilled route completes. LOW retains its previous timing: its final junction still lacks three measured directions. Full `qa:threat` passes with 0 flags, as do typecheck and lint. LOW final-junction staging and the updated visual capture remain open.

LOW population rebalance trials moved 14 regulars from either the middle street or the rear pack to the final junction, keeping the 280 total. The first reduced the middle-street result to one direction; the second retained three there but produced zero final-junction windups, or one when requested earlier. Both skilled routes completed; neither variant met the direction requirement, so both were reverted.

Two further LOW junction trials were rejected: periodically pressing the staged junction group produced no qualifying windups, while requesting the junction earlier and deferring the final corridor horde until x=35 produced one direction. Both routes still completed, but neither met the three-direction target; the changes were reverted.

LOW final-junction staging now releases eligible living opening stragglers only when offscreen and more than 80 m behind, reserves the junction before its corridor horde, and places its side approaches closer to the road. The distinct-attacker windup probe measures at least three sectors within five seconds at every street on both tiers. Full `qa:threat` passes with 0 flags; typecheck and lint pass. A fresh native census admits all 280 / 560 regulars and five Alphas per tier with empty queues. LOW completes with 24/24 saved and 0 courier deaths. HIGH completes with 4/24 saved, 18 dead, 2 turned and 1 courier death: this supersedes earlier HIGH results and falls below the existing survivor target. HIGH fairness remains open, as do final acceptance and an updated visual capture.

Four additional mortal rifle guards cover the HIGH corridor using shared soldier stats. Fresh skilled native runs complete both tiers with 24/24 survivors, zero courier deaths, all 560/280 regular arrivals and five Alphas, with empty queues. The distinct-attacker windup probe records at least three directions at each sampled street on both tiers. The complete threat audit returns 0 flags; typecheck and lint pass. The prior HIGH 4/24 result is superseded. Final remote acceptance, remote units, real-device timing and an updated visual capture remain to be checked on this revision.

Final-revision remote verification: `npm test` passed (105 passed, 1 skipped, 27 files). Separate HIGH and LOW `qa:accept --skip-browser` runs each completed the skilled route, eight fixture clauses and three checkpoint clauses; each exited 1 with L7-01 physical launcher approach / first rocket frame gate failing and 11 L7 rows incomplete. Pulled `fix51-verify` artifacts were restored after inspection. Real-device timing and updated visual review are still pending.

A current HIGH zoom-1 headless WebGL2 capture at tick 1122, during the first later street fight, replaces the earlier image. Inspection shows infected approaching from the upper and left sides while the column fires, with multiple bodies and blast effects; the still alone does not establish three timed directions. The L7-01 physical pickup fixture referenced by the remote report is historical: both saved tier receipts report passing mechanics and frame gates but carry source hash `6bd47c…`, which predates this build. A current physical pickup/frame run is required to resolve the reported failure.

Current physical launcher check: headless Metal WebGL2 on port 5125, one browser under the lock, with native L5→L6 carried saves and real WASD / mouse input. Both tiers collected the launcher while moving from 3 m away without interact input and fired the first rocket. LOW pickup / shot windows peaked at 33.4 / 16.8 ms; HIGH at 33.3 / 16.8 ms, each below 50 ms with at least 21 frame samples and no errors. Raw receipts are `pickup-low.json` and `pickup-high.json`; the reproducible producers are `tools/qa/accept/s192-l7-save.ts` and `s192-l7-pickup.mjs`. The acceptance adapter now validates these current-source receipts against the producer, frame probe and archived seed hashes; both physical mechanics/frame clauses pass. The separately reviewed launcher capture clause remains not checked.

A repeat on the retained producer produced pickup / shot maxima of 16.8 / 16.8 ms LOW and 33.4 / 16.8 ms HIGH. The adapter was exercised directly: both current physical pickup/frame clauses pass and the separate visual review remains not checked.

Cross-platform receipt verification now hashes the original archived gzip bytes rather than recompressing them. Both remote split-tier acceptance runs completed their native routes, fixtures and checkpoints with **0 fresh failing rows**; each exited 2 because all 12 L7 rows still contain incomplete clauses. The L7-01 physical pickup/frame clauses pass for both tiers, while its separate capture review is not checked. Pulled `fix51-verify` artifacts were restored.

Final gameplay revision native timing proxy (single local run per configuration; `performance.now()` around each `world.update`, ordinary skilled route, no renderer): HIGH at cap 200 peaked at 200 and measured p50 3.98 / p95 13.13 / p99 22.40 ms over 6,118 ticks; trial HIGH cap 240 peaked at 240 and measured 4.59 / 13.06 / 16.93 ms over 6,146 ticks; LOW cap 100 peaked at 100 and measured 2.48 / 7.39 / 15.04 ms over 6,133 ticks. All three runs completed with 24/24 saved, zero courier deaths and full authored arrivals. Both HIGH trials exceed the 4 ms sim p95 target and LOW exceeds its 6 ms target on this loaded Mac; the cap increase is not justified. These proxy timings are load-sensitive and do not establish real-device frame timing, which remains pending.
