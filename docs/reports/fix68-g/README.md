# fix68-g — global gameplay corrections

**PARTIAL / NO-GO.** The requested counterexamples have scoped corrections and receipts, but the required standalone threat gate fails with14 flags. Full global-row closure and release acceptance are not achieved.

Base: `be6af29`, branch `lane/fix68-g`. No push or deployment. Scheduled counts, population caps, maximum run speeds, announcement timers and acceptance thresholds are unchanged. No performance work or protected reference/spec edits.

## Requested counterexamples

| Row | Correction / clarification | Measurement |
| --- | --- | --- |
| G-18 | `4cd4fe2`, `310b3ae`: finite courier focus allows a nearer human to interrupt the approach, including focused non-runner archetypes. | All eight cited L3/L4/L6/L8 runner cases now attack the escort in 39–56 ticks; previously they walked 7.5–10 m toward the distant courier. The expanded 540-cell probe and 520 direct-contact cells retain utility-role and synthetic L9 exceptions. |
| G-20 | `07d80d1`: L7/L9 use the common engaged run-out before their special ending. | Both qualities change from zero protection to 300 ticks. All 18 valid arranged final-predicate fixtures pass. Two L5 fixture setups hit the existing concurrency cap; this is not a claim of 20/20 naturally completed endings. |
| G-22 | `49d44dc`, `d485990`: existing cover, doors and finite approach goals; preserve active deadlines on refresh. | All12 final-source timing checks pass; worst15.133s. Every cohort has ≥4 independently reachable living members at both1s/2s, both tiers/canonical policies. [Timing](G-22-final-source.json), [paths and controls](G-22-final-paths.json). |
| G-13 | `dd84acf`: L5 response correction; `f6031ca`: nearest existing L3 slots and the existing calm follower response. | L5 minima 95.623% / 97.644%, zero waiting, five rescued. L3 low all four ≥99.54%; high one qualifying officer at100%, others overwhelmed before10 samples. Both-tier army-line and attack-rate rules pass. [L5 proof](G-13-fix.json), [L3 follow-up](G-13-L3-fix.json). |
| G-15 | `a1ec11d`: input grace ends at exactly tick 27; rendered heading hands back to walking on that tick. | Physical WASD/mouse: six weapon/tier cells, 24 attacks, no click drift or move targets. Late heading error falls from 71.1° to 0°; release grace 28 → 27 ticks. All 60 captures inspected. |
| G-09 | `6dc2f6a`: close the L4 in-place hold finding under the clarified HUD criterion. | Actual HUD text present in all 28 samples, low/high × zoom 1/1.5; no world ring by design. All 12 captures inspected, including intermediate UI configurations. |
| G-21 | `0dccac0`: close the live-world contract conflict under the clarified E19 decision. | Four actual mortal respawns at naturally reached L1 accident/bat checkpoints: zero position error, live gate flags preserved, removed pickup stays removed. No game change needed. |

These are scoped counterexample closures. Reviews deliberately do not claim that a narrow fixture qualifies every clause of a global row. In particular, G-09 still needs all spatial step starts, G-21 still needs the full follower/objective matrix, G-18 retains synthetic-role cases, and G-20 still needs natural special-ending routes.

## L3 correction

Move the existing opaque alarm truck closer to the attack opening. Keep the authored wave populations and clocks, admit announced arrivals under the unchanged global cap, and defer ordinary residents while those quotas remain pending. Moving retreat arrivals use existing offscreen refuge doors ahead of the courier. High-tier finite arrival goals follow the column without extending their expiry or replacing acquired human chases/attacks. Resolve a high-tier runner reaching the existing short lunge range before crowd separation pushes it away again. No lunge range increase.

[G-22-baselines.json](G-22-baselines.json) separates the original reported main timings from the staged baseline after G-18: low complete 24.8 / 4.533 / no attack, high complete 5.85 / 3.55 / no attack, and high stationary station-1 25.017 s. Both histories retain their source identities.

[G-22-trials.json](G-22-trials.json) distinguishes rejected diagnostics from the final receipts. Two invalid browser runs are retained as rejected: dev-server HMR and a build/preview race (16 errors). The clean frozen-preview retry has zero browser errors. All 67 L3 captures were personally inspected, including rejected captures: [G-22-captures.json](G-22-captures.json). These use ordinary complete-bot frames and fixed stepping, with courier survival protection for visual review; they are not physical WASD input or mortal difficulty proof. Actual native attack-clock receipts provide timing proof. The final build has20 additional personally inspected frames, zero browser errors and explicit observations: [final captures](G-22-closeout-captures.json). All159 raw captures and37 derived sheets are hashed and deleted: [cleanup](capture-cleanup.json).

The first whole-group rerun exposed L3 officer pace and competent attack-rate regressions. Nine isolated variants were compared using the unchanged evaluator; faster travel that broke the three-seed army-line rule was rejected. The selected follow-up assigns the same four officers to their nearest existing slots and reuses the existing calm follower response (12m/s² acceleration, jerk300, omega20). Combat motion and the6.2m/s maximum remain authored. At `f6031ca`, the cleaned implementation exactly matched both successful prototype end states; final `d485990` receipts retain their own source identity after deadline preservation. High-tier pace coverage is explicitly limited by early casualties. Final human waiting upper bounds are1.23%/2.09%. The existing aggregate including the corgi is12.95% at high and remains inconclusive; it is not relabelled as passing. [Human bound proof](G-13-L3-human-wait-bound.json), [L3 trials](G-13-L3-trials.json), [final pace source](G-13-final-source.json).

The deadline audit found43 goal refreshes shortening an active arrival assignment, by up to652ticks. `d485990` preserves the later existing deadline rather than resetting from the current tick. After: zero shortenings; both traces match unobserved controls. [Deadline proof](G-22-deadline-fix.json).

### Final L3 cohort clocks

| Tier / policy | Wave0 | Wave1 | Wave2 |
| --- | ---: | ---: | ---: |
| Low complete | 2.950s | 3.633s | 7.433s |
| Low stationary | 2.950s | 2.967s | 4.467s |
| High complete | 2.417s | 0.167s | 14.467s |
| High stationary | 2.417s | 15.133s | 7.333s |

All six supplementary prefixes match their unobserved controls. The two exact stationary-input prefixes also match the canonical stationary acceptance state hashes. Separate passive-policy diagnostics are labelled separately.

## Remaining measured failures and review limits

- **L3-02 admission discrepancy remains FAIL:** low third-cohort mission ledger50 IDs versus cohort observer48. IDs226/240 are absent at the first sampled tick. A read-only audit now proves both living60HP actors are released by `LevelThreeCollapse.retire` on their admission tick3030/3090, before cohort observation; exact unobserved-control hashes match. Include announced IDs in existing pursuer protection as a candidate repair, then requalify counts, army-line and combat balance. The candidate repair is unapplied and unvalidated. No counts/caps were lowered. [Original receipt](L3-02-admission-discrepancy.json), [lifetime finding](L3-02-retirement-finding.json).

- **L5-08 distance band remains FAIL at low quality:** Mia 94.48%, Okafor 93.94% in the 2–5 m band (target 95%). Maximum continuous excursions are 82/99 ticks. High now passes all five. This separate distance criterion is not hidden by the G-13 pace fix.
- Rejected L5 geometry/speed/steering trials remain labelled in [G-13-trials.json](G-13-trials.json). Trials that lost a survivor were rejected; the selected route rescues five at both tiers.
- Full physical all-level routes, WebGPU, spatial objective inventory and PO taste judgments are not qualified by native simulations or stills. P: PO should assess whether the L5 group keeps pace naturally and whether the L3 retreat crowd feels threatening and fair.
- `14a5587` repairs an existing architecture test whitelist for the already-merged synchronous save codec. Only the four synchronous fflate named imports are permitted; worker/stream adapters remain forbidden. No dependency added.

## Validation

Final gameplay commit: `d485990`, source `7a321255a8c84bef605e559daa152064dee4f1b4b1019eb4d7f35ccd86f9f967`. [Commands, exits and hashed logs](validation.json). No check remains running at handoff.

| Check | Result |
| --- | --- |
| `npx tsc --noEmit` and `npm run typecheck` | PASS |
| `npm run lint` | PASS, including final diagnostic tools |
| `npm test` | PASS:27 files,107 tests; registered test budget unchanged |
| Production QA build | PASS |
| `npm run qa:accept -- --level all --skip-browser` | Exit1: all40 native receipts refreshed, all20 moving routes complete, all20 checkpoint controls identical;95 checkpoint cases pass,0 fail/unchecked |
| Final `qa:accept --reuse --skip-browser` consolidation | Exit1; measured failures/full-row gaps retained |
| `npm run qa:threat` alone | **FAIL:14 flags**,419.2s within600s budget |
| Final-source visual capture review |20 final L3 frames,0 browser errors; all159 lane captures personally viewed, hashed and deleted |

The exact whole-group fresh failing rows are L1-08, L2-11, L3-02/06/08/10, L5-08, L6-04/05 and L7-09. L4/L8/L9/L10 have no fresh failing clauses, which does not qualify their unmeasured clauses. [Whole-group summary](qa-accept-summary.json).

The14 standalone threat flags are:

- L3: `L3-02 cohorts:FAIL` (one flag), including the same-tick retirement finding above.
- L6: `l6.breach2:WAVE_FEWER_THAN_THREE_COHORT_MEMBERS` (one flag). Passive window admits1 of10 promised members; first real attack11.017s. Trace the shared strict-cap reservation and conversion refusal path; no small validated repair was established in this lane.
- L7: six follower IDs62/63/67/70/71/74 fail pace in both `step/corridor` and `phase/encounters` (twelve flags). Individual medians0.474/0.682/0.906/0.562/0.590/0.980m/s against group1.129m/s. Preserve the combat and stationary-wait samples; inspect their routes, collision and fear/controller state before tuning. The separate complete high-tier L7-09 pace ratio0.949980 is also a real fresh failure, not rounded up to0.95.

Full standalone output and individual level receipts are compressed without rewriting: [threat manifest](threat-final/manifest.json). The zero-flag gate is unmet; these findings are retained rather than changing thresholds or suppressing flags. This is the time-boxed handoff permitted by the brief, with remaining work recorded. No human-only blocker is asserted.

Two earlier acceptance attempts were intentionally interrupted for the L3 follow-up and deadline preservation. Their matching native receipts are archived under [before follow-up](accept-before-L3-followup/manifest.json) and [before deadline preservation](accept-before-deadline-preservation/manifest.json); neither is represented as a completed all-level run.
