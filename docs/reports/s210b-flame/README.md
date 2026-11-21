# s210b — flamethrower damage without the L5 regression

## Result

Restored s210 flamethrower damage, spreading burns and permanent ash deaths. The full threat audit completed in two shards and merged with **0 fail flags**; all ten skilled campaign routes completed. L5 completed with no skilled or follower-pace flags.

The L5 regression came from `Damage.apply` treating every `hazard.fire` and `environment.fire` hit as permanent fire damage. That made ambient level fires kill infected permanently without courier involvement. Permanent ash deaths from hazard fire now require `source.playerDamageSource`; a burning target remains a permanent fire death regardless of the finishing hit. The L5 route and follower seeds pass with the s210 weapon behavior restored.

## Flamethrower TTK

Native stationary, unobstructed `SimWorld` measurement at 15 stream ticks/s; damage is applied on the catalog cadence with burn status. Effective HP uses the existing 1.5 infected toughness multiplier. The weapon has no distance falloff, so the 1 m, 3 m and 6 m values match. Ordinary targets are within the ≤0.5 s target, heavy targets at 3 m are within ≤2 s, and Alpha is within ≤5 s. Mega and arena boss direct damage remains at the prior 4.5-per-tick rate.

| Infected archetype | Effective HP | 1 m | 3 m | 6 m | Target |
|---|---:|---:|---:|---:|---|
| runner | 60 | 0.22 s | 0.22 s | 0.22 s | ordinary ≤0.5 s |
| sprinter | 45 | 0.15 s | 0.15 s | 0.15 s | ordinary ≤0.5 s |
| crawler | 37.5 | 0.15 s | 0.15 s | 0.15 s | ordinary ≤0.5 s |
| brute | 450 | 1.82 s | 1.82 s | 1.82 s | heavy ≤2 s at 3 m |
| riot | 225 | 0.95 s | 1.00 s | 1.00 s | heavy ≤2 s at 3 m |
| armored | 240 | 1.00 s | 1.00 s | 1.00 s | heavy ≤2 s at 3 m |
| bloated | 180 | 0.75 s | 0.75 s | 0.75 s | heavy ≤2 s at 3 m |
| hazmat | 180 | 0.75 s | 0.75 s | 0.75 s | heavy ≤2 s at 3 m |
| screamer | 90 | 0.35 s | 0.35 s | 0.35 s | ordinary ≤0.5 s |
| butcher | 1,350 | 1.82 s | 1.82 s | 1.82 s | heavy ≤2 s at 3 m |
| nurse | 105 | 0.42 s | 0.42 s | 0.42 s | ordinary ≤0.5 s |
| firefighter | 210 | 3.22 s | 3.22 s | 3.22 s | fire resistant (0.25×), not immune |
| dog | 45 | 0.15 s | 0.15 s | 0.15 s | ordinary ≤0.5 s |
| Alpha | 300 | 2.00 s | 2.00 s | 2.02 s | ≤5 s |

Point-blank stream coverage is covered by the held-input muzzle test. Flames bypass armored front-plate reduction. Firefighter retains 0.25× fire damage; butcher takes 3× fire damage. Burning spreads to infected within touching range (at most 1 m for the standard bodies), applies an immediate damage pulse and continues its DoT. Burning does not slow infected.

## Validation

- `npm run typecheck` — passed.
- `npm run lint` — passed.
- Focused combat and infected AI suites — 12 tests passed, including ambient-fire recovery and burning ash behavior.
- Full threat audit: shards 1/2 and 2/2 completed; merge reported 0 fail flags. Skilled routes L1–L10 all completed. L5 skilled route completed; L5 skilled and passive follower pace reported 0 flags. Passive `tick-budget` outcomes are the audit's defined observation caps, not failures.
- `sh tools/remote/run.sh "$PWD" -- npm test` — could not dispatch: no healthy Hetzner runner was available. Required local fallback `npm test` passed (27 files, 106 tests; 130 s).

No infected stats were changed. Ambient hazard fire still damages targets normally but does not force permanent ash death without courier attribution. Courier-lit fire retains permanent ash behavior; bodies/heaps remain persistent.
