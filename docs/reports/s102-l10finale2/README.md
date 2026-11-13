# s102 L10 finale investigation

Goal not achieved. Browser QA needed.

The reservation-aware wake candidate leaves all six exact native receipts at baseline gaps and deaths; see wake-trial.json. HIGH s2/s3 and LOW s1 still fail. A 15 s wave interval was tested on those three cases and reverted: gaps were 47.33, 46.48 and 47.32 s respectively, with baseline deaths.

HIGH seed 3 occupancy evidence in occupancy.json shows director count 22/22 throughout the finale, reserved=0 and pendingTurns=0. Ten living pressure sprinters wander 80–188 m from the player; recoverable bodies retain the remaining capacity. Thus reservation-aware wake admission alone cannot free authored assault slots. No stats, policy, thresholds, duration or corpses changed. The next candidate must preserve distant actor identities while making capacity available for the authored finale.

Current source candidate: wake admission honors reserved slots and pending turns. It is uncommitted and not yet accepted. Final journey cadence, threat audit, typecheck, lint and remote unit suite remain open.

## Distant hunter redirect trial

Reassigning living, unauthored, distant idle/wandering/attracted sprinters toward the authored platform stair once per second improves HIGH seed 3 from 46.48 s to 31.17 s max gap, with two deaths and route completion unchanged. Tail is 1.25 s; the remaining 31.17 s gap is between ticks 59722 and 61592. Exact receipt: redirect-trial.json. This candidate is retained for further work and does not yet meet acceptance.

## Six-case redirect rejection

The full matrix rejects the redirect candidate. It was reverted, together with the wake-only candidate which did not improve any exact baseline receipt. No runtime change is retained.

| Tier | Seed | Before max gap s | Redirect max gap s | Before deaths | Redirect deaths | Completes |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| HIGH | 1 | 16.72 | 37.92 | 3 | 3 | yes |
| HIGH | 2 | 42.17 | 24.63 | 3 | 4 | yes |
| HIGH | 3 | 46.48 | 31.17 | 2 | 2 | yes |
| LOW | 1 | 42.12 | 40.58 | 0 | 0 | yes |
| LOW | 2 | 16.80 | 23.68 | 2 | 0 | yes |
| LOW | 3 | 18.60 | 18.60 | 2 | 2 | yes |

Only LOW seed 3 passes the redirect matrix. Exact receipts: redirect-six.json. The candidate changes finale timing and contact enough to regress baseline passing cases. The goal remains unachieved. No browser, deployment, push or main movement occurred.

After reverting gameplay trials, `npm run typecheck` and `npm run lint` passed. Journey cadence, final threat audit and remote unit suite are still open; no acceptable gameplay candidate exists.

## Four reserved assault slots

A persistent four-slot reservation with capacity-aware sleep/wake passes HIGH s2/s3 (18.87/15.50 s, deaths 3/3), but fails HIGH s1 (136.62 s, 11 deaths) and all LOW cases (38.32/34.37/40.72 s). Exact receipt: reserved-four-six.json. Capacity retirement in this trial selects living actors only; downed bodies are not retired for reservation space. The persistent reservation can repeatedly displace arrivals and is rejected. The current uncommitted revision consumes reservation credit as authored actors are admitted; that revision has not been measured yet.

## Consumed reservation credit

Four admission credits, consumed as authored assault slots are admitted, pass HIGH s1/s3 and LOW s2/s3. HIGH s2 narrowly fails at 20.58 s; LOW s1 remains 42.12 s. All six complete, deaths are 2/3/2 and 0/2/2 (all at or below baseline). Exact matrix: consumed-four-six.json. Raising the credits to six leaves LOW s1 identical at 42.12 s and zero deaths; four credits were restored. The current source remains an unaccepted candidate pending the two remaining cadence failures and full verification.

## LOW s1 wave blocker

A native occupancy trace shows authored actors admit successfully. After the main group falls, its surviving dog wanders 40–54 m west and postpones subsequent waves despite no attack contact. Direction-independent authored refresh alone leaves the receipt unchanged and was reverted. The next unmeasured candidate lets the wave breather finish when survivors are idle/wandering outside the authored hold disc, preserving the actors themselves.

## Breather and combined cadence trials

Ignoring idle/wandering survivors outside the hold disc does not change LOW s1 (42.12 s) or HIGH s2 (20.58 s). Adding a 15 s period worsens LOW s1 to 43.58 s and leaves HIGH s2 unchanged; deaths remain 0/3 and routes complete. The 30 s period is restored. Exact receipts: breather-trials.json. Current unmeasured revision renews four consumable admission credits per authored wave, rather than protecting only the first wave.

## Renewed and periodic wave trials

Renewed four-credit waves retain LOW s1's 42.12 s failure and produce 20.88 s on HIGH s2, with baseline deaths. Removing survivor-driven postponement and using 20 s waves improves LOW s1 to 26.55 s (tail), zero deaths, route complete. A 15 s period regresses it to 42.63 s. The 20 s candidate is restored for further investigation; it has not passed acceptance. Exact receipts: renew-periodic-trials.json.

## Approach and extra capacity

Closer radial approaches worsen LOW s1 to 40.55 s and were reverted. Four additional assault resident slots (LOW 18/HIGH 26) with 20 s waves yield LOW s1 25.27 s, zero deaths and completion. An 18 s period gives 25.65 s and was reverted. The 20 s/extra-capacity candidate remains unaccepted and has not been measured on the other five cases. Exact receipts: approach-cap-trials.json. No actor/weapon statistics changed.

## Roster and third-wave capacity rejection

Runner-only regular assault slots produce LOW s1 26.65 s, zero deaths, completion; original roster restored. Increasing assault capacity to LOW 26/HIGH 34 produces LOW s1 42.15 s, zero deaths, completion; LOW 18/HIGH 26 restored. These reject speed mix and raw capacity as sufficient fixes. Exact receipts: roster-cap-trials.json. Further work needs an admission trace of later waves before another scheduling change.

## Later-wave contact trace and eastern approaches

The later-wave trace proves wave 2 admits four actors. Two are down before tick 55800, the runner/firefighter survivors die before attack contact. The remaining cadence failure is not simply absent admission. Stair-side eastern approaches improve LOW s1 to a 22.35 s tail (zero deaths, complete). Moving the ring four metres closer gives 23.83 s and was reverted. The eastern 48 m approach candidate is retained unaccepted. Exact receipts: east-trials.json; native actor trace: later-wave-trace.json.

## Full eastern candidate rejection

The 20 s/eastern-entry/extra-capacity candidate fails all six cases: HIGH gaps 100.48/41.25/22.42 s, LOW gaps 22.35/41.25 s and seed 3 does not complete. Deaths 3/3/3 and 0/0/1. Exact receipts: east-six.json. This candidate was reverted to the earlier consumed-four candidate (four known passing cases, HIGH s2 and LOW s1 still failing). No accepted gameplay fix or final verification exists.

## Stair-top gun and armored approach rejection

Putting the gun at the existing stair-top coordinate yields LOW s1 46.97 s, zero deaths, completion; restored original gun anchor. Replacing the first three regular assault slots with globally unchanged armored actors yields 38.07 s, zero deaths, completion; restored original roster. Neither closes the quiet window. Exact receipts: stair-armored-trials.json. Current source remains the earlier four-credit candidate.

## Extra credit and spaced admission rejection

Five credits regress HIGH s2 to 41.80 s (three deaths). One-second assault admission spacing yields LOW s1 43.47 s (zero deaths), HIGH s2 39.23 s (three deaths). All complete. Both experiments were reverted to the four-credit candidate. Exact receipts: credit-spacing-trials.json.

## Thrower diagnosis

Replacing one regular with a thrower yields LOW s1 22.63 s, zero deaths, completion. Source trace proves no thrower attacks; the dog supplies the late start. The thrower remains idle/wandering. Inspection finds `InfectedSystem.press` excludes L10 from persistent non-pedestrian pressure targets. Current unmeasured candidate adds L10 to that existing mechanism. Trace: thrower-trace.json. No ranged-resource success is claimed.

## Persistent-target measurement

Adding L10 to non-pedestrian persistent pressure targets changes neither thrower LOW s1 (22.63 s) nor original-roster LOW s1 (42.12 s). Both complete with zero deaths. The targeting change and thrower composition are reverted; source remains the consumed-four candidate. Thus the omitted L10 assignment was not established as the causal defect. Exact receipts: persistent-target-trials.json.

## Finale pursuit dropout rejection

The native archetype brain explicitly drops an L10 authored hunter behind hearing range into wandering. Restricting that rule to pre-installation travel and refreshing finale actors from either direction regresses LOW s1 to 47.28 s, zero deaths, complete. Both changes reverted. This disproves pursuit dropout removal as a sufficient cadence fix. Exact receipt: dropout-trial.json.

## Retained-candidate threat audit

`node --import tsx/esm tools/qa/threat-audit.ts --levels L10 --maxWorkers 2 --out /private/tmp/s102-current-threat` produced:

```
[qa:threat] L10: skilled complete, passive tick-budget, 0 passive flags (34.6s)
```

The exit 1 is the diagnostic partial-level selection flag, not an L10 failure. Native retreat kiting records 3.00 landed hits/min and passes its floor. Raw receipt: current-threat.json. This does not prove the strict six-case finale cadence goal; HIGH s2 and LOW s1 still fail.

Current candidate `npm run typecheck` and `npm run lint` both passed after the threat audit. The remote unit suite and journey cadence receipt remain open. This checkpoint is WIP, not acceptance.

## Remote unit suite on WIP checkpoint d121a6fe

`sh tools/remote/run.sh "$PWD" -- npm test` passed unchanged on runner 46.225.66.90, job `s102-l10finale2-b1bfd2-18448-1794602852`. Manifest: 150/150 cases (129 Vitest, 9 e2e, 12 invariants-browser). Default suite: 27 files passed, 106 tests passed, one skipped; Vitest 225.58 s, budgeted command 228.2 s / 240 s. Exit 0; no retries or trimming. This validates the current shared residency candidate's covered contracts, not the still-failing finale gap requirement. No check remains running.

## Routed leaper trial

One leaper replacing one regular actor with a scripted stair approach yields LOW s1 22.63 s, zero deaths, complete. The result is identical to the thrower composition trial. Inspection finds gunfire cancels scripted approaches and replaces them with shot-position investigation. Current unmeasured revision preserves the installed-finale routed approach when the courier is the noise source. No attack-resource success or acceptance is claimed.

## Preserved routed leaper matrix

Preserving the scripted approach from courier gunfire passes LOW s1 at 17.52 s, zero deaths. Full matrix passes HIGH s1/s3 and LOW s1/s3; HIGH s2 remains 20.58 s and LOW s2 regresses to 33.17 s. All six complete; deaths 2/3/2 and 0/0/2. Exact receipts: preserved-route-six.json. Current unmeasured revision prioritizes the Alpha slot in admission order so its approach starts before regular actors consume protected capacity. This is not accepted.

## Alpha admission order and three-credit rejection

Alpha-first admission fails HIGH s2 at 45.93 s (three deaths) and LOW s2 at 33.18 s (zero deaths); order restored. Retaining the original regular count plus one leaper with three credits gives 33.13/36.68 s and deaths 3/0. All routes complete. Four credits are restored. Current unmeasured composition keeps all original regulars plus the routed leaper; prior matrix replaced one regular. Exact receipts: alpha-order-credit-trials.json.

## Full-roster routed leaper and fixed waves

Full original regular roster plus one leaper with four credits yields HIGH s2 20.58 s (three deaths), LOW s2 36.68 s (zero deaths). Fixed 20 s waves improve LOW s2 to 23.30 s; HIGH s2 stays unchanged. All complete. Current unmeasured revision holds one separate Alpha admission credit until the first authored Alpha enters. Exact receipts: full-roster-leaper-trials.json.

## Separate Alpha credit

Holding one extra reservation until Alpha admission passes HIGH s2: 17.05 s, four deaths (baseline three), route complete. LOW s2 stays 23.30 s with zero deaths. Periods 22/18 s regress LOW s2 to 34.40/34.02 s; restored 20 s. Exact receipts: alpha-credit-period-trials.json. Current candidate still needs LOW s2 and the full six-case matrix; total death budget unproven.

## Full separate-credit candidate rejection

The full six-case matrix rejects the routed extra leaper / separate Alpha credit / 20 s wave combination. HIGH gaps: 26.82/17.05 s, seed 3 timeout with 23 deaths. LOW gaps: 49.90/23.30 s, seed 3 timeout with one death. HIGH deaths 4/4/23, LOW 0/0/1. Exact receipts: alpha-credit-six.json. All gameplay edits since checkpoint d121a6fe were reverted to that earlier four-credit candidate, which has four known passing cases and HIGH s2/LOW s1 still failing. The single-case successes are not an accepted solution.

## Journey cadence receipt on restored checkpoint

`S89_OUT=/private/tmp/s102-current-cadence.json node --import tsx/esm tools/qa/s89-l10gap.ts` exits 0, passed=true, flags=[]. All six native routes complete, zero cap violations, and every adjusted adjacent-start gap is <=45 s. Exact receipt: current-cadence.json. This covers the requested journey gate; it does not replace the failing finale head/tail requirement.
