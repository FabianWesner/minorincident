# L3 comparison — gun-raise

## The six alleged new failures

The gun-hold report recorded nine failures, but reran only four baseline criteria. Three baseline failures do not establish that the other six were new. Its full result is **229.6167 s**, identical to the exact `96dc52d0` baseline rerun. Gun-hold changes no simulation, data, bot or level-test code:

```sh
git diff 80a9d089 3c30b499 -- src/sim src/data src/debug/bot tools/sim-runner tests/levels
# empty
```

The original three baseline failures were T-E21-02, 04 and 12. The other six were 08, 09, 10, 11, 13 and bots. A full remote baseline and starting-main battery were run, with the same headless-independent simulation inputs and two-worker limit. **All nine baseline failures reproduce with the same failure values as gun-hold’s original report (11/20 pass), including all six alleged new failures.** Results are recorded in the adjacent comparison JSON files. No failures are claimed flaky and no tolerances were loosened.

| Alleged new criterion | Exact baseline failure (also in gun-hold report) |
| --- | --- |
| 08 recruitment | No run has 3–4 recruits; actual 8. |
| 09 near courier | .635183 < .8 near-8-m share. |
| 10 attrition | 7 arrivals > 2. |
| 11 forced street | Oak seed 1 uses Oak and Commerce. |
| 13 pressure | 0 emergences < 1. |
| bots evade | 1 successful seed < 2. |

[Original gun-hold failures](../gun-hold/captures/l3-failures.txt) and [full baseline assertions](comparison/baseline-tests.json) agree on all nine failures. These are reproducible historical failures, not new gun-hold failures.

## Separate merges

| Snapshot | Complete time | Deaths | Officers recruited / arriving | S1 officer / player knockdowns | S1 damage | Near-8-m share |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `96dc52d0` baseline | 229.6167 s | 0 | 8 / 7 | 77 / 11 | 11 | .635183 |
| `889f8115` station-back + zombie-hearing | 226.5333 s | 0 | 9 / 7 | 79 / 5 | 0 | 1 |
| `80a9d089` + police-range | 362.8167 s | 5 | 7 / 0 | 0 / 24 | 33 | 1 |
| `3c30b499` + gun-hold (starting main) | 362.8167 s | 5 | 7 / 0 | 0 / 24 | 33 | 1 |

The last two complete-bot reports are identical. The hearing checkpoint also includes station-back; that merge only changes the L1/L2 station and route, so the L3 difference is attributable to hearing. Police-range is the marginal change between the second and third rows. It retains the deliberate on-screen gate: target within 4.55 m of the courier, within the conservative portrait projection, and within 6 m of the officer. Followers trail 4–6 m behind the courier, leaving many targets in front outside their permitted shot range. The new range rules explain the collapse in covering fire and the much longer complete run. Gun-hold has no simulation effect.

The six-criterion runs (02, 08, 09, 10, 11, bots) give:

| Criterion | Hearing checkpoint | Police checkpoint |
| --- | --- | --- |
| 02 complete time | FAIL: 226.5333 > 225 | FAIL: 362.8167 > 225 |
| 08 3–4 recruits | FAIL: 9 recruits | FAIL: 7 recruits |
| 09 squad strength | PASS | FAIL: 0 officer share < .6 |
| 10 squad attrition | FAIL: 7 arrivals > 2 | PASS |
| 11 forced street | FAIL: Oak later uses Commerce | FAIL: Oak does not complete |
| bots evade | PASS | PASS |

This identifies a police-range balance regression and existing historical-criterion conflicts. It does not justify changing gun-hold or removing the on-screen shooting requirement.

## Unchanged historical conflicts

- **04:** test asserts 40 HP and two 20-damage hits, while the authored runner has 60 HP.
- **08 / 10:** old 3–4 recruitment and <=2-arrival criteria conflict with the PO instruction that every surviving officer retreats. [Squad follow report](../../reports/l3-squad-follow.md) explicitly documents removal of the four-officer cap and systemic rescue of the survivors.
- **12:** old 10/25/40 prepopulation conflicts with the same PO's fivefold population instruction; actual values are 50/120/200 on baseline.
- **13:** no pressure emergence occurs in the baseline fixture; active-cap headroom in the dense scene is a candidate cause, not isolated by this comparison. The fixture also retains the pre-fivefold pressure-count assertion.
- **bots:** only one of the three baseline evade seeds completes, against the unchanged minimum of two. Hearing and police comparisons both pass this criterion; no test assertion changed.
- **02 / 09 / 11:** real balance/follower/forced-route failures are reproducible on baseline; police-range worsens covering fire and the forced Oak outcome.

These gates were retained. Changing the explicit population, retreat or range requirements would require a product decision; passing them by expanding bands or reducing populations would violate this task's prohibition.

## Starting-main full battery

Starting main (`3c30b499`) passes **10/20**, failing 02, 03, 04, 05, 08, 09, 11, 12, 13 and 18. Compared with baseline, 10 and bots recover; 03, 05 and 18 fail after the intervening hearing/police changes. This is distinct from gun-hold's pre-merge 11/20 report. The complete-bot reports across the police parent and gun-hold merge remain identical.

## Raise cancellation regression found during validation

An intermediate implementation treated `selectorSide` as a manual weapon switch. `ControlIntent` also emits it automatically when choosing the side for a target, so crowd transitions could repeatedly abort a pending gun tap. The intermediate complete bot timed out at 600 s. The correction cancels only explicit slot/wheel choices (or replacement of the gun itself); automatic target-side intent preserves an accepted shot. A focused unit check pins that behavior, alongside manual-switch cancellation without ammunition consumption. The intermediate result is saved as `cancel-intent-regression-complete.json` and is not the final implementation result. With the correction, the complete bot finishes at **273.8833 s with one death and one arriving officer**. It matches an independent earlier raise run exactly, restoring deterministic completion; the historical 225 s upper band still fails.

## Related fixture repairs

The remote full `tests/sim` run exposed two L2 vehicle tests whose hardcoded coordinates still referred to the pre-station-back route. Both pass on `96dc52d0`. Their fixtures now derive an obstruction and a perpendicular traffic crossing from `truckPoseAt` on the authored route. The original braking <=4 m/s², zero-overlap, held-passenger and arrival assertions are unchanged; both pass locally and remotely.

The standing-police render fixture likewise needed an on-screen courier observer and a target within the existing police-range rule. Only fixture placement changed; all original muzzle, body and grip tolerances remain intact.

## Final corrected-source full battery

The full remote run finishes **11/20**, matching the earlier raise battery's counts and failure values. Failing criteria are 02, 04, 05, 08, 09, 11, 12, 13 and 18. All nine also fail on starting main; criterion 03 recovers relative to starting main. The complete report again matches 273.8833 s / one death / one arriving officer exactly. The forced Oak and checkpoint failures remain; no threshold or balance changes were made to hide them. [Final assertions](comparison/l3-final-corrected-tests.json) retain the exact failures.

Acceptance is incomplete: the historical L3 rules require reconciliation/balance work, and the unchanged NPC patrol performance budget remains red on the baseline and parent as well as this implementation. [Validation](validation.md) records all passing and failing gates.
