# s75 L8 redesign part 2

## Status

Incomplete overall. The full threat audit now reports zero L8 passive flags, the six controlled route states pass, six arena views have been opened, and the real-input tour trace has no sampled travel gap over 10 s. Remaining acceptance work includes corner/shove confinement coverage, continuous flamingo return-flight/red-lane verification, the cover/telegraph pass and the boarding camera concern. The entries below retain earlier findings and explicitly supersede them as checks complete.

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
