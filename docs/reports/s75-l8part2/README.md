# s75 L8 redesign part 2

## Status

Incomplete overall; stopping at the requested timebox. The current full audit reports **L8 skilled complete, passive tick-budget, 0 passive flags** after the calm-tour wall fix. Required remote unit suite, focused mission test, typecheck and lint pass. Current geometry still needs a fresh marker-only real-input tour, final-position HIGH/zoom-1 captures and comprehensive live confinement/closure acceptance; flamingo part 2 and cover/lighting polish are implemented only to the extent documented below. Earlier captures and travel receipts precede final edits and are not final acceptance evidence.

## Audit change

`tools/qa/threat/observer.ts` excludes living infected from the `L8/step/escape` reachability denominator only when their position is inside an authored `l8Route` pen and both entry and exit gates are closed. The controller phase and other levels retain their full census. `tools/qa/threat/proof.ts` checks closed-pen, outside-pen, and opened-gate cases; the proof command passes.

Latest targeted audit output (diagnostic `--levels L8` run):

> L8: skilled complete, passive tick-budget, 1 passive flags (92.9s)

The passive `step/escape` row still has `UNREACHABLE_SHARE_OVER_30_PERCENT_FOR_OVER_20_SECONDS`. Other diagnostic fail flags include partial level selection and unverified main-source baseline. This is not the required full-audit receipt and does not meet the zero-flag requirement.

## Route and flamingo work

The route gate QA was changed to load an independent world for each gate state. The runner yard leg now follows the authored route nodes from the plaza, since the elephant leg alone assumes the courier is already at the gorilla exit. The check still fails with five pens cleared: the runner does not reach the yard (last position about x=54, z=64). The failed run also records an apparent earlier enclosure overlap, so route confinement remains unproven.

Flamingos now idle at fixed positions around the pond rim, and their dive warning uses the red directional ground lane. This is only a partial implementation: visible lit landing markers and a complete fight/telegraph verification remain outstanding. No arena captures were produced or opened.

## Validation

- `node --import tsx/esm tools/qa/threat-audit.ts --proof`: pass.
- `npm run typecheck`: pass.
- `npm run lint`: pass.
- `git diff --check`: pass.
- `npm run verify -- E08`: could not start; tsx IPC socket creation returned `EPERM` in the sandbox.
- `sh tools/remote/run.sh "$PWD" -- npm test`: unavailable; the runner reported no healthy remote runner and disallowed this command in the local Mac slot. No tests were trimmed or substituted.
- No headless browser run, real-input marker-only run, or screenshots were made.

## Remaining work

1. Resolve actual L8 inaccessible route pockets through level design and produce a full threat audit with zero L8 flags.
2. Complete the one-way route/corner/final boarding and shove checks, then run marker-only real input from start through the sanctuary gate with no travel stall over 10 seconds.
3. Capture and open all six arenas at HIGH zoom 1.
4. Finish the flamingo fixed landing spots and verify its full fight, cover, and telegraph behavior.
5. Run the required remote unit suite and E08 verification, write the exact accepted audit line, and commit the work.

## Environment limitation

An explicit `git add`/commit attempt was denied because the worktree's shared `.git/worktrees/s75-l8part2/index.lock` is outside the writable sandbox. Changes remain uncommitted in this worktree.

## Continuation validation (permissions restored)

The environment restrictions were lifted. The census change is committed as `4f6f7988`.

- Threat proof, typecheck, lint: pass again.
- E08 per-change verification: pass; 27 files, 107 tests, 98.8 s test budget.
- Required unchanged remote `npm test`: pass on 46.225.66.90; 27 files, 106 passed and one platform skip, 219.2 s within the 240 s budget. The collection guard reported 150/150 cases.

These results supersede the environment limitations above. The route, zero-flag audit, real-input run, captures and full flamingo work remain incomplete.

## Route proof correction

The independent route-state check now passes all six states (`route-gates.json`). It had incorrectly marked the elephant cleared (`findIndex === -1`) and allowed only 90 s for the full visitor route. The corrected setup keeps the elephant unbeaten, allows up to 300 s only for the five-cleared traversal, and stops on yard entry. States zero through four do not enter the yard; the five-cleared state reaches x=93.79, z=46.06 through the gorilla route. Typecheck, lint and diff checks pass. This supersedes the failed controlled-run result above; it does not prove corners, shoves, real-input travel timing or the full mortal run.

## Opening remote cohorts

The initial alarm incorrectly admitted west/east cohorts because they were connected before the plaza sealed, despite the existing intent to admit them only on crossing their region. Those two opening cohorts are now deferred to their native later region triggers. The targeted rerun clears the passive escape reachability flag (no sustained blocked evidence). It still prints `L8: skilled complete, passive tick-budget, 1 passive flags (88.3s)`: the remaining passive flag is now `KITING_LANDED_HITS_BELOW_2:0.00`. Skilled escape reachability and first-wave attack timing also remain flagged. Typecheck, lint and diff checks pass. This is further progress, not the required zero-flag full audit.

## Flamingo landing foundation

The flock now walks back toward stable slots on an 11 m pond rim, shared with 26 visible lit ring pads. Slots do not redistribute when another bird dies, so deaths no longer move every surviving bird's destination. Dive telegraphs use the red directional lane. Typecheck, lint and diff checks pass. This change has no opened capture yet and is not accepted as a visual fix; flight return behavior, fight pacing and visual QA remain open.

## Flamingo return leg

Authored dives now transition from their damaging outbound lane into a non-damaging return to the bird's assigned pad, then grounded recovery. Return travel retains the active flight presentation and uses collision-aware movement; a bounded timeout prevents a displaced or obstructed pad from locking the attack forever. Typecheck/lint pass, and the existing mission interaction regression passes (one selected case, five skipped; 68.19 s). A direct fight and opened capture are still required to accept this behavior visually.

## First headless input sample

Ran one pooled headless WebGL2/Metal browser on unique port 4975, HIGH requested and zoom 1, from `level:L8:sanctuary`, with marker-following keyboard input, E held, no firing and god off, for 45 s. The driver ended normally at tick 2641, player (60, 7.5), HP 100, checkpoint sanctuary; browser error list empty. Raw log and five frames are in ignored `test-results/s75-l8part2/start/`.

Opened `s004-t2486.jpg`: the courier is visible among the group at a fenced path junction, the yellow route ring/arrow is readable, HUD says “Follow Nadia · 1 m”, the minimap has party dots and a direction arrow, and a warm gate lamp lights the lower-right pavement. This is a startup/input/capture sample only. It did not reach the pond or sanctuary hand-in and does not prove the no-stall requirement or any arena visual fix. Browser and temporary server stopped after the sample.

## Extended start input sample

Completed a 240 s headless marker-input run on port 4975 at HIGH/zoom 1, same driver and controls as the short sample. The courier travelled from (0,70) to the plaza near (0,0); the objective changed to “Rest at the plaza with the group”. The run ended normally with no browser errors and no frames over 250 ms in its measured interval. Raw evidence: ignored `test-results/s75-l8part2/full-start/`.

Opened `s006-t7301.jpg`: courier and Nadia are visible on the fenced path, the party trails behind, the yellow ring is readable and a warm lamp lights the junction. This sample does not establish the launcher hand-in: its trace contains no explicit sanctuary gate/launcher prompt. It also does not yet establish the maximum travel stall. The start loadout/setup needs inspection before claiming that requirement. Browser and server are terminal.

## Start-travel trace analysis

`start-travel.json` analyzes 43 real-input position samples from tick 66 to 7825, before the first rest-at-plaza objective at tick 7940. The maximum observed interval until at least 1 m displacement is 6.117 s; no sampled interval exceeds 10 s. This supports the tour travel requirement at roughly three-second sampling resolution, but cannot establish sub-sample motion or classify story dwell separately.

The earlier missing-prompt concern was mistaken: `L8Gate.surrenderHeavyWeapons()` runs automatically in `LevelEightZoo.begin()`, before the sanctuary checkpoint. No E prompt is authored for that handover. Browser evidence that a launcher was carried into this particular run remains unverified; the existing mission/save unit coverage checks removal separately. This clarification supersedes the report's suggestion that an explicit handover prompt should appear.

## Opened flamingo fight sample

Ran the committed `l8-before-flamingo` fixture for 60 s with real keyboard/mouse input, marker-following and normal MG firing, god off, one pooled headless WebGL2/Metal browser, HIGH requested and zoom 1, unique port 4975. First kill objective tick 302; first lion-entry objective tick 1832: 25.5 s from the sampled start of flamingo combat to clear. The run reached `arena-lion` at tick 3582 with 89 HP and no browser errors. This is fixture fight coverage, not full-start completion.

Opened `test-results/s75-l8part2/flamingo/s001-t563.jpg` and `s003-t1534.jpg`. The 26 lit gold pads are visible around the pond rim; live pink birds occupy separated rim positions. HUD shows 7/14 (7 left), then 21/26 (5 left). Corpses are distributed flat across the pond floor, with no tall column in these two views. The party forms a dense group by the lower entry. The arena boundary and minimap box are readable. No red lane is captured clearly in these stills, and continuous return-flight motion remains unverified. The browser and temporary server are stopped.

## Remaining arena capture batch

Sequential single-browser headless WebGL2/Metal samples, HIGH requested/zoom 1, 12 s each, normal input and firing, god off, existing pre-arena fixtures. Opened these raw ignored files:

- `lion/s002-t673.jpg`: two lions and their HP bars visible inside a lit rectangular boundary; a dark rock at the far rim and warm entry lamp; objective and minimap arena box readable.
- `monkey/s002-t678.jpg`: rooftop monkeys, building/doorway cover, scattered bins and trees; courier visible in the centre and party gathered at the left entry. Objective 3/7 and minimap box readable.
- `zebra/s002-t693.jpg`: herd with broad gold dust lanes across the floor; courier and allied group visible between lane strips; objective 1/4 and minimap enemy dots readable.
- `gorilla/s002-t693.jpg`: gorilla near the party, four standing cover pillars and benches visible; objective 0/1 and arena box readable.
- `elephant/s002-t467.jpg`: entry view only, with a large truck occupying much of the foreground and courier shown through its roof; objective still “Enter the elephant yard · 1 m”. This does not count as the active elephant arena capture. An engaged-yard sample is still required.

Raw paths are under `test-results/s75-l8part2/`. Browser batch and temporary server exited. These stills do not prove continuous camera/lighting transitions, complete fights or telegraph timing.

## Opened active elephant yard

Single pooled headless WebGL2/Metal sample from `l8-elephant-apc-yard-engaged`, 12 s real input/firing, god off, HIGH requested/zoom 1, port 4975. Opened `elephant-engaged/s000-t67.jpg`: active elephant/HP bar, truck, bounded yard, lit perimeter, party and APC armor meter visible; objective “Kill elephant 0/1 · 5 m” and minimap box readable. This supplies the sixth opened active arena view (alongside flamingo and the four prior arena samples).

Also opened `s002-t669.jpg`: the objective has advanced to boarding, courier HP 30, and the camera is much closer; the elephant body is partly cropped at the lower right. This is an unresolved boarding camera-state concern, not an arena framing pass. Raw images/log remain ignored under `test-results/s75-l8part2/`. Browser and server stopped.

Audit inspection confirms the current remaining passive flag is the separate retreat-kiting probe: 20 s moving, 39.45 m travelled, 101 player attack starts, one infected attack start, zero landed hits. The passive escape census no longer supplies the flag. No threshold or other-level rule was changed.

## Zero passive flags in targeted L8 audit

The southern opening cohort now completes its scripted public-route approach through (24,20), (24,0) into the plaza before releasing normal pursuit. Previously it released on the far apron, where the seal could isolate it. Ordinary archetype stats, damage and thresholds are unchanged.

Exact targeted rerun line:

> L8: skilled complete, passive tick-budget, 0 passive flags (101.7s)

The command still exits nonzero for partial-level selection and baseline-main-source provenance; this is not the requested full-audit receipt. Threat proof, typecheck, lint and diff checks pass after the change. The full audit and final remote unit rerun remain required.


## Full audit and final remote suite

Exact full-audit line:

> L8: skilled complete, passive tick-budget, 0 passive flags (253.4s)

Full audit completed in 287.8 s and exited 1 for eight other-level/provenance flags, preserved in `final-checks.json`; no L8 passive flags remain. This supersedes the targeted-only audit limitation above. The unchanged required remote `npm test` passed on 46.225.66.90: 27 files, 106 passed/one platform skip, 150/150 registered-case collection guard, 206.2 s within the 240 s budget. Both processes are terminal.

## Actual-gate shove coverage

Added `tools/qa/l8-gate-shoves.ts`: loads real L8, arms its pens and seals the plaza, admits the courier on both sides of each actual entry/exit/plaza/connector/yard gate, and applies immediate six-metre knockback toward the barrier. All 42 cases remain on their starting side; exact before/after positions are in `gate-shoves.json`. Typecheck/lint/diff checks pass. This is controlled centre-of-gate shove coverage, not corner traversal, gate-closing timing, crowd squeeze or mortal input completion. Earlier generic collision-suite coverage remains additional evidence.

## Gate-end and diagonal extension

The actual-L8 shove diagnostic now passes 378 cases: both sides, centre and 0.8 m inset from each gate end, straight and ±0.35 tangential shove components. Adjacent gate/fence joins hold against these immediate six-metre attempts. The compact committed receipt preserves coverage and the SHA-256 of the full ignored raw receipt. Fifteen assertions over the five route transitions additionally confirm that a completed exit stays open while the next party enters, then closes when that next fight arms. This proves the gate predicate, not live follower closure timing. Typecheck/lint/diff checks pass. General junction/path-boundary traversal and boarding-area movement remain separate open coverage.

## Return-flight presentation correction

Inspection found that the new return leg reused the outbound `travel` arc, so flying back toward the origin could replay a dive-like pose. `AnimalMoves` now uses distance to the assigned pad for the return descent and excludes that leg from the outbound diving pitch. The red arena dive lane uses the authored area direction and destination length. Typecheck/lint/diff checks pass. This remains unaccepted visually until a new continuous/capture sample is opened; the earlier fight clear predates this presentation correction.

## Boarding-yard camera correction

`GameView` retains wide framing over the yard/APC approach while all pens are cleared and the courier remains on foot in the yard, until departure. Previously the final kill immediately dropped encounter scale to 1 and cropped the foreground body/truck. Typecheck/lint/diff checks pass.

A normal 15 s engaged-elephant sample did not clear. A separate explicit camera-only control marked all arena phases cleared (logged setup; no combat claim), then captured HIGH/zoom 1 in one pooled headless WebGL2/Metal browser. Opened `boarding-camera-control/s001-t270.jpg`: boarding objective, party, truck, APC at lower left and the whole fenced yard/approach are visible together. The control retains a living elephant because it changes controller phases only. This verifies cleared-state framing, not the uninterrupted fight-to-boarding transition. Raw samples are ignored under `test-results/s75-l8part2/`; browser and server stopped.

## Static route diagnostic correction

Updated `r33-l8route-flood.py` to include actual runtime path walls and seal-only connector gates, previously absent from this map-only model. Re-run `route-flood.json` preserves arena ordering and no premature yard access; no sampled map boundary is reachable in any sealed route state. However, reachable area still grows to 19,635 m² after lion clear and 28,877 m² after zebra clear. Therefore its PASS must not be interpreted as proof of the strict 3–5 m visitor-path requirement. Local junction/off-path containment remains unresolved and needs geometry/runtime investigation. The model uses layout AABBs and a 0.4 m dilation, not real-input traversal.

## West route opening investigation

Validated the flood seed at every state: plaza (0,0) is walkable, and reachable masks contain no blocked cells. Opened a generated collider/reachability map for two cleared pens. A shortest grid route from the plaza to (-96,0) follows the authored pond/lion corridor, then travels near (-62.25,-6.75), (-62.25,3.25), (-71.75,3.75), (-81.75,3.75), (-91.75,3.75). This locates a west-junction route into the broad exterior region. A temporary extension of branch-barrier half-length from 3.2 to 4.5 m did not eliminate that region and was reverted. No geometry fix is claimed. A runtime reproduction and actual fence-boundary inspection are required before changing the layout.

## Runtime west-junction reproduction and local closure

Added `l8-junction-probe.ts`, which admits the courier at (-60,0) with two cleared pens, then sends ordinary keyboard InputFrames toward (-96,0), god on. Baseline reached x=-95.53 in about nine seconds by walking around the short branch wall. The west/east junction barriers now span to the adjoining fence lines at z=±12 instead of ending at ±3.2. The same 20 s probe no longer takes that direct west opening; it instead attempts a longer route toward the southern open region. Static reachable area after lion clear decreases from 19,635 to 14,141 m², so other openings remain. This is a local closure, not complete path confinement. Typecheck/lint/diff checks pass. Visual capture, native route regression and threat-audit rerun after this geometry change remain required; the prior zero-flag receipt predates it.

## Primate approach cap

The southern detour passed the outer primate approach fence at its z=32 end. Added a drawn/sim barrier across that end, joining x=-28.5 to the pen wall at x=-19.5 while keeping the marker route into the entry below it. Static reachable area after lion clear decreases from 14,141 to 5,161 m². The controlled 20 s west-exterior probe no longer reaches the exterior, though this bounded sample alone is not proof of total containment.

All six native controlled route states pass after both junction barrier changes. The targeted audit reports `L8: skilled complete, passive tick-budget, 0 passive flags (149.6s)`; nonzero exit remains partial-selection/provenance only. Typecheck/lint/diff checks pass. Visual opening of this fence addition and broader post-monkey/post-zebra containment remain open. Raw route and audit receipts are in ignored `test-results/s75-l8part2/` and `test-results/qa-threat-s75-cap/`.

## Southern zebra-approach junction arms

The post-monkey flood route escaped south near (60,68), then traversed the field toward (-48,60). Added two seal-only connector gates across the unused southbound arms at (24,67.1) and (60,67.1), leaving the authored eastward turn and zebra entry route. Static post-monkey reachable area falls from 14,826 to 6,383 m²; arena-order checks still pass.

The configurable runtime junction probe starts at (24,64), three pens cleared, target (-48,60). Native navigation reports the target disconnected, and the 20 s keyboard-input sample does not reach it. Typecheck/lint pass. Full native-route regression, opened gate capture, current full audit and remaining post-zebra opening are still required; this is not total path-confinement acceptance.

## Gorilla-approach west branch

Traced the post-zebra exterior path from (60,0) west toward (28,0), around the gorilla perimeter and into the eastern field. Added the missing west-side branch barrier at x=56.9, z=0 spanning the adjoining fence endpoints at z=±12; the existing east-side barrier bounds the other side of the north/south visitor corridor. Native nav reports target (108,0) disconnected from (60,0) with four pens cleared. Static post-zebra reachable area falls from 14,930 to 7,220 m². All six controlled route states still pass, including yard access after five clears. Typecheck/lint/diff checks pass. The post-gorilla service lane still opens a large region and remains under investigation; new fence captures and the final audit refresh remain required.

## Service-lane detour evidence

With five pens cleared, a controlled runtime probe from (96,-32) toward exterior target (108,-60) reports a connected native path. In the 20 s sample it walks south toward z=30, then turns outward near x=100.6/z=28.6, reaching x=107.35/z=7.30. Trial northern/eastern junction caps and continuous side-wall extensions did not eliminate the connection in the map model and were reverted. No service-lane geometry change was retained. The remaining investigation must include the open yard-side approaches after the five-clear unlock, rather than assuming the leak begins at the gorilla exit turn.

## Service-lane east fence join

The full modeled route crosses the lane east side near (100.25,29.25). Extended a single drawn/sim side fence at x=99.1 from z=-35 to z=46, joining the actual yard boundary instead of stopping before it. With five pens cleared, native navigation now reports (108,-60) disconnected from (96,-32); the controlled runtime probe stays inside the lane. All six route-state checks pass, including final yard entry at approximately (93.79,46.06). Typecheck/lint/diff checks pass. This supersedes the earlier trial-wall result: those walls stopped at z=39 and did not join the yard boundary. Opened visual evidence and current final audit remain required.

## Current approach captures

Sequential single-browser six-second samples from current monkey/gorilla/elephant fixtures, HIGH requested/zoom 1, headless WebGL2/Metal, marker input, no fire and god off. Opened `final-fence-monkey/s000-t67.jpg`, `final-fence-gorilla/s000-t70.jpg`, `final-fence-elephant/s000-t64.jpg` under ignored `test-results/s75-l8part2/`.

The primate approach has the courier on paved ground between fences, with a foreground building partly obscuring the entry marker. Gorilla approach clearly shows both fence sides, open entry ahead, courier and trailing group. Elephant approach shows both sides of the paved lane, a prominent warm lamp/foreground fence, and readable entry marker. These views do not expose every newly closed junction end; they must not be used to claim that all added joins were visually inspected. Positioned camera coverage of the off-screen joins remains open. All browser samples and the temporary server are terminal.

## Opened positioned fence joins

[Small contact sheet](fence-joins.jpg) was assembled from four source frames, and every source plus the sheet was opened. One pooled headless WebGL2/Metal browser at a time, HIGH requested/zoom 1, unique port 4975; explicitly logged camera controls set arena phases/seal and admit the courier near each join, god on, no firing. These are geometry presentation controls, not natural progression evidence.

Top left: extended west-junction bars close the unused arm. Top right: primate cap joins the outer approach to the pen fence. Bottom left: closed southbound zebra-approach arm bounds the turn. Bottom right: service-lane side fence runs beside the paved lane, with a warm lamp and courtyard wall in view. Courier remains visible in all four. “Follow Nadia” is stale mission text in these controls; no objective or handover claim relies on it. Raw frames/logs are under ignored `test-results/s75-l8part2/join-*/`. The browser batch and server exited.

## Opened red lanes and return phases

Thirty-second current-code pond sample, HIGH requested/zoom 1, single pooled headless WebGL2/Metal browser, real marker input, no fire/no kite and explicitly god on so attacks can finish. Opened `flamingo-motion/s009-t671.jpg`, `s019-t1327-b4.jpg`, `s022-t1467.jpg`, plus [small contact sheet](flamingo-lanes.jpg). Three red outlined lanes converge near the courier; substantial far-side floor remains outside the fan. Later frames show birds airborne between centre and rim, then near the right-side pads. This confirms red warning visibility and samples return phases, not smooth continuous gait or complete landing quality. HUD stays 0/8 in this protected no-fire control; it supplies no combat-difficulty or mortal-clear claim. The previous 25.5 s clear is separate evidence. Browser and server are terminal.

## Nightly content validation

Ran `node node_modules/vitest/vitest.mjs run tests/nightly/content-invariants.test.ts --project nightly --configLoader runner --maxWorkers=4` on current source. Terminal result: four passed, one failed, 146.09 s. LOD fidelity, decoration surfaces, support seams and placement-vs-solids pass. Asset inventory fails on 14 errors for `int.supermarket`/`bld.supermarket`: +X-front orientation on LOD0–2, degenerate picket/UI triangles and LOD0 delivery size. This lane has not changed those assets; no baseline was relaxed. Therefore the full nightly gate is not green. This file does not cover runtime gate boxes or waves; those remain separate checks.

Cover inspection confirms three authored lion cover pieces, four gorilla pillars plus throw furniture, monkey building/doorway choke pieces and yard truck/wall bait. A complete deliberate cover pass for every pen remains unproven; the inspected code does not by itself establish three/four usable pieces per arena.

## Pond and paddock cover additions

Added three stable-ID jersey-barrier cover pieces inside each of the flamingo and zebra pens. Pond pieces are inside the landing ring at (-6,-28), (6,-28), (0,-38); zebra pieces are offset at (52,28), (68,28), (60,39), leaving centre/gate access. Existing assets and normal solid/destruction assembly are reused; no animal stats change.

Focused `solidOverlaps` against `levelEightLayouts` finds six pieces and zero overlaps across tiers 0–6. Typecheck/lint/diff checks pass. Inspection also found that the nightly placement test currently applies L2–L5 transforms but not L8's transform, so its earlier green placement result cannot validate runtime L8 additions. This focused result closes that coverage gap only for the six new pieces. Opened cover captures, actual fight/charge behavior and updated audit/unit receipts are required before accepting these additions.

## Cover fixture sample limitation

Ran current-code 25 s pond/zebra samples from committed fixtures, HIGH requested/zoom 1, normal MG input, god off. Opened `cover-flamingo/s003-t980.jpg` and `cover-zebra/s002-t688.jpg`. Neither frame shows the six newly added cover pieces, so these prepared-layout fixture runs do not verify the additions. Zebra advances to `cleared-zebra`/gorilla entry and both browser error lists are empty, but no cover-acceptance claim relies on this sample. A fresh-layout load is required to distinguish stale prepared fixture state from missing runtime integration. Browser and server are terminal.

## Fresh-layout cover presence

Fresh `level:L8:sanctuary` headless HIGH/zoom-1 camera control logs all six new pond/zebra cover IDs in the district layout. Opened `fresh-cover/s000-t66.jpg`: concrete barriers are visibly present on either side of the pond floor, with the landing rings beyond. This establishes fresh runtime rendering, not combat: the explicitly staged phase had no turned flock and immediately cleared, so the view is close and the objective is stale. The fixture samples that omitted the pieces remain invalid for new-cover acceptance; fixture regeneration and fresh-layout fights are still needed. Browser and server are terminal.

## Native fixture regeneration

Ran `make-checkpoint.ts --what qa --qa-parts l8 --seed 1` from current fresh layout. The unchanged complete policy generated all six pre-arena checkpoints and the engaged elephant checkpoint. Refreshed the seven L8 fixture saves; monkey compression changed from Brotli to gzip, so the old duplicate is removed. `check-fixtures.ts` on the generated directory passes all seven: decode without drops, resume, 300 native ticks, alive and playing. This establishes fresh-layout native route/checkpoint generation and basic resume health; browser cover/fight verification must now use these refreshed fixtures. Raw generation manifest remains in ignored `test-results/s75-l8part2/fresh-fixtures/`.

## Refreshed-fixture fight samples

Current 35 s headless real-input runs, HIGH requested/zoom 1, god off, normal MG. Pond advances to lion entry at tick 2119; zebra advances to gorilla entry at tick 605 and later elephant route. Opened `current-cover-flamingo/s001-t392.jpg`, `s002-t703.jpg` and `current-cover-zebra/s002-t675.jpg`. Zebra concrete cover is visible; pond barriers remain absent in the fight views. Native resumed layout still contains three pond placements, but they are not destruction objects, so no destruction-state cause is established. This supersedes the assumption that fixture regeneration alone resolves cover visibility. Pond cover remains unaccepted and needs presentation/prop-state investigation. The opened frame also exposed the old “shadow lane” hint; it now names the red lanes and barriers. Both browser samples and server are terminal.

## Functional cover height

The new jersey pieces initially used asset height (~0.95 m), below the ordinary standing shot ray. Raised their Y scale to 1.4, matching the existing lion-cover scale. A focused production `shotVisible` check across each of the six pieces, using normal entity Y=.7 (the API adds .45 m for the shot), reports blocked for all six. An initial probe incorrectly passed Y=1.1 to that API and therefore tested 1.55 m; that result is not evidence for normal standing shots. Typecheck/lint pass. The pieces are static layout cover, absent from prop/destruction registries; no cause for their missing wide pond rendering has yet been established. Opened current-height cover views remain required.

## Pond cover renderer selection receipt

Corrected a diagnostic watch that initially omitted `return`, then captured read-only `DistrictView.lodState()` during a protected no-fire HIGH/zoom-1 pond sample. `pond-cover-lod.json` preserves only the three pond cover instances and their sampled bands. The instances exist in the renderer; a later sample selects one at LOD2 and marks two culled. This narrows the missing-wide-cover issue to renderer selection/culling, rather than absent layout IDs, but does not yet establish the faulty rule. No culling bypass was added. Browser and server exited.

## Cover visibility flags excluded

Read-only renderer-instance probe (`cover-flags/log.jsonl`) samples all three pond refs at ticks 72/267/450. Each has the expected unchanged position and only `placementId` in userData: no `interiorHidden`, `destructed`, `highOnly`, prop/death flags or tier exclusion. Camera far plane is 600 m on this layout, so the widened arena is not beyond its far plane. These observations narrow the missing-cover path to frustum/bounds selection rather than hidden state. No rendering override was added. Browser/server are terminal; this is diagnostic evidence, not a visual acceptance pass.

## Cover projection comparison

`pond-cover-projection.json` records read-only camera position, projected cover centres and stored frustum distances. At sampled ticks the camera remains near the courier (roughly y=11 m), and cover centres project outside its clip rectangle, consistent with culling. This differs from the visibly widened arena screenshot, but probes run between browser frames and are not synchronized to its draw. Therefore a Scene Lab camera/order mismatch is a hypothesis, not an established cause. Need a draw-synchronized comparison before changing production culling. No renderer change was made; browser/server are terminal.

## Corrected in-arena cover diagnosis

The synchronized diagnostic screenshot `cover-draw/s001-t460.jpg` was opened and shows the courier still outside the entry. Earlier camera probes omitted `--no-kite`, so automatic threat avoidance prevented arena entry. Comparing those receipts with different in-arena screenshots was invalid; no camera/frustum mismatch is established.

Repeated with `--no-kite`, god on/no fire, current fixture. At tick 833 the objective is “Kill flamingos 0/8”, camera is widened (y≈50.26), and all three cover instances are selected at LOD1. Opened `cover-inside/s003-t833.jpg`: the arena is wide and pads/birds are visible, but the concrete covers remain visually absent. `pond-cover-inside.json` preserves the corrected receipt. This moves investigation to selected LOD1 asset/batching presentation, not frustum culling. No workaround was added. Browser/server are terminal.

## Cover LOD geometry inspection

Inspected source GLB nodes/accessor bounds and the static-bake headers for jersey barrier LOD0/1/2. All three baked tiers have nonempty geometry and matching bounds: x ±1.5, y approximately 0–0.95, z ±0.36, identity part transform. Thus an empty/underground LOD1 bake is not established as the cause. The remaining inspection must check the live selected InstancedGroup's resident prototype, instance count/matrices and draw bounds. No asset or renderer bypass was introduced.

## Live cover batch inspection

Current in-arena read-only sample (`--no-kite`, no fire, god on, HIGH/zoom 1) confirms the near batch is loaded and visible, contains three refs, and its static-body child is visible with count=3. Instance matrices have the expected pond translations and Y scale 1.4; its bounding sphere spans x≈±10/z≈-30 at y≈.665. `pond-cover-batch.json` preserves receipts. Thus empty instance count, missing resident near prototype and misplaced instance matrices are excluded. The geometry uses custom `_placement0..3` vertex attributes; their uploaded values/material/depth behavior remain the next unverified path. Browser/server are terminal. No renderer workaround was introduced.

## Redundant-cull control rejected

A logged browser-only control disabled child mesh frustum culling for jersey batches after district partition, with all normal instance selection intact. Entered the pond using `--no-kite`, protected/no-fire HIGH/zoom 1. Opened `cover-cull-control/s002-t819.jpg`: covers still absent. Therefore disabling a possible second mesh-level cull does not solve the issue and no production culling change is justified by this test. The control is not retained in source. Browser/server are terminal; custom placement-attribute data/material behavior remains unverified.

## Placement-upload control rejected

A browser-only control marked the jersey custom placement interleave dirty after each partition, retaining positions, material, visibility and geometry. Current in-arena protected/no-fire HIGH/zoom-1 sample; opened `cover-upload-control/s002-t829.jpg`. Pond cover remains absent. Forcing a buffer upload alone is not a supported fix, and no upload/version change was retained. Browser/server are terminal; custom position-node/material behavior remains unverified.

## Material/depth control breakthrough

A temporary built-in-instancing control (same geometry/transforms, custom position node removed) did not restore cover; opened `cover-instance-control/s002-t732.jpg`. A second control uses built-in instancing plus a plain magenta MeshBasicNodeMaterial, depth testing off, double-sided, mesh culling off. Opened `cover-basic-control/s002-t813.jpg`: all three pond covers are clearly visible at their expected positions. This establishes drawable geometry/placement and narrows the difference to material/depth handling; the combined control does not distinguish those factors yet. Both controls are browser-only, with protected/no-fire HIGH/zoom-1 input, and were not retained in production. Browser/server are terminal.

## Normal-depth material comparison

Repeated the plain magenta material/built-in-instancing control with normal depth testing enabled. Opened `cover-depth-control/s002-t817.jpg`: all three pond covers remain visible. This excludes floor depth occlusion in that control and focuses investigation on the production material graph (including its discard/cutaway behavior). The previous built-in-instancing-only control retained that production graph and did not show covers. No basic material override is retained. Browser/server are terminal.

## Cutaway control rejected

Protected in-arena control cloned the production jersey PaletteMaterial and disabled its see-through wrapper while preserving the custom position node, normal shading and depth. Opened `cover-cutaway-control/s002-t812.jpg`: covers remain visually absent. No cutaway change was retained. The remaining production graph includes night surface lighting/palette output, so illumination/readability must also be inspected rather than assuming discarded geometry. Browser/server are terminal.

## Pond lighting readability improvement

Added three street lamps around the pond rim to fill the previously dark west/north/east sectors. Opened `pond-lighting/s002-t831.jpg`, protected no-fire HIGH/zoom-1 in-arena sample: warm floor pools now reveal the dark concrete cover silhouettes and landing-pad ring. This establishes illumination/readability as a contributor to the earlier apparent absence; no GPU/culling workaround was needed. The faces remain dark, so this is not a stunning-score acceptance claim.

After inspecting the frame, moved the west lamp from the exact landing-pad coordinate (-11,-32) to (-12.5,-32), outside the 11 m landing ring. Focused transformed-layout overlap checks across tiers 0–6 find no new-lamp overlaps; typecheck/lint/diff checks pass. The opened frame precedes that 1.5 m lamp adjustment, so a final-position capture remains required. Browser/server are terminal.

## Calm-tour regression and seal-controlled junction fix

The latest full audit before this fix printed `[qa:threat] L8: skilled complete, passive tick-budget, 2 passive flags (295.7s)`. Passive flags were `KITING_LANDED_HITS_BELOW_2:0.00` and `UNOBSERVED_PASSIVE_CRITERION_STEP:escape`. The required unchanged remote suite then failed the mission interaction test because Nadia never reached the lion (distance approximately 86 m). The authored calm tour crosses x=56.9 at z=0; the new permanent wall blocked that crossing. Moved that same wall to `l8ConnectorGates`, preserving post-seal confinement while allowing the calm tour. No actor stats, thresholds or test expectations changed.

Focused mission interaction test passes (1 passed, 5 unselected); typecheck and lint pass. Targeted L8 audit prints `[qa:threat] L8: skilled complete, passive tick-budget, 0 passive flags (99.2s)`. Full audit and required remote suite are being refreshed before final reporting.

## Final validation and handoff

Current full audit exact line:

`[qa:threat] L8: skilled complete, passive tick-budget, 0 passive flags (229.8s)`

Command: `node --import tsx/esm tools/qa/threat-audit.ts --out test-results/qa-threat-s75-final-seal --report test-results/s75-l8part2/threat-final-seal.md`. Terminal exit 1: 8 overall fail flags outside L8 (including audit provenance); this is not an all-level green claim. The L8 receipt is preserved in `final-seal-checks.json`.

Required unchanged `sh tools/remote/run.sh "$PWD" -- npm test` passes on 94.130.181.173: 27 files, 106 tests passed, 1 skipped; 150-case collection passed; 225.6 seconds against the 240-second guard. Focused mission interaction test passes; typecheck, lint and diff checks pass. No checks remain running.

Open at timebox: rerun marker-only real input from start through sanctuary against final fences; refresh six arena and final lamp-position captures and open them; refresh fixture geometry as appropriate; comprehensive current-state shove/corner/junction/boarding and live one-way closure coverage; uninterrupted flamingo walking/takeoff/landing/return quality acceptance and remaining deliberate cover/lighting/minimap/camera polish. The nightly asset-inventory failure recorded above remains unresolved; no baselines or thresholds were relaxed. Overall goal is not complete. No push, deployment or main movement occurred.

## Current geometry: calm-tour real input and gate shoves

Refreshed actual closed-gate shove check passes **432 cases**, covering both sides, centre/near-end admissions and straight/diagonal six-metre knockback; five one-way state transitions retain their predicate assertions. This does not prove every fence corner or live closure timing.

Ran 240 seconds from `level:L8:sanctuary` (actual opening position 0,70), marker-only keyboard following, hold E, no god, no fire, no relocation; HIGH/zoom 1, one headless pooled WebGL2/Metal browser on port 4975. The trace includes the launcher handover subtitle, completes Nadia’s tour and reaches the plaza rest objective at tick 8105, then the breach. Across 44 position samples before rest, maximum sampled interval until one metre of movement is **6.05 s**, below 10 s. This sampling cannot rule out sub-sample pauses or prove the subsequent six-arena escape. Browser ends normally with zero errors and no frame over 250 ms after warmup.

Opened `final-tour/s002-t7275.jpg`: courier and Nadia stand on the paved return junction, the party/corgi follows inside visible fences, the yellow ring/arrow is on the path, HUD says Follow Nadia 1 m. The image is readable but the pavement remains dark; no 8/10 visual score is claimed. Browser and dev server stopped. Receipt: `current-tour-checks.json`. This supersedes the stale-current-tour limitation above only for the calm-tour portion; final arena/escape input, visual polish and live closure acceptance remain open.
