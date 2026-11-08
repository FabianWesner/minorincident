# r7-kitefix — kiting pressure audit

## Scope and outcome

This lane integrates the `r6-kite` QA policy and measures each on-foot horde level under sustained backpedal fire. The first audit exposed a harness interaction: injected kiting frames were being applied to the ordinary skilled seed route, so the audit changed the collapse and follower-pace measurements it was meant to observe. Kiting now runs in a second seeded `runLevel` route, with its own receipt. The ordinary skilled route retains its normal input and observations.

The policy walks while aiming and firing back at a selected nearby pursuer. It samples a marked combat phase, continues a full 20-second encounter sample, and physically rejoins the sampled position. It constrains retreat to walkable ground and fires one discrete rocket shot in launcher levels so the probe does not become continuous launcher spam.

## Before and after

Initial complete audit on the integrated tree (seed 1, low tier) reported these kiting attack rates:

| Level | Before (courier-targeting windups/min) | Current focused receipt |
|---|---:|---:|
| L1 | 58.96 | unchanged by this lane |
| L2 | 0.00 | 3.00 |
| L3 | 0.00 | 9.28 |
| L4 | 67.18 | unchanged by this lane |
| L5 | 0.00 | 16.63 |
| L6 | 4.66 | unchanged by this lane |
| L7 | 0.00 | 15.45 |
| L8 | 0.00 | 3.00 |
| L9 | N/A (driving) | N/A |
| L10 | 69.05 | unchanged by this lane |

The focused runs were level-filtered diagnostics, so their reports include the expected `PARTIAL_LEVEL_SELECTION` notice and do not replace the final complete gate. Current focused L2/L3/L5/L7 and L8 receipts exceed the 2/min floor. On the ordinary skilled route, splitting the kiting policy restores L2's 10 collapse attacks and L8 follower 364's 4.495 m/s pace, removing the two regressions that the mixed-input harness had introduced.

L4's existing benchmark is retained for the final complete report: first breach 52.7167 seconds, post-turn hold 19.9 seconds, 70 alive, peak 95, peak plaza 92, minimum plaza 49, first attack 8.933 seconds. The full final audit must confirm those values remain identical.

## L8 pressure response

The L8 one-shot launcher policy and broad horde sample make a valid pressure encounter, but ordinary L8 threats were not reliably switching from mission pressure to the courier after a shot. The L8 perception response now releases a non-pursuit infected's pressure target on a recent nearby courier shot and directs it toward the courier. L8's lunge range is 8 m so a committed windup can reach the retreating courier. The focused receipt completed in 100.38 seconds with no deaths and no native flags; follower 364 paced at 4.495 m/s. A stripped-down repeat did not produce an artifact and is inconclusive.

## Remaining audit findings

The initial complete audit also reported L3 competent attack-band coverage at 1/3 seeds (`30.185`, `2.752`, `5.287` attacks/min) and an L3-11 criterion failure. The cause predates this lane in the integrated L3 route; the final complete audit must determine whether it persists after the route split. Do not treat focused checks as a complete zero-flag result.

## Validation and delivery

- Initial complete `npm run qa:threat`: 9 flags before the harness split and L8 response changes.
- Final complete `npm run qa:threat`: pending.
- `npm run typecheck`, `npm run lint`, and `npm test` (maximum 4 workers, 150-second budget): pending.
- No deploy or push.
- The `r6-kite` supporting report, JSON receipts, and driver sheet are included under `docs/reports/r6-kite/` and `test-results/r6-kite/`.
