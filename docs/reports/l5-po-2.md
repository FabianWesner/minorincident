# L5 second PO round

The work covers PO #21b, #25, #26, #28 and the binding #29 difficulty freeze.

- **#21b:** the nearest remaining hiding place has a persistent radar pin, a named location and a live distance. Sam's cue names Lakeshore Avenue; a blinking cool light marks the reachable bus door. Discovery stays on the existing reachable ring. PO #21b explicitly supersedes the older E23 wording forbidding survivor objective guidance; specs were left untouched.
- **#25:** shared perception hears/smells huntable humans through cover at 6 m, increasing to 9 m for the running courier and 12 m briefly after gunfire. A close unseen Alpha turns during a 0.6 s roar tell before chasing. Counts, placement, HP, speed and damage tables are untouched. Existing close-hearing tests and bot audits now check this approved rule, keeping sight obstruction checks for sight alerts.
- **#26:** living rescued followers share the pooled world bar renderer and have named portrait cards with current/max HP. Medicine within 8 m is reserved for the eligible follower with the lowest health fraction below 70%; unsafe medicine is ignored, dead/turned claimants lose eligibility, and player collection remains available. Reservations are saved with the pickup.
- **#28:** live rescued followers have green radar dots with current positions and edge clamping; death/turning removes the dot and health card.
- **#29:** a seed-1 test pins both bot outcomes/deaths and hashes all infected definitions plus L5 population/placement tuning. Original-source and final runs are recorded below.

## Evidence and review

`tests/e2e/levels/l5-po-2.spec.ts` reconstructs the actual survivor-3 checkpoint, restores it, starts at the PO's wrong-bus position (-9.96, 4.55), then uses physical ground clicks and E to reveal Sam and Mia. No bot or logical movement injection is used after that setup. Courier invulnerability isolates reachability; infected remain active and prior followers can be lost during the unprotected walk. This is not an all-five-alive combat playthrough.

Reviewed game-camera captures in `test-results/l5-po-2/`:

- `wrong-bus-guidance.png`: the tracker explicitly says Lakeshore Avenue and 52 m; a warm radar pin points southwest. The location is distinguishable from the nearby plaza wreck.
- `sam-rescued.png`: the courier and revealed Sam stand on the accessible bus side, with the next search pointing to the Harbor Street stairwell. A cool pool marks the bus area; solid geometry still occludes bars under the existing shared rule.
- `mia-rescued.png`: Mia is visible outside the stairwell; 5/5 found changes the tracker to the metro objective. The named HUD card remains readable.

The nine browser cases pass: Sam/Mia input plus WebGL/WebGPU × high/low × zoom 1.0/0.5 health and radar checks. Reviewed the two full-size views and the six-view `health-radar-review.jpg`: 60%/30% world bars retain a fixed readable size at both zooms; named cards show 36/60 and 18/60; two small green dots remain distinct from the player arrow. Automated checks confirm live dot movement, edge clamping and removal on death. No console/network errors were reported.

The three failures in the older L5 suites reproduce exactly with the original four simulation source files: the survivor-2 setup finds 3 instead of 2 (line 30), the idle bot records 1 death instead of 0, and the follower speed probe reads 4.152466228642065 rather than <=3.9 m/s. Those assertions are unchanged. Original/final comparison logs will be kept with the evidence. Those failures are independent of these changes. No thresholds were loosened.

## Difficulty freeze

The original four simulation files and final sources both finish seed 1 complete/newbie with zero courier deaths. The complete policy shelters **4 originally and 5 finally** (Sam originally turned); newbie shelters 5 in both. The regression pins completion/deaths and the infected tuning hash, and prints fates so the rescue improvement stays visible. Infected tuning hash: `ead63ee4655dc2641428681d1ee3572631793ddb5e1f7fd86231bf9e948f1aa3`.

## Validation detail

- Final `npm run typecheck` and `npm run lint` pass; production build passes.
- Remote focused functional suite: 141 passed. Additional real-world-update medkit and Alpha cases: 2 passed. Dog cover fixture now tests beyond the approved 6 m hearing radius, retaining its attack obstruction and lethal damage assertions.
- Full remote unit run: 1,498 passed, 3 failed, 7 skipped. Failures: production asset validation exceeded its 300 s timeout; the L4 sandbag/fence placement overlap; an occluder mock lacks `cutPlacements`. Those asset/layout/render functions were not changed by this lane.
- The earlier broad unit+sim run passed 2,566 tests and failed 42. Fourteen police mock failures were fixed by keeping Perception construction pure. Hearing-dependent noise/animal/dog and bloated blast fixtures were adjusted to the approved rule and rerun. Shared runner timing failures and the three original L5 failures remain explicitly visible in the logs.
- Native high L5 budget passed: p95 11.3 ms, max 17.3 ms, 325 following-view draws / 730,660 triangles. A later overlapping-validation low phone sample failed at 54.4 ms p95; its log is retained, and the clean retry is recorded below.

Logs live under `test-results/l5-po-2/logs/`; Scene Lab indexes and contact sheets are next to them. Generated evidence is local and not a deployment.

### Scene Lab review

Catalog scenes are `po-l5-sam-guidance`, `po-l5-alpha-proximity`, and `po-l5-survivor-health`. WebGL finishes **16/18**. WebGPU initially finishes **15/18**, including one asset-404 failure while the preview build was being replaced; that case is retried after the completed build. Both backends retain the two Alpha frame-0 failures at zoom 0.5: the canvas initially shows the background and HUD, then the street and actors appear after one simulation tick. No gate was removed or relaxed.

Reviewed the WebGPU Alpha and medicine contact sheets: the Alpha turns and presents a yellow tell arc across the sidewalk; Dale walks out of the group toward the Harbor Street medicine while Rosa retains 36 HP and Dale starts at 18 HP. The health scene is partly occluded by a foreground building with the normal camera; the separate eight browser captures provide unobstructed bar checks. The native high following capture shows the outlined bars over the group amid the authored ash/haze. Capture review is not a claim that the failed initial frame is acceptable.

The isolated remote E18 battery passes **58/58** (all selected performance suites, director, chunk residency and L1 perception). The 200-infected + 40-human perception case records 1.40 ms p95; its E18 reference records 2.08 ms. The earlier shared-runner timing failures are superseded by this isolated pass, not by changed budgets.

`MI_VERIFY_REMOTE_SIM=1 npm run verify -- E23` passes typecheck/lint/build, then stops at the remote simulation stage: **61 passed / 3 failed**, exactly the same three original-source L5 failures listed above. Its later browser stages do not run; the lane-specific nine browser cases and matrix runs were executed separately. The L9 handover, L10 campus corridor and adjusted dog cover regressions also pass **11/11** remotely.

The clean native low phone retry passes the existing L5 budget gate: **p95 34.7 ms, max 59.6 ms**, 238 following-view draws / 312,198 triangles (Pixel 7 emulation, CPU ×4, DPR 1.5, five followers). No concurrent local typecheck/lint/build ran during that measurement. High and low native budgets and the isolated E18 battery are green; the failed overlapping attempt remains archived.

The WebGPU wide Alpha retry passes **1/1** after the completed build, with no console/network errors. The effective matrix result is therefore **16/18 on each backend**; the four retained failures are only the Alpha initial frame at zoom 0.5 (high and low). Reviewed its new contact sheet: the correct wreck/street geometry and actors are present, and the yellow Alpha tell appears before approach. Final low portrait capture also shows the group and outlined bars amid the ash/haze.

## Handoff

All requested implementation changes are committed by bug, with follow-up fixture and regression commits. Worktree generated epic evidence was restored; lane evidence remains under `test-results/l5-po-2/`. No deployment or merge was performed. Release QA remains blocked by the documented legacy suite failures and Alpha Scene Lab initial-frame failures; this report does not mark those gates green.
