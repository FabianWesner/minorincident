# P1 danger: native comparison and L7 evacuation

**Not accepted: shared ordinary mechanics and L7 checks pass; the global route-damage parity gate remains red.** No push, deploy or browser run was performed.

## Method and limits

PROD is batch 59 `2741447027b1073e6ee581d03a6ee60feaa6e113`; before is main `cab3405c20f3bf4214c99d764d61c526b3e0c525`. Source archives are identified in [snapshots.json](evidence/snapshots.json). Native pressure runs use seed 1 and low population. L4/L6 historical reruns overlay the current early-campaign bot/navigation code on the original simulation snapshots; their rows supersede the original historical-policy comparison, which is retained in evidence. The same no-attack wrapper is used for passive comparison. Both input entry points suppress attacks; passive courier damage is mortal. No health injection is used for these route outcomes.

Cells below are **total courier HP lost/min / landed infected hits/min / deaths** over actual observed simulation time, including retries. Attack starts and misses are not landed hits. Total HP includes environmental damage; infected-only totals, duration, completion and source hashes remain in [the row manifest](evidence/current-row-sources.json). L9's damage is vehicle/environmental: there are zero direct infected courier hits in all three builds, so these numbers do not establish infected-to-vehicle pressure parity. A one-seed whole-route comparison is sensitive to changed encounters, checkpoints and completion duration; it is not a statistical estimate.

Late-campaign native policies are retained with their redesigned builds. Early L1–6 decisions use unchanged bot code, with current Walker helpers; L4/L6 changed decision code is explicitly overlaid for the matched historical runs. L7's revised policy has a body-width corner tolerance, chooses the carried axe sweep when surrounded, and keeps close-combat weapon selection stable between 6 and 9 m. It uses normal input, cover, collision, weapon windups and cooldowns. Therefore the L7 before/after comparison includes both encounter design and a more capable completion policy; it does not isolate layout causally.

## Skilled native routes

| Level | PROD HP/min / hits/min / deaths | Main before | Restored | HP/min vs PROD | Acceptance gate |
|---|---:|---:|---:|---:|---|
| L1 | 15.63 / 1.56 / 0 | 15.64 / 6.26 / 0 | 31.29 / 3.13 / 0 | +100.2% | RED: above band |
| L2 | 14.04 / 0.78 / 0 | 10.92 / 6.07 / 0 | 42.08 / 4.21 / 0 | +199.7% | RED: above band |
| L3 | 35.86 / 3.46 / 1 | 11.26 / 1.86 / 0 | 78.13 / 7.81 / 1 | +117.9% | RED: above band |
| L4 | 136.87 / 18.58 / 5 | 102.12 / 31.80 / 4 | 137.40 / 18.50 / 6 | +0.4% | PASS |
| L5 | 42.67 / 3.41 / 1 | 20.72 / 1.66 / 0 | 37.81 / 3.78 / 1 | -11.4% | PASS |
| L6 | 9.15 / 0.92 / 0 | 12.14 / 1.21 / 0 | 9.07 / 0.91 / 0 | -0.9% | PASS |
| L7 | 0.00 / 0.00 / 0 | 16.79 / 11.19 / 0 | 57.81 / 4.63 / 0 | — (PROD zero) | L7 outcome gate |
| L8 | 0.00 / 0.00 / 0 | 30.51 / 3.05 / 0 | 30.50 / 3.05 / 0 | — (PROD zero) | PASS: ≥PROD |
| L9 | 0.00 / 0.00 / 0 | 13.80 / 0.00 / 0 | 13.80 / 0.00 / 0 | — (PROD zero) | ≥PROD losses; zero infected hits |
| L10 | 13.79 / 1.38 / 0 | 7.89 / 0.81 / 1 | 32.04 / 3.03 / 5 | +132.3% | PASS: ≥PROD |

## Passive native routes

| Level | PROD HP/min / hits/min / deaths | Main before | Restored | HP/min vs PROD | Acceptance gate |
|---|---:|---:|---:|---:|---|
| L1 | 36.50 / 3.65 / 0 | 16.69 / 7.30 / 0 | 263.29 / 26.68 / 18 | +621.4% | RED: above band |
| L2 | 326.21 / 19.55 / 65 | 84.13 / 34.35 / 15 | 262.51 / 26.30 / 52 | -19.5% | RED: below band |
| L3 | 188.41 / 18.65 / 36 | 98.56 / 9.60 / 18 | 172.81 / 17.40 / 34 | -8.3% | PASS |
| L4 | 290.00 / 31.10 / 13 | 292.03 / 41.36 / 15 | 239.68 / 26.35 / 11 | -17.3% | RED: below band |
| L5 | 272.93 / 22.65 / 50 | 74.53 / 55.20 / 14 | 239.92 / 24.05 / 43 | -12.1% | PASS |
| L6 | 128.12 / 12.81 / 11 | 124.69 / 12.47 / 3 | 360.00 / 36.00 / 72 | +181.0% | RED: above band |
| L7 | 355.99 / 36.77 / 1 | 80.90 / 54.18 / 1 | 254.12 / 19.06 / 1 | -28.6% | L7 outcome gate |
| L8 | 178.18 / 14.05 / 4 | 191.50 / 19.15 / 38 | 250.40 / 24.09 / 49 | +40.5% | PASS: ≥PROD |
| L9 | 0.00 / 0.00 / 0 | 299.00 / 0.00 / 29 | 299.00 / 0.00 / 29 | — (PROD zero) | ≥PROD losses; zero infected hits |
| L10 | 188.77 / 20.15 / 110 | 343.67 / 34.37 / 103 | 299.29 / 30.23 / 89 | +58.5% | PASS: ≥PROD |

The strict band has not been waived. L1–3's skilled damage exceeds it after full moving hits and shared catalog stats. L4's first passive comparison mixed a twenty-minute historical-policy retry loop with a five-minute moving-defence route; the corrected table uses the matched policy on both simulations. The redesigned L8/L10 readings meet the brief's minimum-PROD requirement. L9 has zero direct infected courier hits in every build, so its higher environmental losses are not evidence about infected-to-vehicle damage. These differences are reported, not hidden by a changed measurement window or reduced zombie wounds.

## Standing courier time to kill

A separate controlled fixture uses one runner at 2.3 m, a stationary 100 HP courier and no attacks. It is not native level TTK. In restored code all ten level flags take **8.583 s, 10 landed hits and 100 HP**. PROD takes 8.617 s (L3 8.733 s); main takes about 8.583 s, except L7 **59.883 s / 67 hits**. [Raw fixtures](evidence/routes/batch59/ttk.json).

| Level | PROD TTK s | Main TTK s | Restored TTK s |
|---|---:|---:|---:|
| L1 | 8.617 | 8.583 | 8.583 |
| L2 | 8.617 | 8.583 | 8.583 |
| L3 | 8.733 | 8.667 | 8.583 |
| L4 | 8.617 | 8.583 | 8.583 |
| L5 | 8.617 | 8.583 | 8.583 |
| L6 | 8.617 | 8.583 | 8.583 |
| L7 | 8.617 | 59.883 | 8.583 |
| L8 | 8.617 | 8.583 | 8.583 |
| L9 | 8.617 | 8.583 | 8.583 |
| L10 | 8.617 | 8.583 | 8.583 |

[Restored standing fixture receipt](evidence/standing-restored.json).

## Causes and shared-rule corrections

- **Confirmed wound regression:** R14 moving ordinary lunges used a 0.1 damage fraction in L1–5 and extra two-second recovery. L7 then used 0.2 and finally 0.15 fractions, and its completed escort bite fell from 34 to 5 HP. Accepted runner contacts now deal the shared 10 HP, moving or stationary; human completed bites use 34 HP. The 1.6 m prediction bound remains. Lunges approach through their warning/burst and must reach the live body.
- Removed ordinary per-level damage multipliers (L2 1.8, L3/L4 1.1, L5 1.25), opening wound discounts/grace, extra chase-speed boosts, L3 speed cap/range overrides, L2 melee toughness, and L4 regular-only allied resistance. L6 now spawns the actual catalog role instead of borrowing another role's HP/radius/speed. Riot shield response is shared. L10 initializes the same seeded ordinary-human brain as the other native campaign levels; its previous generic runner speed was 4.2 m/s.
- Removed shotgun permanence in L5–10, L4 ordinary-weapon permanence on rioters, L2 recovering-pool destruction, level-specific recovery delays and mission repeat-down corpse shortcuts. Ordinary gun/melee downs retain identity and recover after the same seeded 10–20 s at full HP; get-up takes 1.3 s. Strict caps reserve the body's slot. Nurses may accelerate a recoverable down, but cannot resurrect explosive/fire permanent kills. Mounted minigun bullets also down ordinary infected normally.
- The height guard remains at a shared 0.9 m support-level difference: small kerbs/steps fit, separate floors do not. No evidence justified removing floor checks. The R19 contact/cover systems remain in place; accepted moving-hit, contact-family and navigation contracts pass. Down/recovery updates occur before distant-actor culling, and the actual native recovery audit passes L1–L10.
- Authored boss mechanics remain explicit exceptions: L7's five Alphas retain 450 HP; zoo bosses, the Mega Alpha and cure sequence retain their story rules. L1's PROD weapon damage remains a weapon rule. No ordinary zombie stat is weakened for escort survival.

## Rockets and the empty street

**Rockets already killed permanently in PROD.** Damage 180, radius 6 m, falloff 0.6 and projectile speed 18 m/s are unchanged. Fire rate fell from 2.4/s to 1.2/s; the 5 m discharge restriction rejects close shots. Neither change increases explosion damage or radius. PROD did also have a late-level shotgun permanence exception; the current binding PO gun-rise rule supersedes it, so it is removed.

| Seed 1 | PROD shots / permanent rocket kills | Main shots / permanent rocket kills | Restored shots / permanent rocket kills |
|---|---:|---:|---:|
| low | 74 / 203 | 43 / 150 | 33 / 162 |
| high | 75 / 403 | 43 / 310 | 36 / 215 |

The measured main route leaves **fewer**, not more, permanent rocket kills than PROD. A street of rocket corpses remaining down is expected. The correction uses staggered arrivals and multiple approach directions, preserving 200/400 ordinary infected and five strong Alphas over L7's authored encounter plan. [PROD receipts](evidence/l7-batch59/), [main receipts](evidence/l7-before/).

## L7 final seed/tier outcomes

The column follows its walked route behind the courier, including during street combat. Four catalog rifle soldiers follow; two pairs cover the road junction and boarding approach. Soldiers rescue active escort grabs and immediate courier/self-defence threats before returning to Alphas. Four standard medkits sit on the route. Spawns obey normal safe/offscreen admission, physical clearance and the existing cap. No soldier/escort invulnerability or zombie damage discount is added.

| Tier | Seed | Courier / deaths | Time s | Boarded / 24 | Courier HP lost | Alpha landed hits / HP to humans | Escort grabs | Longest quiet s |
|---|---:|---|---:|---:|---:|---:|---:|---:|
| low | 1 | complete / 0 | 103.78 | 24 | 100 | 21 / 650 | 2 | 17.28 |
| low | 2 | complete / 0 | 108.92 | 24 | 40 | 11 / 390 | 3 | 19.53 |
| low | 3 | complete / 0 | 124.02 | 24 | 60 | 6 / 210 | 5 | 17.95 |
| high | 1 | complete / 0 | 107.10 | 23 | 80 | 14 / 350 | 35 | 17.55 |
| high | 2 | complete / 0 | 120.02 | 21 | 185 | 24 / 605 | 53 | 19.15 |
| high | 3 | complete / 0 | 112.78 | 24 | 90 | 8 / 310 | 26 | 16.68 |

All six cases pass completion, zero courier deaths, majority boarding, ≤30 s quiet time, at least three simultaneous threat sectors, actual landed Alpha damage and five admitted 450 HP Alphas. Actual attack starts span multiple compass directions; seed 2 low has three directions, the other five cases have four. Recoveries occur during these real routes (28–73 per run), alongside permanent rocket kills. Full receipts and compressed traces are in [p1-design14](evidence/p1-design14/); all failed and successful design iterations are listed in [layout trials](evidence/l7-layout-trials.csv). Queued job labels are not immutable revisions: use the source hash to distinguish/deduplicate snapshots.

### Pacing timeline before / after

Fight beats are accepted positive combat hits within 30 m of the courier, displayed at most once per 10 s; every actual hit contributes to quiet-gap measurement. Radio and weapon pickup are also beats. Objective/checkpoint bookkeeping and attack starts are not used to fill gaps. This is simulation evidence, not visual/browser approval. The before sample already meets the 30 s threshold; the complaint is not represented as a fabricated failing baseline.

| Seed 1 | Main fight-beat times s | Restored fight-beat times s | Quiet max before → after |
|---|---|---|---|
| low | 0.1, 10.6, 27.2, 40.4, 63.8, 85.0, 95.1, 107.6 | 0.0, 15.5, 28.8, 50.6, 74.0, 84.2, 94.5 | 18.37 → 17.28 |
| high | 0.1, 10.6, 20.6, 35.6, 46.0, 56.5, 77.0, 87.0, 100.7, 111.0 | 0.0, 15.5, 28.8, 50.8, 75.8, 85.9, 96.0 | 16.23 → 17.55 |

Both routes begin with the start radio at 0 s and rocket pickup at 0.23 s. Revised extraction completes at 103.78 s low / 107.10 s high; before was 128.67 / 132.88 s. The timeline is compressed for readability; full beat details, quiet interval endpoints, one-second actor/health/position samples, landed wounds and grabs remain in the receipts/traces.

### Neglect and mortality proof

With the courier's attacks suppressed but soldier cover active, the explicitly **courier-protected observer** loses 22/24 low-tier escorts and 24/24 high-tier escorts within 120 s; neither boards anyone. There are 196/151 grabs and minimum escort HP reaches zero. Courier protection only keeps this observation alive: its zero courier damage/deaths are not survivability evidence. The isolated unopposed bite contract also requires 100 → 66 → 32 → death on the third completed bite. [Neglect receipts](evidence/p1-neglect-final/).

## Remaining acceptance work

The goal is not met. The strict L1–L6 band still fails for L1 skilled/passive, L2 skilled/passive, L3 skilled, L4 passive and L6 passive. The low results are L2 passive (−19.5%) and L4 passive (−17.3%); the other failures are above the band. The requested PO clarification about the upper bound versus minimum-PROD pressure has not been answered. It would not by itself clear the two below-band cases.

Rejected experiments are retained in [trial receipts](evidence/rejected-trials/): increasing L2's bridge cluster and advancing one ambush approach reduced passive pressure; faster L4 waves also reduced pressure. Those changes are absent from the final source. L6's added Alpha/butcher fronts were unnecessary once the matched-policy baseline was available; the final change retains the original two-member hatch quotas and spreads their positions.

Further acceptance work needs encounter/route balancing with shared zombie stats, plus a decision on the strict upper band. Standing TTK here is a controlled shared-runner fixture, not a native encounter/phase TTK audit. The report does not claim browser appearance or GPU performance approval.

## Validation and reproduction

- `npm run verify -- E07` runs the repository's current per-change gate: typecheck, lint and `npm test` (`test:unit` alias). The full gate passed (106 tests passed, one skipped); [command receipts](evidence/final-gate/checks.json). No browser or performance approval is claimed.
- Native initialized-world shotgun recovery: **10/10 levels pass**, full HP and same entity identity. [Recovery receipt](evidence/recovery/native.json). The focused engine contract also covers recoverable melee/gun downs, >12 simultaneous downed bodies, shared timers, and permanent explosives in all ten level flags.
- The report builder asserts the six L7 outcome/pacing/direction/Alpha gates and all ten native recovery results before writing this report. Route parity remains separately red.

```sh
python3 tools/qa/p1-danger-snapshots.py
MI_LOCAL_FALLBACK=0 sh tools/remote/run.sh "$PWD" --pull test-results/p1-danger/batch59 -- sh tools/qa/p1-danger-run.sh batch59
MI_LOCAL_FALLBACK=0 sh tools/remote/run.sh "$PWD" --pull test-results/p1-danger/main -- sh tools/qa/p1-danger-run.sh main
MI_LOCAL_FALLBACK=0 sh tools/remote/run.sh "$PWD" --pull test-results/p1-danger/stable -- sh tools/qa/p1-danger-run.sh stable
MI_LOCAL_FALLBACK=0 sh tools/remote/run.sh "$PWD" --pull test-results/r17-l7diff -- node --import tsx/esm tools/qa/r17-l7diff.ts p1-design14 both 1,2,3
MI_LOCAL_FALLBACK=0 sh tools/remote/run.sh "$PWD" --pull test-results/p1-danger/recovery -- node --import tsx/esm tools/qa/p1-danger-recovery.ts
MI_LOCAL_FALLBACK=0 sh tools/remote/run.sh "$PWD" --pull test-results/epics/E07 -- bash tools/remote/timing-isolated.sh --all sh tools/qa/p1-danger-verify.sh
python3 tools/qa/p1-danger-report.py
```

The synthetic Git commit in the remote verify wrapper contains the actual review source tree and exists only in the disposable runner job, for freshness checks. Historical archives stay uncommitted; the snapshot script recreates them. Source hashes and raw receipt hashes are preserved in evidence. The first historical L7 main receipt has an empty Git-file-list source hash; its archived revision and archive SHA identify that build, and the original receipt is preserved unchanged. Specs and main were not edited.
