# s114-l6breach2 — breach2 contact and exit pressure

## Root cause and change

The early-close audit started `l6.breach2` at 54.22 s, admitted all ten members through the two watched shelter doors, but the breach offset placed them at z = -9 m. The first runner that survived long enough to attack wound up against the courier at 76.62 s: 22.40 s after the wave announcement. The remaining cohort and the retreat began moving while it worked around the shelter edge.

For wave 2 only, the spawn base moves 4 m toward the corridor before the existing 9 m offset is applied. This retains the two-access, ten-member cohort, the authored retreat timing, and the shared infected/weapon stats. In the same deterministic early-close audit, breach2's first player windup moved to 6.53 s after announcement; all ten members were recorded and no L6 threat flag remained.

The browser QA report also identified a LOW exit lull. The pressure receipt stopped at the courier's exit event and did not measure the later exit phase. The L6 pressure runner now records `exitLullS` through mission completion and fails complete-policy runs at 12 s or more. When the courier reaches the exit platform, the pressure clock is made due immediately; exit-phase source selection uses the nearer ahead band so that the cohort can reach the moving column before completion.

## Threat flags

Baseline full audit receipt from `docs/reports/s110-l4horde/final-audit.json`:

- `L4/wave/breach-north:WAVE_FEWER_THAN_THREE_COHORT_MEMBERS`
- `L6/early-close/wave/l6.breach2:WAVE_FIRST_ATTACK_OVER_20_SECONDS`

After this change, the merged all-level audit receipt `test-results/s114-full-merged/audit.json` reports **zero flags**. L6's complete, passive, and early-close observations have no flags. The L4 baseline flag was not present in the current full receipt.

| L6 breach2 measure | Before | After |
|---|---:|---:|
| Early-close first player attack | 22.40 s | 6.53 s |
| Spawned breach2 cohort | 10/10 | 10/10 |
| L6 threat flags | `WAVE_FIRST_ATTACK_OVER_20_SECONDS` | none |

## L6 pressure results

Full `tools/qa/l6-pressure.ts` run: HIGH and LOW, seeds 1–3, complete policy. HIGH and LOW are deterministic-equal in this harness.

| Seed | Saved | Exit lull to completion |
|---:|---:|---:|
| 1 | 21/29 (72.4%) | 0.12 s |
| 2 | 17/29 (58.6%) | 2.53 s |
| 3 | 21/29 (72.4%) | 1.02 s |

Mean saved share was 67.8% in both tiers; all runs completed and stayed above the 41% saved-share floor. Skilled L6 damage was 50 HP in the full threat receipt versus the 55 HP baseline receipt, within the requested +15% bound. Pressure receipt: `test-results/s114-l6-pressure-final.json`.

## Validation

- Full threat audit, deterministic 2-shard merge, four workers per shard: **zero flags** (`test-results/s114-full-merged/audit.json`). An initial unsharded run reached its 600 s budget before aggregation; the complete unchanged stage set was then run in two shards.
- `npm run typecheck`: passed.
- `npm run lint`: passed.
- `npm test`: passed locally, 107 passed / 1 skipped, 27 files, 216.9 s (240 s budget).
- Required remote `sh tools/remote/run.sh "$PWD" -- npm test`: could not start. The runner reported no healthy/provisioned Hetzner runner, and this wrapped command is not eligible for the Mac fallback. No remote unit result is claimed.

## Browser QA needed

Coding-lane evidence is simulation-only. Re-run the physical-input HIGH and LOW L6 browser routes, especially breach2 and the last retreat through exit, with the headless browser pool. Confirm the adjusted breach2 entry remains visually offscreen until it enters the corridor, survivors remain safe around the shelter, and real-input exit pressure has no lull above 12 s. No browser work was performed in this coding lane.
