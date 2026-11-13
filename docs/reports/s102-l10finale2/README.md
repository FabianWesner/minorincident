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
