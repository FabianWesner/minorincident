# R12 natural group movement

**Status: BLOCKED / NOT merged-ready. Final source `601d18df` is verified natively; L8 adds no human slow-follower rows. L7 required pace coverage remains unqualified and prevents acceptance.**

PO: “Group dynamic in general is strange... They move too parallel...”

## Change and integration

Survivors use deterministic loose slots, independent route-safe lateral sway, staggered starts after resting, and individual ordinary movement response. Settled followers look toward visible threats, the courier, neighbors, or a personal glance. L5 retains its brisk response and authored follow band. Checkpoint restore rebases the new rest/reaction timers; threat glances respect line of sight.

Requested main `08149d1a` was merged as `d11dea91`. R12 variation and R13's L7 companion response share the response selector; R13's distinct bus queue rows and L8 catch-up/boarding remain present. Main `78219de9`, including the current L8 story and Alpha changes, was subsequently merged as `aaa66a18`. First-comparison runtime source hash: `10b2cc9caaf5de60ac81e25bd1006529ec6e6a924168cd8057b8f0f67a1392f1`. Read-only hashing inside that remote job confirms this runtime hash, the observer hash, and the audit-tool hash match the local files ([lane fingerprint](remote-runtime.json)). The clean-main comparison job has its own verified source hash and the identical observer/audit hashes ([main fingerprint](remote-main-runtime.json)).

## Native motion

`node --import tsx/esm tools/qa/r12-group-probe.ts <level> <tier> 1 current-human` uses ordinary native complete inputs. Human-only metrics exclude the corgi's different gait. L2 measures its six scripted firefighters; its only ordinary player follower is the corgi. L3 measures the police. All receipts retain source, observer and tool hashes in [native-metrics.json](native-metrics.json).

NN CV is nearest-neighbor spacing variation, including ground height. Facing R is moving direction concentration (1 means identical directions). Rails counts continuous two-second windows whose lateral offset changes by less than 10 cm. These are descriptive measurements, not invented visual acceptance thresholds. Travel direction remains broadly aligned with the shared destination.

| Level / tier | Native outcome | Max humans / samples | NN CV | Facing R | Rails |
| --- | --- | ---: | ---: | ---: | ---: |
| L2 / low | complete | 6 / 170 | 0.553 | 0.679 | — |
| L2 / high | complete | 6 / 170 | 0.537 | 0.747 | — |
| L3 / low | complete | 4 / 622 | 0.097 | 0.951 | 12.5% |
| L3 / high | complete | 4 / 440 | 0.187 | 0.949 | 12.1% |
| L5 / low | complete | 5 / 369 | 0.167 | 0.965 | 4.3% |
| L5 / high | complete | 5 / 454 | 0.165 | 0.947 | 6.1% |
| L6 / low | complete | 24 / 2921 | 0.239 | 0.984 | 6.0% |
| L6 / high | complete | 24 / 2921 | 0.239 | 0.984 | 6.0% |
| L7 / low | mission-failed | 24 / 172 | 0.245 | 0.998 | 9.7% |
| L7 / high | tick-budget | 24 / 4800 | 0.253 | 0.997 | 9.0% |
| L8 / low | tick-budget | 13 / 3010 | 0.213 | 0.883 | 3.7% |
| L8 / high | tick-budget | 13 / 710 | 0.230 | 0.948 | 6.3% |

Same probe on clean `78219de9`, low quality, seed 1 ([main receipts](main-metrics.json)):

| Level | Main rails | R12 rails |
| --- | ---: | ---: |
| L5 | 22.5% | 4.3% |
| L6 | 31.2% | 6.0% |
| L7 | 93.9% | 9.7% |
| L8 | 42.5% | 3.7% |

The L7 samples stop early on the failed low route; they are not a full departure-route proof. L7 high reaches the simulation limit while clean main dies at 73.5 s. In this first-comparison sample, L8 exhausts its native budget on both snapshots and both tiers. Corrected-source outcomes are recorded below. These completion failures remain visible; they do not establish a clean campaign gate. A separate ordinary-input, final-state-only L8 observation at 300 s found all current living passengers seated while the escape story remained active ([observation](l8-route-observation.json)). That observation does not replace the follower audit.

## Queue integration and unit gates

`node --import tsx/esm tools/qa/r12-group-boarding.ts` explicitly sets up quiet queue approaches, then runs ordinary follower, collision and transport controllers. No passenger is pre-seated. These fixtures isolate steering/boarding from the upstream mortal route; they do not prove campaign completion.

| Fixture, both tiers | R12 | Clean main | Physical result |
| --- | --- | --- | --- |
| L7 | 24/24 in 8.17 s | 24/24 in 8.18 s | Courier boards last; zero assists/recoveries; maximum visible step < 0.089 m/tick. |
| L8 | 13/13 in 20.85 s | 13/13 in 21.38 s | Every passenger walks to a seat; courier stays on foot; maximum visible step < 0.165 m/tick. |

[Boarding receipts and comparison](boarding.json). Both fixtures report zero collision invariant failures.

`npm run verify -- E08` passes: typecheck, lint, **107 tests / 27 files** ([checks](checks.json)). The current verifier runs those native gates without launching a browser. Regressions cover all 48 slots' clearance, preserved remaining reaction time across checkpoint clock rebasing, and occluded-threat idle glances. Updated QA tools also pass typecheck and ESLint.

## Native follower audit

The requested full `sh tools/remote/run.sh "$PWD" -- npm run qa:threat` ran on the merged source and stopped at **600.8 s**, child exit 124, before aggregate receipts were written ([timeout receipt](standard-audit-timeout.json)). Existing local `test-results/qa-threat/audit.json` belongs to old revision `8f83d2eb` and is explicitly excluded from current evidence.

The first dedicated remote batch covered **all six requested levels: L2, L3, L5, L6, L7, L8**, using the same evaluator, native policies, pace seeds and thresholds, with 1200 s of wall time for observation. The first clean-main six-level comparison also timed out at 600.7 s before aggregation ([receipt](main-audit-timeout.json)); its replacement has the same 1200 s allowance and covers those same six levels. Both completed; the comparison is summarized below. Historical batch logs: `test-results/r12-group/focused-threat.log` and `current-main-focused.log`. The original clean-main timeout log is `current-main-threat.log`. No gameplay criterion or checked-in timing budget was changed.

Browser QA needed

No browser, push or deployment was used for this verification.

## Completed first comparison

Both extended audits completed: lane 1041.8 s, main 543.3 s. [Full follower comparison before correction](follower-comparison-before.json) retains all relevant flags, waiting rows, pace votes and phase medians. L2/L3 are unchanged; L5 has no pace flags; L6 loses its five exit slow-follower flags but its waiting share rises (absolute stationary-far time falls from 535.85 s to 516.52 s). L7 retains main's required-ID coverage failures because all three mortal seeds fail; those missing votes are not counted as passing. L8 adds slow-follower flags and requires correction. Earlier timing/gate receipts remain historical evidence for their recorded source.

## Response correction

`ff834fdc` preserves the exact authored response for mission catch-up/boarding and uses the existing follower response throughout L8's moving loose formation. Ordinary following elsewhere retains personal acceleration; loose slots, sway, staggered starts and idle glances remain. A regression check exercises injured and uninjured followers under urgent L8, ordinary L8 and ordinary L6 response.

The corrected quiet fixtures seat all 24 L7 followers in 8.18 s and all 13 L8 passengers in 21.38 s, in both tiers, with zero collision invariant failures, no assists/recoveries, and maximum visible steps below 0.091 m/tick (L7) / 0.165 m/tick (L8). [Corrected boarding receipts](fixed-boarding.json).

The corrected source also passes typecheck, lint and all **107 tests / 27 files** ([corrected checks](fixed-checks.json)).

Final six-level comparison uses unchanged evaluator/policies/thresholds and the same 1200 s observational wall allowance. Source hash `6b2594804f64d3b297636a55b0115dd610e3a1b77c2a8da024ac52899be505ed` is independently confirmed inside its remote job ([fingerprint](remote-fixed-runtime.json)). Baseline remains clean `78219de9`; no observer or threshold was changed.

### Corrected motion samples

L2/L3/L5/L6 response paths are unchanged by `ff834fdc`; the preceding six-level receipts remain their motion evidence. Rerun L7/L8 rows use the corrected source ([receipts](fixed-native-metrics.json)):

| Level / tier | Outcome | NN CV | Facing R | Rails |
| --- | --- | ---: | ---: | ---: |
| L7 / high | mission-failed | 0.465 | 0.997 | 9.1% |
| L7 / low | mission-failed | 0.247 | 0.965 | 6.6% |
| L8 / high | tick-budget | 0.308 | 0.963 | 5.9% |
| L8 / low | complete | 0.331 | 0.943 | 5.4% |

L8 low now completes at 213.6 s. L8 high still exhausts its route budget; L7 still fails both mortal routes. Motion samples on incomplete routes do not qualify missing pace votes.

## Completed corrected-source audit (`ff834fdc`)

The final six-level remote audit completed in **487.1 s**, exited 1 with **8 top-level flags**, and retained the diagnostic `PARTIAL_LEVEL_SELECTION` flag. [Full follower comparison](follower-comparison-fixed.json) includes every raw follower phase, waiting row, pace vote, seed validity and input audit SHA256. The source/evaluator fingerprint is linked above. This is not a passing complete threat gate.

| Level | Corrected source versus clean main |
| --- | --- |
| L2 | Same follower flags and waiting (0%). |
| L3 police | Same follower flags and waiting (1.21%). |
| L5 | No pace failures; skilled waiting falls from 0.62% to 0%. |
| L6 | Removes five exit slow-follower IDs (16/20/23/30/42). Waiting share rises 53.70% → 70.72%, while stationary-far time falls 535.85 → 516.52 s and the route completes sooner. |
| L7 | Waiting improves 16.06% → 4.92%, removing the >10% flag. All three skilled seeds still fail; required IDs 60/63 remain unobserved under the unchanged validity rule. New departure-only raw samples cannot be compared to main's absent phase. |
| L8 | Completes at 213.63 s; required-ID pace flags match main (354). Raw breached/escape rows add slow IDs 355/361 (main already flags 354/356). Skilled waiting rises 1.86% → 9.44% (1.80 → 11.33 stationary-far seconds). |

Remaining top-level flags are L3 competent rate, L6/L7 kiting rate, L7 required-ID coverage (60/63), L8 late first attack and slow companion 354, plus partial selection. L6 entry-wave count mismatches and changed L8 outlet/attack flags remain in the full raw phase comparison even when they are not top-level failures.

**Acceptance remains unresolved:** L7 needs a native route that completes and qualifies the required pace votes. Shared main failure is not passing evidence. L8's additional raw slow rows and increased stationary time also prevent a broad no-lag-regression claim. Quiet boarding passes cannot substitute for those mortal-route checks. No criteria, validity rules or follower IDs were relaxed.

### Rejected follow-up trials and handoff

Two local diagnostics tested a smaller L8 sway amplitude and suppressing sway while an ally attacks/tracks an enemy. Both added required-ID pace failures; combat-only sway also exceeded the 10% skilled waiting bound. Both changes were reverted. [Diagnostic summaries](rejected-trials.json) are explicitly not full threat audits. Final runtime remains the fully audited `ff834fdc` source; later commits contain reports only.

At the `ff834fdc` stage, required follow-up was to provide/fix a complete ordinary-input L7 native route that preserves current seed qualification, then rerun required follower votes. Resolve L8 raw slow IDs 355/361 and stationary-far increase before claiming broad no-regression acceptance. The current implementation and receipts are committed for review, but the goal **Natural group movement merged-ready** is not achieved. No browser QA, push or deploy was performed.

## Nearby evacuation pacing (`601d18df`)

A read-only trace of the qualified L8 samples found no recorded body blocker or slowing status for IDs 355/361. Their low-speed samples matched the courier's speed (median ratio ≈1.0), while their median courier distances improved against clean main: 355 from 4.42 m to 3.17 m; 361 from 6.77 m to 5.81 m. [Trace comparison](l8-pace-trace-comparison.json). This explains the investigation direction; it does not waive the every-follower group-median rule.

`601d18df` gives followers within 10 m of a moving courier the same modest 1.05× pace headroom used by calm L5 travel. R13's distant catch-up and boarding approach retain their existing limits. Loose slots, sway and individual starts remain. In the local diagnostic, L8 completes in 314.1 s, skilled waiting is 7.19%, and the only raw slow follower is main's existing companion 354. Final six-level verification is recorded below; the remote runtime is independently hashed in [this receipt](remote-paced-runtime.json).

The paced source passes typecheck, lint and all **107 tests / 27 files** ([checks](paced-checks.json)). Its [quiet boarding receipts](paced-boarding.json) remain unchanged: L7 24/24 in 8.18 s, L8 13/13 in 21.38 s, both tiers, zero collision failures.

[Paced L8 motion receipts](paced-native-metrics.json): low completes at 314.1 s; high reaches its route budget at 190.9 s. NN CV is 0.324/0.277, moving facing R 0.950/0.931, and rails 6.4%/6.1%. The low route includes three player deaths/retries; completion time is not a deathless-run claim. These are ordinary input runs, not quiet-fixture outcomes. L2/L3/L5/L6 and L7 are unchanged by the final L8-only cap.

## Final result and remaining blocker

The `601d18df` six-level remote audit completed in **756.2 s** (764.3 s including the budget wrapper), exited 1, and retained **8 top-level flags**. [Final comparison against clean main](follower-comparison-paced.json) includes all follower rows, waits, seed validity and raw audit hashes. No evaluator, validity rule or threshold changed.

- **L8 correction verified:** complete at 314.1 s; skilled waiting 7.19%; raw escape/breached slow rows contain only companion 354, already failing on main. New human slow rows 355/361 are removed. Passive adds no raw slow rows. Boarding and natural spacing/heading variation remain verified by the linked receipts.
- **L7 remains unqualified:** skilled waiting improves to 4.92%, but all three mortal seeds fail, so required IDs 60/63 have no valid pace votes. Departure samples additionally flag IDs 51/52/58/60/67/69/71; main never reaches that phase, so these cannot establish no regression. Quiet 24/24 boarding is not a substitute for qualified mortal-route coverage. The bus reaches HP 0 on both main and lane ([route blocker](l7-route-blocker.json)).
- L2/L3 follower rows remain unchanged; L5 has no pace failures; L6 removes the five exit slow IDs, with both its increased waiting share and reduced absolute stationary-far time retained above. Other inherited threat/kiting flags remain in the complete comparison.

The two-hour work box is exhausted. **BLOCKED:** a complete native L7 route or upstream bus/route fix is needed, followed by qualified follower verification. The goal is not marked achieved. The final runtime, comparisons and reports are committed; no browser, push or deploy was used.

Browser QA needed
