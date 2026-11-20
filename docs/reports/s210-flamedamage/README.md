# s210 flamethrower damage and burning

## Measurement method

Native simulation damage model at 15 stream ticks/s, 8 m range, no line-of-sight obstruction, steady centered hold. Infected health is the catalog archetype HP multiplied by the existing 1.5 toughness rule. Stream damage has no distance falloff, so the controlled 1 m, 3 m and 6 m probes use the same tick cadence. Burning is 35 DPS for four seconds; firefighter fire damage is 0.25×, butcher fire damage is 3×. These are weapon rules; infected HP and movement definitions are unchanged. This is a deterministic damage-model measurement, not a campaign route duration.

| Archetype | Effective HP | 1 m TTK | 3 m TTK | 6 m TTK |
|---|---:|---:|---:|---:|
| runner | 60 | 0.22 s | 0.22 s | 0.22 s |
| sprinter | 45 | 0.15 s | 0.15 s | 0.15 s |
| crawler | 37.5 | 0.15 s | 0.15 s | 0.15 s |
| brute | 450 | 1.82 s | 1.82 s | 1.82 s |
| riot | 225 | 0.95 s | 1.00 s | 1.00 s |
| armored | 240 | 1.00 s | 1.00 s | 1.00 s |
| bloated | 180 | 0.75 s | 0.75 s | 0.75 s |
| hazmat | 180 | 0.75 s | 0.75 s | 0.75 s |
| screamer | 90 | 0.35 s | 0.35 s | 0.35 s |
| butcher | 1,350 | 1.82 s | 1.82 s | 1.82 s |
| nurse | 105 | 0.42 s | 0.42 s | 0.42 s |
| firefighter | 210 | 3.22 s | 3.22 s | 3.22 s |
| dog | 45 | 0.15 s | 0.15 s | 0.15 s |
| Alpha | 300 | 2.00 s | 2.00 s | 2.02 s |

Measured in the native `SimWorld` with 15 stream ticks/s, applying the catalog flamethrower tick and burning status every four simulation ticks until death. Times include the sim tick on which death resolves. The target was stationary and unobstructed; range does not change damage. The target-centered 1 m probe is the controlled damage measurement; a separate held-input point-blank combat test verifies that a target at the muzzle is hit. Flames bypass the armored front plate. The Alpha remains subject to its existing 0.5 bullet damage rule.

The pre-change numbers (4.5 direct damage, 35 DPS burn, firefighter immune, armored front hits halved) were read from the source before changing it, but a pre-change native timing run was not captured. This table is the post-change native timing run.

## Changes

- Increased direct flame damage from 4.5 to 15 per stream tick.
- Firefighter now takes 25% damage from the weapon stream and fire hazards instead of being immune.
- Butcher takes 3× weapon fire damage so its unchanged 1,350 effective HP meets the two-second heavy target. Direct flame damage against Mega and arena bosses remains at the former 4.5 per-tick value.
- Burning spreads to infected within 1 m and the spread applies an immediate burn-damage pulse; the normal burn DoT continues afterward. Running has no burn slow.
- A burning infected's later lethal hit becomes permanent fire death and leaves ash, even if the finishing hit is not itself fire. Fire deaths bypass downed recovery; environmental fire damage also produces ash.
- Fixed the zero-distance flame-cone exclusion that caused the point-blank miss.

## Validation

- `npm run typecheck`: passed.
- `npm run lint`: passed.
- Focused `tests/engine/combat.test.ts` and `tests/engine/infected-ai.test.ts`: 12 tests passed.
- `npm run qa:threat`: full run passed in 498.0 s with 0 fail flags; skilled routes completed for L1–L10. L4, L5 and L8/L10 passive routes were marked tick-budget; no passive flags. This pass preceded the final fire-hazard firefighter resistance adjustment. Two unchanged reruns on final source reached the 600 s batch limit (exit 124); no fail flags had been reported before timeout, but final-source full completion remains unverified.
- Local `npm test`: one run passed before the final hazard adjustment (27 files, 106 tests, 227.29 s). A final-source rerun hit the 240 s budget (exit 124) without reporting an assertion failure.
- Remote `sh tools/remote/run.sh "$PWD" -- npm test`: unable to dispatch because no healthy Hetzner runner exists; `sh tools/remote/scale.sh add` failed because DNS could not resolve the Hetzner API. Remote acceptance remains open.

## Known limits

The earlier full threat audit completed every skilled route with zero failure flags; no level was reported harmless. No zombie stats were changed. Final-source full QA was attempted twice and hit its 600 s process limit. Remote unit validation could not dispatch because there was no healthy runner and provisioning failed at DNS resolution. These checks remain open at the time-box ending.
