# s89-l10gap

Status: incomplete. No gameplay change has been made.

Fresh native baseline at 023991a5. All six runs completed. Dialogue ticks are subtracted from each adjacent attack-start gap. Rate uses first attack to final simulation tick, matching the s86 harness.

| Seed | Tier | Starts | Starts/min | Longest adjusted gap (s) | Dialogue (s) | After |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | low | 35 | 1.896 | 295.07 | 56.00 | Pending |
| 1 | high | 127 | 6.520 | 356.17 | 56.00 | Pending |
| 2 | low | 63 | 3.376 | 298.70 | 56.00 | Pending |
| 2 | high | 240 | 12.238 | 251.28 | 56.00 | Pending |
| 3 | low | 127 | 6.612 | 242.80 | 56.00 | Pending |
| 3 | high | 163 | 8.226 | 242.13 | 56.00 | Pending |

Receipt: [baseline.json](baseline.json). Reproduce with `S89_OUT=/private/tmp/s89-cadence.json node --import tsx/esm tools/qa/s89-l10gap.ts`. Observer uses native complete inputs and the unchanged attack-start observer. This corrects the initial report, whose denominator mistakenly used gameplay time excluding credits.

Seed-1 traces show living actors in chase/search tens to hundreds of metres behind the running courier, with only 0–3 within 30 m during long outdoor gaps. They converge during the protected hangar stop. Several authored archetypes run slower than the courier, so retaining their chase state does not ensure renewed contact. This supports a pursuit/contact diagnosis but does not yet prove a successful remedy.

The fresh seed-1 baseline differs from the s86 reported count. The current receipt is authoritative for these runs; the discrepancy remains to be explained before claiming a rate improvement.

Completed: reproducible six-case native acceptance gate and exact 56-second dialogue exclusion; baseline matrix; typecheck and lint; L10 gameplay audit with zero flags; full audit with only the two existing L4 failures; remote units (106 passed, one skipped). Committed artifacts are measurement tooling and reports only.

Outstanding: a production gameplay fix that passes all six cases, followed by fresh checks against that retained fix. No gameplay, bot, stat catalog, corpse lifecycle, QA threat threshold or protected reference change is retained. The rejected five-case candidate is diagnostic evidence, not a production implementation.

## Browser QA needed

Human QA must inspect visible arrival continuity and sustained combat after a successful native fix. No browser was run and no visual fix is claimed.

Measurement tooling validation: `npm run typecheck` and `npm run lint` pass. Mega cruise is 5.4 m/s before progression scaling, so its persistent trailing distance still needs steering/state evidence; slower regular archetypes alone do not explain that actor.

## Mega diagnostic, seed 1 LOW

A native observation through 300 simulation seconds found the Mega in detailed/close pursuit, configured cruise 5.4 m/s. Between ticks 12000 and 18001 it was staggered for 377 of 6002 sampled ticks (6.28%); the same 377 ticks were under special recovery. Thus the theoretical 25% interruption calculation does not describe this run and is insufficient as the root cause. No hit response was changed. Sampled distance over seconds 200–300 ranged from 10.80 to 31.03 m. Next diagnostic: distinguish navigation detours, special scheduling and non-courier proximity-notice pauses before selecting a fix. Temporary full diagnostic: `/private/tmp/s89mega-counter.json`.

## Rejected movement experiment

In seconds 200–300, Mega non-courier notice pauses and special attacks each occupied zero sampled ticks. Mean resolved movement was 4.61 m/s; 1197/6002 ticks had locomotion velocity below courier run speed. A temporary experiment restored the pre-hit velocity after the configured hit pause, avoiding extra re-acceleration without changing any tuning constants. Native seed-1 LOW completed with 76 starts, 4.107/min, but longest adjusted gap worsened to 390.62 s (baseline 295.05 s). Reverted in full. Receipt `/private/tmp/s89-resume-experiment.json`. No production gameplay change remains. This rules out that movement correction as a sufficient cadence fix.

## Rejected lost-target trial

Trial ended L10 authored archetype pursuit when the courier was ahead beyond visual range and no longer tracked, and prevented the encounter refresh from immediately reassigning those distant actors behind her. Existing streaming released the actors naturally at their actual positions. No stats/caps/teleports/corpse removal changed. All six runs completed, and gaps shortened, but attack rate fell in five cases. Reverted completely. Typecheck and lint passed for the trial. Receipt: `/private/tmp/s89-lost-target-matrix.json`.

| Seed | Tier | Rate before → trial | Gap before → trial (s) |
| --- | --- | --- | --- |
| 1 | low | 1.896 → 2.437 | 295.05 → 143.88 |
| 1 | high | 6.520 → 3.186 | 356.15 → 148.25 |
| 2 | low | 3.376 → 2.381 | 298.70 → 143.90 |
| 2 | high | 12.238 → 3.398 | 251.28 → 213.93 |
| 3 | low | 6.612 → 2.654 | 242.80 → 143.70 |
| 3 | high | 8.226 → 3.345 | 242.13 → 219.20 |

Evidence: reducing indefinite distant chase improves encounter turnover, but simply retiring that pursuit also removes later attack pressure. This trial does not satisfy the original rate invariant or 45 s cadence goal.

Narrow follow-up: retire only outpaced armored/firefighter hunters while retaining runners, dogs and Alphas. Seed 1 LOW completed with 38 starts, 2.059/min and 220.80 s longest adjusted gap; HIGH completed with 43 starts, 2.324/min and 216.05 s gap. HIGH rate is below its 6.520/min baseline, so this follow-up was also fully reverted. Receipt `/private/tmp/s89-slow-target.json`. The two trials disqualify pursuit retirement as the next production fix; retaining fast actors did not preserve the rate.

## Rate distribution and mobile-hunter trial

Baseline rate includes retry pressure: seed-1 HIGH had five deaths and 113/127 starts after 800 s; seed-2 HIGH had six deaths and 220/240 starts after 800 s. The broad lost-target trial had zero deaths in all six cases, increased outdoor attack counts, and reduced finale retry counts. This explains much of its whole-run rate regression without satisfying the original rate invariant. Clarification was requested on whether the rate floor is per-case or the supplied s86 2.45/min reference; no relaxed interpretation has been applied.

A separate seed-1 trial selected existing runners instead of default firefighter/armored hunters, retaining explicit specialists and all group sizes. LOW completed with 35 starts, 1.898/min and 241.38 s adjusted gap; HIGH with 68 starts, 3.674/min, one death and 313.98 s adjusted gap. Fully reverted: faster default archetype selection does not solve contact continuity. Receipt `/private/tmp/s89-mobile-hunters.json`. No gameplay change remains.

## Release and road-offset diagnostics

Three seed-1 paired trials, all completed and fully reverted:

| Trial | LOW starts/min / gap s | HIGH starts/min / gap s |
| --- | --- | --- |
| Release at 45 m instead of 120 m; refresh at 45 m | 3.297 / 236.08 | 3.729 / 313.47 |
| Lane offset relative to road at current X | 5.812 / 377.62 | 8.195 / 254.85 |
| Road-relative offset plus lost-target retirement | 1.616 / 213.08 | 1.783 / 285.08 |

The existing lane offset compares the courier’s current Z to a future group station’s Z, potentially treating normal road bends as off-road crossings. A road-relative calculation changed pressure and raised rate in the standalone trial, but failed cadence; its combination with retirement reduced rate below baseline. These results do not justify retaining either change for this objective. Receipts `/private/tmp/s89-local-release.json`, `/private/tmp/s89-road-offset.json`, `/private/tmp/s89-road-lost.json`. No gameplay change remains.

## Exact dialogue measurement and L10 audit

Observer now excludes only ticks where the authored conversation counter advances, rather than the extra completion tick in the protected area. Fresh seed-1 LOW: exactly 56.00 s excluded, 295.0667 s longest adjusted gap, 35 starts and 1.89633/min. Earlier baseline JSON/table used 56.0167 s; the affected seed-1 gap was understated by one tick. The other matrix rows have not yet been refreshed with this observer. Receipt `/private/tmp/s89-exact-dialogue.json`. Typecheck and lint pass.

`node --import tsx/esm tools/qa/threat-audit.ts --levels L10 --out /private/tmp/s89-l10-audit` completed in 42.5 s. L10 gameplay flags: zero. Top-level exit: 1, solely `PARTIAL_LEVEL_SELECTION:diagnostic run, not a complete gate`; runtime source matches main. No QA flag/threshold changes were made. Full audit remains required for acceptance.

## Corrected pulse diagnostic

The old s86 pulse harness requested runner/sprinter `state: chase` without production’s subsequent `pursueTarget` call, while spawn initializes those L1 brains in wander. A harness-only correction used existing sprinters and explicitly called `pursueTarget`, retaining offscreen safety, nav clearance, resident checks, caps, reserved slots, pending turns and the journey reserve. Seed-1 LOW completed identically to baseline with 35 starts: pulse admissions were **zero**. This is admission evidence only, not a failed test of engaged arrivals. Initial diagnostic without all reserves collided with a production concurrency-cap guard; it was corrected before the completed observation. No production code changed. Receipt `/private/tmp/s89-pressurepulse.json`; producer `/private/tmp/s89-pressurepulse.mts`.

## Engaged arrivals combined with lost-target retirement

Harness-only corrected sprinter arrivals plus the previously tested lost-target source trial admitted 26 actors under production cap/reserve checks. Seed-1 LOW completed with 53 starts and 101.55 s longest raw gap; that longest interval is outside hangar dialogue. Receipt `/private/tmp/s89-lost-pursuing-pulses.json`. This provides actual arrival evidence, unlike the zero-admission control. A follow-up placed arrivals 32 m along current courier velocity rather than x+40: 24 admissions, 49 starts and 162.87 s longest raw gap (`/private/tmp/s89-directional-pulse.json`). Both fail cadence. All source changes were reverted; no production arrival mechanism was added.

## Directed approach diagnostic

L1-brain `pursueTarget` uses `rush`, which routes toward the target position sampled at admission; attracted movement uses 0.85 × run speed. A temporary L10 focused-arrival trial updated that destination from the current courier and selected the existing full run-speed behavior (no catalog/tier constants changed). Seed-1 LOW completed with 166 starts, 8.600/min, six deaths and 306.35 s adjusted gap; HIGH with 293 starts, 12.604/min, ten deaths and 248.37 s gap. Receipt `/private/tmp/s89-directed.json`. Combining this with prior archetype lost-target handling completed seed-1 LOW with 51 starts, 2.734/min, one death and 143.97 s gap (`/private/tmp/s89-directed-lost.json`). Both fail cadence and were fully reverted. The stale sound-style destination is a concrete approach mismatch but fixing it alone is insufficient for the goal.

## Bounded admission-headroom diagnostic

E18 lists 200 HIGH / 100 LOW concurrent infected ceilings; current L10 journey pacing is much lower at 15/12. A temporary trial tripled journey headroom to at most 45/36, retaining authored group sizes, existing spawn safety and finale 22/14 caps. Native seed-1 LOW completed with 696 starts, 29.163/min, 109.57 s adjusted longest gap, 20 deaths and measured peak 26 resident infected. HIGH completed with 375 starts, 15.147/min, 143.08 s gap, 11 deaths and peak 40. Receipt `/private/tmp/s89-headroom.json`. No renderer performance claim. Reverted completely: more admission capacity alone substantially increases attack counts but does not satisfy cadence and causes many retries.

## Full regression receipt

Full audit completed in 486.8 s with exit 1 and exactly the existing `L4/criterion/L4-06 first breach:FAIL` and `L4/criterion/L4-06 sustained horde:FAIL` flags. L10 skilled completed; passive observation reached its configured tick budget with zero passive flags. No new top-level flags. Receipt `/private/tmp/s89-full-audit/audit.json`.

Remote `sh tools/remote/run.sh "$PWD" -- npm test` passed on 94.130.181.173: 106 passed, one skipped, 27 files; budget duration 229.7/240 s, exit 0. No trimming or timeout override. [Validation summary](validation.json). These gates validate retained observer tooling against unchanged gameplay; the cadence objective remains incomplete.

## Combined headroom and focused-approach trials

Headroom 36/45 plus updated, full-speed focused arrival: seed-1 LOW completed with 91 starts, 4.939/min, zero deaths, peak 23, 109.52 s adjusted gap; HIGH completed with 560 starts, 18.862/min, 20 deaths, peak 39, 145.05 s gap. Receipt `/private/tmp/s89-cap-directed.json`. Additional LOW trial resumed explicit focused approach when the L1 brain entered search: completed with 93 starts, 5.019/min, two deaths, peak 36, but 191.97 s gap (`/private/tmp/s89-cap-focused.json`). Both combinations fail cadence and were fully reverted. No production gameplay changes remain.

## Authored-station interception trial

Temporary trial retained initial idle state at journey stations and restricted mission pursuit refresh to the existing perception range instead of 160 m. Finale pursuit unchanged; actors were never relocated. Seed-1 LOW completed with 21 starts, 1.141/min, zero deaths and 191.45 s adjusted gap; HIGH with 61 starts, 3.303/min, one death and 274.00 s gap. Both regress rate and fail cadence. Fully reverted. Receipt `/private/tmp/s89-stations.json`. This disqualifies station waiting as a sufficient substitute for long-range pressure.

## Executable acceptance gate

Native observer now exits 1 for an incomplete run, fewer than two starts, an adjusted gap over 45 s, or any per-seed/tier rate below baseline. A subset matrix is explicitly partial and cannot pass the full goal. Fresh full matrix reproduced every baseline attack count/rate, excluded exactly 56 s of dialogue in each case, and failed exactly six `GAP_OVER_45` flags. Baseline receipt and top table refreshed with exact dialogue counting. No gameplay changed. Typecheck and lint pass. The gate intentionally remains red until a real gameplay fix satisfies all six cases.

## Focused target retention trial

Temporary L10 L1 perception trial retained the explicitly assigned courier target during the existing focus interval, using normal chase movement/attack reach. Seed-1 LOW completed with 40 starts, 2.169/min, zero deaths, 450.03 s adjusted gap; HIGH with 93 starts, 4.995/min, two deaths, 775.25 s gap. Native acceptance gate rejected the subset for cadence and HIGH rate regression. Fully reverted. Receipt `/private/tmp/s89-focus-track.json`. Persistent target knowledge alone worsens contact continuity and is not a solution.

## Headroom, retirement and engaged-arrival feasibility

Harness-only combination: journey cap 36/45, lost-target archetype retirement, eight existing sprinter arrivals every 20 s, production reservation/safety/nav checks and actual `pursueTarget`. Seed-1 LOW admitted 277 actors, recorded 274 starts and a 99.70 s raw maximum (including dialogue); outdoor failures 53.98 s and 54.33 s. Receipt `/private/tmp/s89-headroom-engaged.json`.

Using the existing bounded encounter placement search (33 attempts), excluding the hangar and ending arrival requests at actual charge activation instead of tick 52000 admitted 305 actors and recorded 306 starts. Two raw gaps exceed 45 s: 451.38–524.55 = 73.17 s outdoors; 524.55–606.23 = 81.68 s spanning the hangar. The outdoor gap remains a definite failure. Receipt `/private/tmp/s89-bounded-engaged.json`, producer `/private/tmp/s89-bounded-engaged.mts`. This is not yet a complete acceptance receipt: exact dialogue accounting, final-tick rate, deaths, entity peaks and all six seed/tier cases are still required if this approach advances.

Two-sided arrival formation worsened the outcome: 299 admissions, 54 starts, 181.42 s raw maximum (`/private/tmp/s89-flank-engaged.json`). All source changes reverted; no arrival mechanism retained in production. The bounded forward-arrival combination is the strongest diagnostic lead, but is not a verified solution.

## Precisely measured 10-second bounded-arrival lead

Headroom/retirement source trial plus eight pursuing existing sprinters requested every 10 s through bounded safety checks: seed-1 LOW completed, one death, resident infected peak **36**, 371 admitted arrivals, **358 attack starts**, **19.300/min** using final world tick 67054, exactly **56.00 s** dialogue excluded. Exactly one adjusted failure remains: **385.20–433.43 s = 48.23 s**. Receipt `/private/tmp/s89-bounded-ten.json`; producer `/private/tmp/s89-bounded-ten.mts`; source trial applicator `/private/tmp/s89-apply-candidate.py`. This is the strongest current lead, still failing and only seed-1 LOW measured.

Increasing bounded placement attempts from 33 to 65 reproduced identical results (`/private/tmp/s89-bounded-wide.json`). Increasing request frequency to 8 s failed completion at the 1800 s budget, six deaths, peak 36 and 488.93 s adjusted gap (`/private/tmp/s89-bounded-eight.json`): rejected. All temporary source edits reverted. No stat constants or production arrival mechanism changed.

## Full bounded-arrival matrix: rejected

The 10-second feasibility candidate was measured on all six cases with exact dialogue counting. Rates exceeded baseline throughout and peaks stayed at 36 LOW / 45 HIGH, but seed-2 LOW failed completion and all five completed cases failed cadence. All temporary source edits reverted.

| Seed | Tier | Completed | Starts/min | Gap s | Deaths | Peak |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | low | True | 19.300 | 48.23 | 1 | 36 |
| 1 | high | True | 19.342 | 60.98 | 3 | 45 |
| 2 | low | False | 51.398 | 25.82 | 26 | 36 |
| 2 | high | True | 45.795 | 106.53 | 25 | 45 |
| 3 | low | True | 22.954 | 59.60 | 4 | 36 |
| 3 | high | True | 23.394 | 70.65 | 8 | 45 |

Receipt `/private/tmp/s89-bounded-matrix.json`; producer `/private/tmp/s89-bounded-matrix.mts`; compact measurements preserved in [validation.json](validation.json). The promising seed-1 LOW result did not generalize. The candidate must not be described as an accepted fix.

## Adaptive lull-arrival diagnostics

Request eight arrivals only after 15 s without a courier attack start, checked every 10 s, with the same headroom/retirement/safety setup: seed-1 LOW completed, zero deaths, peak 36, 188 starts, 10.214/min, 49.28 s adjusted maximum; seed-2 LOW completed, one death, peak 36, 212 starts, 11.494/min, **41.18 s** maximum (passing that row only). Receipt `/private/tmp/s89-lull-arrivals.json`; producer `/private/tmp/s89-lull-arrivals.mts`.

A 10 s lull checked every 5 s regressed: seed-1 LOW completed with 74.27 s maximum; seed-1 HIGH failed completion at 1800 s with 26 deaths and 51.83 s gap. Remaining runs deliberately terminated after these decisive failures (process exit 143); partial receipt `/private/tmp/s89-lull-matrix.log`. No full-matrix pass is claimed. Source changes reverted.

Harness lifecycle issue identified for further investigation: `charge-active` resets on retry to the pre-charge checkpoint, allowing nominal journey arrivals to resume around the installed-cure finale. A future trial must exclude installed-cure retries before judging finale deaths/pressure; neither current producer is suitable for production as written.

## Corrected adaptive lifecycle matrix

15 s quiet threshold, check every 5 s, requests stop permanently once cure is installed (including finale retries). Existing headroom/retirement/safe-placement setup. All six completed; seed-1 LOW/HIGH and seed-3 HIGH pass cadence and rate. Other three fail cadence; seed-2 HIGH additionally regresses rate against 12.238/min baseline. Exactly 56 s excluded in each case; peaks 36/45. No full pass claimed, temporary source changes reverted.

| Seed | Tier | Starts/min | Gap s | Deaths |
| --- | --- | --- | --- | --- |
| 1 | low | 13.021 | 44.18 | 0 |
| 1 | high | 16.376 | 44.97 | 1 |
| 2 | low | 12.482 | 71.43 | 0 |
| 2 | high | 11.559 | 53.70 | 0 |
| 3 | low | 12.372 | 72.43 | 0 |
| 3 | high | 19.598 | 44.00 | 5 |

Receipt `/private/tmp/s89-lull-lifecycle-matrix.json`, producer `/private/tmp/s89-lull-lifecycle-matrix.mts`; measurements also preserved in validation.json. Fixed x+40 placement around military road turns remains a placement hypothesis to test, not a proven explanation.

## Road-aware and closer-anchor placement diagnostics

Road-arc placement 40 m ahead, using closest authored road segment and unchanged nav/offscreen checks, completed seed-2 LOW with 248 starts, 13.454/min, zero deaths and 70.95 s maximum: failed (`/private/tmp/s89-road-arrivals.json`).

A 24 m forward anchor through the same bounded safe placement gates passed seed-2 LOW at 29.90 s, then failed generalization across the full matrix. All six completed and exceeded baseline rate; only seed-2 LOW passed cadence. Peaks remained 36/45.

| Seed | Tier | Starts/min | Gap s | Deaths |
| --- | --- | --- | --- | --- |
| 1 | low | 16.142 | 73.62 | 2 |
| 1 | high | 19.072 | 54.67 | 3 |
| 2 | low | 16.049 | 29.90 | 0 |
| 2 | high | 25.084 | 300.65 | 15 |
| 3 | low | 16.350 | 74.63 | 1 |
| 3 | high | 16.072 | 49.90 | 0 |

Receipt `/private/tmp/s89-close-arrival-matrix.json`; producer `/private/tmp/s89-close-arrival-matrix.mts`; compact results in validation.json. Temporary source edits reverted. Next useful diagnostic is actor state/route behavior during the recurring military-bend gap, not additional global timing changes.

## Military-gap actor trace and cover preference

Seed-2 LOW adaptive lifecycle trace reproduces 71.43 s gap (`/private/tmp/s89-military-trace.json`, producer `/private/tmp/s89-military-trace.mts`). At 390 s multiple sprinters are 14–19 m away, still in attracted approach with existing nav paths; at 400 s those IDs are absent from the nearest eight living actors, and at 410 s new arrivals are again ~34 m away. This narrows the relevant sequence but does not alone distinguish every kill from streaming release.

Trial preferred legal, offscreen, nav-clear candidate points behind real combat LOS cover using 65 bounded attempts, falling back to existing 33-attempt legal placement. Seed-2 LOW completed: 253 starts, 13.287/min, two deaths, peak 36, exactly 56 s dialogue excluded, 72.87 s adjusted maximum. Failed cadence; all temporary source edits reverted. Receipt `/private/tmp/s89-cover-arrivals.json`.

## Clock and existing occlusion contract audit

`Mission.restore` preserves the live world tick and computes a checkpoint delta for restored timers; retries do not rewind the measurement clock. The native receipt final-tick denominator therefore remains valid. `SpawnDirector.safe` already requires ≥18 m distance plus either whole-silhouette offscreen placement **or** whole-silhouette solid-cover occlusion, followed by nav clearance. `occluded` uses the actual simulation camera position and all silhouette rays. The hypothesis that covered in-frame arrivals are categorically blocked by the camera gate is contradicted by current source; no safety changes are warranted. These reads eliminate two potential measurement/admission explanations without changing gameplay.

## Existing-archetype formation trials

Ordinary-runner-only arrivals completed seed-2 LOW with 239 starts, 12.984/min, zero deaths and 71.48 s gap (`/private/tmp/s89-ordinary-arrivals.json`). Mixed formations of two existing firefighters and six runners then passed seed-2 LOW alone, but failed generalization:

| Seed | Tier | Starts/min | Gap s |
| --- | --- | --- | --- |
| 1 | low | 13.937 | 49.37 |
| 1 | high | 12.845 | 64.45 |
| 2 | low | 12.538 | 44.53 |
| 2 | high | 23.775 | 54.47 |
| 3 | low | 13.484 | 72.17 |
| 3 | high | 11.669 | 54.38 |

All six completed; only seed-2 LOW passed cadence. Receipt `/private/tmp/s89-mixed-matrix.json`. Wider 16-sprinter burst at unchanged 36/45 caps completed seed-1 LOW/HIGH with zero/one deaths, rates 22.025/15.706, peaks 36/45, but gaps 47.70/101.83 s (`/private/tmp/s89-wide-burst.json`). Rejected. All temporary source changes reverted; no archetype catalog values changed. Formation size or a tougher centre pair does not establish a reliable fix.

## Front/rear and escape-gap navigation controls

Splitting the eight existing sprinter arrivals between safe +24 m and −24 m anchors completed seed-1/2 LOW, but produced adjusted gaps 97.02/94.62 s and rates 9.807/6.566 per minute: rejected (`/private/tmp/s89-front-rear.json`).

Read-only native streamed-nav fixtures checked all five authored escape gaps with endpoints 3 m either side. Existing clearance .5 and comparison .35 both returned direct visibility and successful identical 12-cell routes in every case. Openings are 2 m wide in layout.ts; ordinary bodies can route through them. Thus baked clearance at these gaps is not the cause of long approach detours; no grid change was made. Receipt `/private/tmp/s89-gap-nav.json`, producer `/private/tmp/s89-gap-nav.mts`. Temporary source changes from the arrival trial were fully reverted.

## Larger-headroom matrices and finale rejection

At 60 residents, seed-1 LOW/HIGH and seed-2 LOW/HIGH passed cadence/rate; seed-3 LOW/HIGH failed at 54.88/84.25 s. Receipt `/private/tmp/s89-sixty-matrix.json`. At 70 residents, **five cases pass completion, cadence and rate**: seed-1 LOW 42.12 s; seed-2 LOW/HIGH 43.28/32.53 s; seed-3 LOW/HIGH 42.23/40.65 s. Seed-1 HIGH fails completion and has 294.85 s gap. Peaks 69–70. Full compact matrix preserved in validation.json; source receipt `/private/tmp/s89-seventy-matrix.json`. 90-HIGH trial also failed seed-1 HIGH and remaining runs were stopped. No passing full candidate exists.

Finale trials rejected: removing the surviving-wave gate failed seed-1 HIGH completion at 70 (294.92 s) and seed-3 HIGH at 60 (157.95 s); smaller 6/4 finale waves left the seed-3 HIGH 84.25 s gaps unchanged; retaining distant non-finale actors as sleeping snapshots completed but caused 20 deaths and 128.45 s gap; stopping journey requests at complex entry still failed seed-1 HIGH completion with 224.93 s gap. Receipts `/private/tmp/s89-wave-gate.json`, `/private/tmp/s89-wave-sixty.json`, `/private/tmp/s89-smaller-finale.json`, `/private/tmp/s89-finale-residency.json`, `/private/tmp/s89-complex-cutoff.json`. All reverted.

Captured blocker (`/private/tmp/s89-finale-blocker.json`): `Kill the Mega Alpha`, charge ready, courier alive, boss HP 1833.4 and nearby. A bot swap-deadline trial failed completion (198.50 s); a phase-2 flamethrower selection/approach trial also failed (294.85 s). Both bot changes reverted. Correction to initial hypothesis: Damage.ts multiplies ordinary phase-2 damage by .35; it does not fully reject those hits. No QA policy or bot change is retained.

## Portable rejected-candidate artifact

[rejected-candidate.json](rejected-candidate.json) preserves the exact 70-resident source patch, portable native producer, SHA-256 hashes, reproduction steps and six-case receipts. It is explicitly rejected because seed-1 HIGH fails completion and cadence; it does not implement production arrivals. This avoids depending on temporary scratch files for the strongest five-case lead.

Intermediate 65-resident seed-1 HIGH trial also failed completion: peak 64, 12 deaths, 631 starts, 21.087/min and 189.73 s adjusted gap (`/private/tmp/s89-sixtyfive-first.json`). No full matrix was warranted after that decisive failure. All gameplay source edits reverted after artifact capture.

## Final tested bot-selection control

A shared-bot trial preferred the existing flamethrower at its normal range throughout the Mega finale, rather than only while armour was intact. Seed-1 HIGH still failed completion: 12 deaths, 608 starts, 20.319/min, peak 69 and 294.28 s adjusted maximum (`/private/tmp/s89-flame-boss.json`). Reverted. No native policy change is retained to force a pass.

## Handoff state

The full objective is **not achieved**. Production gameplay remains at the s86 merge. The native gate intentionally fails all six baseline cases; a portable rejected experiment demonstrates five passing cases but stalls seed-1 HIGH in the Mega objective. Reproduction and measurements are preserved in rejected-candidate.json and validation.json. The remaining failure is not a missing permission or external service blocker, and no blocked/complete goal status is claimed. No browser, deployment, push or main-branch movement was performed.
