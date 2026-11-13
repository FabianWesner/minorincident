# s101-l10finale — incomplete investigation

**FAIL / goal not achieved. Browser QA needed.** Time box reached; unsuccessful gameplay experiments were reverted. This commit contains investigation evidence only.

Native complete-policy baseline runs for HIGH and LOW seeds 1–3 completed. Their route/death summaries are in [investigation.json](investigation.json). The original s100 HIGH seed 3 receipt remains the authoritative exact finale measurement: 65.70 s, three attack starts, 15.68 s head and 46.48 s tail. No bot policy or observer thresholds were changed.

| HIGH seed 3 | Before | Rejected reservation trial | Rejected slower trial |
| --- | ---: | ---: | ---: |
| Route completes | yes | yes | yes |
| Player deaths | 2 | 3 | 2 |
| Attack starts in sampled finale window | 3 (exact s100 window) | 39 (sampled window) | 1 (sampled window) |
| Acceptance | FAIL tail | FAIL extra death and long gap | FAIL long tail |

Sampled windows use the existing s93 trace's 300-tick samples and are diagnostic, not exact installation/release receipts. Do not interpret them as passing finale evidence.

## Findings

HIGH's outpaced pressure sprinters remain far from the console in wander/attracted states and occupy the resident budget. Dormant actors also wake into newly available capacity. `ChunkResidency.wakeInside` checks the raw director cap without subtracting reserved slots or pending turns. Thus reservation-only experiments did not protect authored assault capacity. Making both sleep/wake admission honor reservations allowed authored assault actors to enter, confirming a capacity interaction, but eight accumulated attackers increased seed 3 deaths from two to three. Six admissions spaced eight seconds apart preserved deaths but did not sustain attack starts. Neither candidate is retained.

Other rejected trials included closer assault slots, more frequent waves, higher population caps, and retargeting pressure hunters. None proved all required constraints. No zombie or weapon stats were edited; no corpses were removed.

## Open work

Find a director/layout solution that sustains contact without the additional death. Validate exact finale head/inter-start/tail gaps for all six native routes, route completion and baseline death counts, and the journey adjacent-gap ≤45 s gate. Run the L10 threat audit, typecheck, lint and the unchanged remote unit suite. These final checks were not run because no acceptable gameplay candidate was established. No browser, deployment, push or main movement occurred.

## Exact six-case baseline

`tools/qa/s101-finale.ts` now captures the first observed native installed/released tick and uses the unchanged shared attack-start observer. [before.json](before.json) contains every attack-start tick in each exact finale window.

| Tier | Seed | Max gap including head/tail s | Deaths | Completes |
| --- | ---: | ---: | ---: | --- |
| HIGH | 1 | 16.72 | 3 | yes |
| HIGH | 2 | 42.17 | 3 | yes |
| HIGH | 3 | 46.48 | 2 | yes |
| LOW | 1 | 42.12 | 0 | yes |
| LOW | 2 | 16.80 | 2 | yes |
| LOW | 3 | 18.60 | 2 | yes |

The failure scope is HIGH seeds 2/3 plus LOW seed 1. All six baseline routes complete. There is still no accepted gameplay change or after receipt.

## Additional geometry diagnostic

A HIGH seed 3 trial moved only the mounted gun from its 3 m platform position to the ground beside the stair (local `[6,-6]`, height 0). The native route still completed with two deaths, but its finale attacks clustered at ticks 58239, 58584, 58658, 58769 and 58806, followed by another long tail. This rejects platform elevation as a sufficient explanation; that trial was reverted. The platform's protection is documented by the threat-audit report, but lowering the gun alone does not establish sustained contact.

## Ranged encounter resource requirement

Inspection of `AlphaSupportMoves.tryStart` and `PropThrows.nearestObject` explains a weakness in the subsequent thrower diagnostics: a standard thrower cannot launch its ranged specials without a nearby throwable corpse/movable prop (`alpha.grab-throw`), light prop (`alpha.barrage`), or living victim (`alpha.living-missile`). The search radius is 2 m for direct use and 6 m for scavenging. Admitting a thrower without checking those resources does not establish a functioning ranged encounter. A future trial must provide/verify native throwable resources at its authored entry rather than infer attack capability from subtype alone. These are existing move requirements; no stat change is proposed.

## Baseline L10 threat audit

Ran `node --import tsx/esm tools/qa/threat-audit.ts --levels L10 --maxWorkers 2 --out /private/tmp/s101-baseline-threat` on the unchanged runtime. [baseline-threat.json](baseline-threat.json) retains the full receipt. The L10 skilled route completed, its passive window reached the hold tick budget, and both L10 flag lists are empty. The command exits 1 solely for `PARTIAL_LEVEL_SELECTION:diagnostic run, not a complete gate`; there is no L10-specific acceptance failure. This is baseline evidence, not final candidate verification. The audit does not replace the stricter six-case ≤20 s head/tail receipt.

## Exact northern gun placement trials

The observer accepts optional `S101_TIERS`/`S101_SEEDS` filters to run a subset without changing the native policy or measurement. Three ground-level placements were tested on HIGH seed 3; all completed with two deaths and all failed: local `[4,18]` max gap 40.80 s, `[8,16]` 46.33 s, `[12,14]` 51.08 s. [placement-trials.json](placement-trials.json) preserves exact installation/release and attack ticks. The source placement was restored after the sequential batch. The northern placement search provides no accepted gameplay change.
