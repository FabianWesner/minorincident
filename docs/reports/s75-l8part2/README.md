# s75 L8 redesign part 2

## Status

Incomplete. The closed pen census exclusion and its proof are implemented, but the required zero-flag audit, route confinement proof, real-input run, six opened arena captures, and full flamingo redesign have not passed. No claim of acceptance is made.

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
