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

Outstanding: root-cause fix, hangar-adjusted whole-run gap measurement, after matrix, L10 audit with zero flags, full audit with no new flags, typecheck, lint, remote units, and focused commit. No stats, caps, corpses, QA thresholds or protected reference files changed.

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
