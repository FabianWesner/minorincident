# sweep-a3 — trigger rings and current L1–L3 acceptance

**Partial; wrapping up at the orchestrator's request for a quiet gate/perf/deploy window. The full goal is not complete.** The ring fix is implemented and visually qualified. Sixteen rows gained current-source PASS reviews; three further rows have fresh measured FAIL reviews. Eleven rows remain NOT CHECKED. No acceptance targets, counts, timers, caps or criteria were reduced.

Game source is frozen at `10e01ad8c1073f575580ef08ad216e6b736557dc`; source SHA-256 `85db2688bab69ba8b444eff36475ecb78def83fa58c32dee8c04409b9fb6561c`. Subsequent commits contain QA tools, evidence and reports. The original sandbox listen restriction was resolved; the earlier report's browser-blocked account is superseded.

## Trigger ring

`d991499` first matched the ring to the anchor radius; visual inspection found that scaling also thickened the tube. `10e01ad` rebuilds the torus only when radius changes, preserves its 0.05 m tube radius, disposes replaced geometry, and compensates for the L3 marker group's camera scale. The **outer world-space radius** equals the real anchor trigger radius. Simulation interaction ranges are unchanged.

All16 final-source images were personally inspected: L1 depot and L4 cellar, WebGL2/WebGPU, low/high, both zoom limits. Actual native interaction progress was active in each pose. The depot ring measures2.0 m; cellar1.4 m. Courier distance is inside the ring, and the thin line stays readable on paving at close/wide zoom. See [scoped ring review](objective-ring-review.json) and the compressed ring ledgers. This qualifies the requested P3 ring fix, not the whole global marker/route criterion.

## Rows reviewed on final source

Each row has its own review/evidence commit. Current review files are under `docs/qa/reviews/`; retained manifests include image SHA-256 and concrete observations, and compressed ledgers preserve inputs/state. Files referenced below are in this report directory.

| Rows | Result and evidence |
| --- | --- |
| L1-02 | PASS: all first3600 ticks;51/58 humans, no combat/infected; maximum unfaced stationary duration133 ticks =2.2167 s. `L1-02-current-review.json`. |
| L1-03 | PASS:22 inspected images, same clerk148/155; actual parcel transfer, wave, return through shop door, then closure. Both94-tick transfer windows have zero simulation-hidden ticks. Seven negative controls. `L1-03-story-proof.json`. |
| L1-04 | PASS:34 inspected images, same technician147/154; takes/signs/carries box inside, actual Delivered latch, door closed. Both364-tick transfer windows have zero simulation-hidden ticks. Six controls. Quality compared with the archived labelled PROD panels; historical PROD revision cannot be rebuilt from this squashed repository. P: technician hand/clipboard poses and door walk-back quality. `L1-04-PROD-reference.json`. |
| L1-14 | PASS: native physical bat stimulus then90 s empty input. Ten attracted residents per tier; maximum3 courier-targeting chase/bite actors. Actual settled waiters remain16.8994/17.0868 m away,10/8 distinct identities. `L1-14-measurements.json`. |
| L2-01, L2-02 | PASS:12 opening images across both backends/tiers/zoom limits. Two civilian pairs seated; calm alarm23.15 s, no early infected/combat. Axe ring visible near sign/bollards; ordinary no-axe route completes. `L2-opening-images.json`, per-row clauses. |
| L2-03 | PASS:40 inspected ride/arrival images, visible open-cab crew/courier. Native ride24.3167 s, seven seated identities throughout, all out0.8167 s after arrival, control in one tick. Arrival zoom is actually locked0.5; requested wide zoom is not claimed. `L2-03-clauses.json`. |
| L2-05 | PASS:36 current forcing-window images show civilians pressing/pleading/cowering behind actual glazing. All20/30 remain exposed inside for240 forcing ticks; first whole-body exit on doorsOpen. Inspection zooms are labelled separately from the production camera. `L2-05-measurements.json`. |
| L2-06 | PASS:24 inspected opening/+0.5 s/control images, both backends/tiers/zoom limits. Infected visibly enter lower-left sidewalk by the deadline. Native three doors×eight; directions83.1375°,94.3845°,177.5219°. `L2-06-current-ledger.json.gz`. |
| L2-12 | PASS: actual attacks/min10.3765/15.7424;45/43 visible infected across257.9366/279.9633 m, giving5.23384/4.60775 per30 m. Maximum low gap40.8863 m retained. `L2-12-clauses.json`. |
| L2-13 | PASS:16 inspected controlled-runner images; bench civilians rise/run. All six clear-sight neighbors per tier react within1–5 ticks, below6-tick production poll. Controlled stimulus explicitly labelled. `L2-13-current-ledger.json.gz`. |
| L3-01 | PASS: normal armory pickup4.45 s, sole grant at armory.600 actual handgun attacks per tier;18 images show no courier ammunition/reload widget. Raw HUD texts retain40/35 allied “Reloading!” callout samples; these are NPC speech, not courier reload UI.40 HP specimen takes two20 HP hits. `L3-01-current-ledger.json.gz`, grant/source audit. |
| L3-03 | PASS: all14 current native clauses; reachable minima100/100/100/95%, passive first attack2.95/2.4167 s, all actual combat rates≥4/min. No upper-bound target invented. `L3-03-clauses.json`. |
| L3-05 | PASS:34 inspected tour frames, including both-tier attack1 s/10 s. Camera blends19→28.5 m, factor1.5; east-gate fighting stays in frame. `L3-05-camera-measurements.json`. |
| L3-07 | PASS: visible yard/fallback squad combat plus moving pistol hits at ticks2117/1959. Whole-segment mortal fixture records122/31 officer hits,22/0 HP player damage, zero deaths. P: dense muzzle/impact sparkle in attack10 s frames. `L3-07-current-ledger.json.gz`. |
| L3-15 | PASS: gold courier contour visible inside packed horde. Final84/187 living,82/185 drawn in camera. Actual yard zoom1 despite requested limits. P: contour among overlapping bodies. Shares L3-01 images/ledger. |
| L3-06 | **FAIL:** low calm medians4.3863/4.3863/5.3141 m, maxima4.9189/5.2923/6.14118 m; member33 only19/20 samples within3–6 m. High calm sample set empty. Low seed1 brings3 initial squad members to army, violating literal≤2, despite existing aggregate checker labelling its2/3-seed result PASS. Checker unchanged. `L3-06-clauses.json`. |
| L3-12 | **FAIL:** fresh strict pixel-only Luna trial,42 actions/167.55 active seconds. Starts360 m, nearest312 m, ends320 m;143.5167 s after first reaching312 m revisits bakery/car/ruined-shop block without finding onward route. Fixed l3-zone225,0 and real HUD-distance native clauses pass. Low-tier counterexample, no high-tier readability PASS. `L3-12-pixels-result.json`. |
| L3-16 | **FAIL:** all24 final smoke images inspected. Wide views have multiple rising columns; literal every-frame minimum fails in close street views, including actual moving low-tier x−40/zoom0.5. Warm afternoon light/damage cues remain visible. Static inspection poses are explicitly distinguished from ordinary moving route. `L3-16-current-images.json`. |

## Current acceptance state

Final regeneration: `npm run qa:accept -- --level L<N> --tier both --policy both --skip-browser --reuse` for L1,L2,L3. All native/fixture receipts had already been regenerated after the last game edit; reuse now consumes fresh manual reviews. All three commands exit1 because FAIL/NOT CHECKED rows remain. This is not an acceptance PASS.

| Level | PASS | FAIL | NOT CHECKED |
| --- | ---: | ---: | ---: |
| L1 | 9 | 1 | 7 |
| L2 | 13 | 1 | 2 |
| L3 | 8 | 6 | 2 |
| Total | 30 | 8 | 11 |

Native complete routes finish at both tiers for all three levels; stationary policies hit their tick budgets. Fixture runs record16/28/21 cases per tier for L1/L2/L3 with zero fixture errors. Checkpoint hashes agree where present; L2 high has three checkpoints versus low's four, so a full high escape-checkpoint matrix is not claimed. [Exact row list](final-row-status.json), [command outcomes](final-acceptance-commands.json); generated level JSONs/receipts are in `docs/reports/fix51-verify/` and tracker in `docs/qa/acceptance-status.md`.

Other current measured failures remain: L1-08 low bounded-path reachable88.89% versus90%; L2-11 low escape area21 versus25 m²; L3-02 high stationary wave90 versus100; L3-08 density progression; L3-10 high pressure admissions21 versus25. The three fresh FAIL reviews above add current spacing/readability/smoke evidence.

## Still open and exact next work

| Row | Why still unqualified / next action |
| --- | --- |
| L1-05 | Refresh full Delivered→calm→flicker/blast/ringing/smoke/screams strip and4–6 s/8 s boundaries. Blast≤50 ms clause is not measured in this lane; brief excludes perf work. Do not substitute shutter timing. |
| L1-06 | Observe exactly five actual Annex door exits, technician first, and three headings≥60° apart through full emergence. |
| L1-10 | Fresh first-encounter corgi warning/frustum ledger with the full off-screen encounter denominator; no cherry-picked warnings. |
| L1-11 | Physical bicycle ride/dismount at both qualities; measure7.5 m/s and bike-relative controls, verify same-side parking at fences/walls. |
| L1-12 | Physical alley traversal at both qualities/zoom limits; full obstruction/camera-side fence observation. |
| L1-15 | Physical final bay entry with repeating Get in, living infected until entry, shutter and corgi inside. |
| L1-16 | Fresh pixel-only low trial52 actions/118.6167 active seconds, final/closest5 m from depot, no pickup. Early porch stall51.7167 s, then circles houses/depot rear. No single qualified>60 s lost episode asserted; all three destinations uncompleted. Trial bound is not a FAIL. Continue a qualified longer run, including Annex and garage. `L1-16-pixels-result.json`. |
| L2-14 | Real side-path and alarm trials; authored13 cluster,12–16 admitted, each passable with≤50% killed. |
| L2-15 | Current checkpoint presentation: three light-bar vehicles, four visibly firing officers, eight civilians, actual crossing/closure strip and zero infected crossings after closure. Current tour/native checks alone do not qualify every visual clause. |
| L3-13 | Focused physical ramp/corridor pass, both qualities and zoom limits, including settled infected trajectories. Fresh generic low tour stops at x165.859; high reaches compound. Do not infer a geometry FAIL solely from a bot stall. |
| L3-14 | Both-tier compound visual census/ring and every-tick first5 s rest +900-tick evacuation proof. Two protected native attempts retain low301/900 stdout but high never crosses; assertions remain intact and no complete ledger was written. Fresh high browser tour reaches compound, low does not. `L3-14-unqualified-attempts.json`. |

## Protocol, cleanup and gates

Browser work was headless through the shared pool, individual reservations≤595 s, unique ports, never3300; no browser work remains running. Every capture was inspected, with SHA-256 deduplication only for byte-identical repeats. Raw images and contact sheets were deleted;873 owned capture/derivative entries across initial and final runs are accounted for in [capture cleanup](capture-cleanup.json). Archived evidence is JSON/compressed ledgers/manifests, not raw screenshots. The read-only archived PROD reference was not changed/deleted.

Four earlier readability trials are explicitly rejected or insufficient in [rejected-trial audit](readability-rejected.json): one failed to open new images, one had only52.38 active seconds, and two attached-image runs received DOM/aria/data-ammo metadata. Only the final pixel-only runs qualify. Their model input is fresh screenshots plus its own recent decisions/actions; event audits contain no tool calls. Coordinates, DOM HUD and tick measurements remain in the controller's evidence, outside Luna's input. Model inference latency is excluded from active simulation seconds.

- `npx tsc --noEmit`: PASS.
- `npm run lint`: PASS.
- `npm test`: PASS,107 tests/27 files; Vitest maximum4 workers.
- Focused final objective invariant: `npx vitest run --project nightly tests/qa/invariants/contract.test.ts -t '6 objectives' --maxWorkers=4`: FAIL for eight existing L8 escape/depart text/marker violations. No ring-radius violation. This does not replace the passing default unit gate.
- `git diff --check`: PASS before final report commit.
- `npm run qa:threat` ran alone after all browser/native checks: PASS, exit0, zero aggregate fail flags (302.8 s audit /305.7 s wrapper). It had already finished when the orchestrator asked to skip it; cancellation found no remaining process. No additional gate or performance run was started. Per-level legacy console lines each say1 fail flag; aggregate result is0. Log hash and command outcome are retained in `final-gates.json`.

Slim-worktree setup succeeded on the unrestricted run. No performance work, spec edits, forbidden reference edits, push or deployment. Stopped for the orchestrator quiet window; remaining unqualified rows are listed above rather than represented as complete. Browser pool was idle with no holders/waiters at wrap-up.
