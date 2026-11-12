# s86-weaponpower

PO UAT, PROD 2026-11-12: L10's new firearms and incendiaries felt underpowered. Global action definitions were tuned so every level using the same weapon receives the same values. Infected health, armor, speed, and damage were not changed. L10 pressure was raised with additional bodies only.

## Weapon roles and tuning

| Weapon | Role | Before → after |
| --- | --- | --- |
| Bat | Early crowd-control melee; existing role retained | 22 damage, 0.5 s swing → unchanged |
| Fire axe | Heavy melee and crowd sweep; existing role retained | 56 damage, 0.5 s swing → unchanged |
| Handgun | Infinite-ammo baseline sidearm | 20 × 3/s → unchanged |
| Army MG | Piercing sustained fire | 14 × 10/s → unchanged |
| Shotgun | Close multi-target burst | 240, 2/s → unchanged |
| Rocket launcher | Long-range explosive crowd clear | 180, 1.2/s → unchanged |
| Pipe bomb | Timed cluster clear | 150 damage, 4.5 m radius, 2 s fuse → unchanged |
| Hunting rifle | Long-range precision, one target pierced | 90 damage, no pierce → 300 damage, pierce 1 |
| Nail gun | Close-mid precision with strong sustained DPS | 14 × 6/s → 18 × 6/s (three nails drop a 40 HP ordinary infected) |
| Machete | Fast, decisive melee blade | 32 damage, 0.45 s swing → 40 damage, 0.4 s swing |
| Molotov | Fire patch for lane denial and cluster burn | 15 DPS, 6 s zone → 24 DPS, 8 s zone |
| Assault rifle | Flexible automatic DPS above the handgun | 26 × 7.5/s → unchanged (195 vs handgun's 60 DPS) |
| Flashbang | Nonlethal 3 s stun to open space or interrupt a push | Existing stun role retained |
| Flamethrower | Short-range cone that burns clustered enemies over time | 4 damage, 8 DPS, 5 rays → 20 damage, 24 DPS, 7 rays |

## Native TTK and group damage

TTK uses the game's native `damageAmount()` formula and authored action cadence against fixed HP targets. Shots land at full accuracy on stationary targets (flamethrower at 2 m, where its cone covers one target); time starts at first hit and excludes projectile travel. `hits@seconds` is hits needed to reduce HP to zero and elapsed sim time; Alpha is 300 HP, brute 300, ordinary 40, runner 30, armored 160. Armored front/rear uses directional plate response. Molotov/flamethrower TTK includes native burn DPS. Flashbang is non-damaging. Separately, `SimWorld` cluster tests confirm 5/5 ordinary infected die within 2 s of molotov ignition, 3 s of a close flamethrower cone, and 3 s of centered pipe-bomb/rocket blasts. `before → after` values are shown even where unchanged.

| Weapon | Ordinary | Runner | Alpha (300) | Brute (300) | Armored front (160) | Armored rear (160) | Five-target cluster within 3 s |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Bat | 2@0.50 → 2@0.50 | 2@0.50 → 2@0.50 | 14@6.50 → 14@6.50 | 14@6.50 → 14@6.50 | 15@7.00 → 15@7.00 | 8@3.50 → 8@3.50 | n/a |
| Fire axe | 1@0.00 → 1@0.00 | 1@0.00 → 1@0.00 | 6@2.50 → 6@2.50 | 6@2.50 → 6@2.50 | 6@2.50 → 6@2.50 | 3@1.00 → 3@1.00 | n/a |
| Handgun | 2@0.33 → 2@0.33 | 2@0.33 → 2@0.33 | 30@9.67 → 30@9.67 | 15@4.67 → 15@4.67 | 16@5.00 → 16@5.00 | 8@2.33 → 8@2.33 | n/a |
| Army MG | 3@0.20 → 3@0.20 | 3@0.20 → 3@0.20 | 43@4.20 → 43@4.20 | 22@2.10 → 22@2.10 | 23@2.20 → 23@2.20 | 12@1.10 → 12@1.10 | n/a |
| Shotgun | 1@0.00 → 1@0.00 | 1@0.00 → 1@0.00 | 2@0.50 → 2@0.50 | 2@0.50 → 2@0.50 | 2@0.50 → 2@0.50 | 1@0.00 → 1@0.00 | n/a |
| Rocket launcher | 1@0.00 → 1@0.00 | 1@0.00 → 1@0.00 | 2@0.83 → 2@0.83 | 2@0.83 → 2@0.83 | 1@0.00 → 1@0.00 | 1@0.00 → 1@0.00 | 5/5 killed (≤0.83 s) |
| Pipe bomb | 1@2.00 → 1@2.00 | 1@2.00 → 1@2.00 | 2@2.25 → 2@2.25 | 2@2.25 → 2@2.25 | 2@2.25 → 2@2.25 | 2@2.25 → 2@2.25 | 5/5 killed (≤2.25 s) |
| Hunting rifle | 1@0.00 → 1@0.00 | 1@0.00 → 1@0.00 | 7@6.00 → 2@1.00 | 4@3.00 → 1@0.00 | 4@3.00 → 2@1.00 | 2@1.00 → 1@0.00 | n/a (one-target pierce) |
| Nail gun | 3@0.33 → 3@0.33 | 3@0.33 → 2@0.17 | 43@7.00 → 34@5.50 | 22@3.50 → 17@2.67 | 23@3.67 → 18@2.83 | 12@1.83 → 9@1.33 | n/a |
| Machete | 2@0.45 → 1@0.00 | 1@0.00 → 1@0.00 | 10@4.05 → 8@2.80 | 10@4.05 → 8@2.80 | 10@4.05 → 8@2.80 | 5@1.80 → 4@1.20 | n/a |
| Molotov | 1@1.20 → 1@0.88 | 1@0.80 → 1@0.59 | 1@11.60 → 1@8.53 | 1@11.60 → 1@8.53 | 1@11.60 → 1@8.53 | 1@11.60 → 1@8.53 | 5/5 killed (≤1.2 s); zone 6→8 s |
| Assault rifle | 2@0.13 → 2@0.13 | 2@0.13 → 2@0.13 | 24@3.07 → 24@3.07 | 12@1.47 → 12@1.47 | 13@1.60 → 13@1.60 | 7@0.80 → 7@0.80 | n/a |
| Flashbang | N/A (stun) | N/A (stun) | N/A (stun) | N/A (stun) | N/A (stun) | N/A (stun) | N/A |
| Flamethrower | 6@1.67 → 2@0.33 | 4@1.00 → 2@0.33 | 40@13.00 → 16@5.00 | 31@10.00 → 10@3.00 | 22@7.00 → 10@3.00 | 18@5.67 → 7@2.00 | 5/5 burn within 3 s (close cone) |

## L10 infected counts and pressure

The farm road cohorts and residential fringe, industrial depot, military breach/exit, destroyed corridor, and final dispersal assault receive added infected slots. No archetype or infected stat changed. L10 continues to cap resident infected at 15 outside the finale and 22 during the finale assault (low-quality director level caps are twice those values). The additions are within those existing active-count caps; infected corpses remain persistent.

The final low-tier skilled L10 receipt on seed 1 started 99 infected attacks, versus 40 on c9a9bbbd. Using the completed-run clock from first attack to completion, that is 5.9 versus 2.4 starts/minute. Completion time was 1,018.3 s versus 1,010.5 s; it was not used as a target. The attack-start stream still has seven gaps over 30 s, with a longest gap of 250.2 s during route travel. The requested “no 30 s window once combat begins” criterion is therefore **open**; the count increases raised total pressure but did not sustain starts through every traversal stretch.

## Threat audit

The full audit ran with `QA_THREAT_MAIN_REVISION=c9a9bbbd` and four workers. Every level's combined skilled/passive flags match the baseline receipts; the existing L4 flags remain unchanged. The audit's top-level flags are the same two L4 criteria on both runs.

| Level | Skilled flags (baseline → after) | Passive flags (baseline → after) |
| --- | --- | --- |
| L1 | 0 → 0 | 0 → 0 |
| L2 | 0 → 0 | 0 → 0 |
| L3 | 0 → 0 | 0 → 0 |
| L4 | 2 → 2 | 2 → 2 |
| L5 | 0 → 0 | 0 → 0 |
| L6 | 1 → 1 | 0 → 0 |
| L7 | 0 → 0 | 0 → 0 |
| L8 | 1 → 1 | 0 → 0 |
| L9 | 0 → 0 | 0 → 0 |
| L10 | 0 → 0 | 0 → 0 |

L10 completed in 1,018.3 s (baseline 1,010.5 s), with two deaths and no skilled or passive flags. The audit artifacts are in `/tmp/s86-threat-final2`.

## Browser QA needed

No browser runs were performed. Human visual QA should confirm the molotov visibly burns a cluster and the flamethrower cone reads clearly at close range.

## Checks

- `npm run typecheck`: pass
- `npm run lint`: pass
- `npx vitest run tests/engine/combat.test.ts --maxWorkers=4 --configLoader runner`: pass (7 cases, retaining all weapon assertions)
- remote unit suite: pass on 46.225.66.90; 106 passed, 1 skipped, 27 files, 200.2 s / 240 s. The four new checks were consolidated into the existing combat case to retain the 150-case repository budget.
- ten-level threat audit: pass, no new flags
- attack-start condition: rate exceeded baseline; 30 s gap condition remains open (seven gaps, longest 250.2 s)

Pacing investigation: `SpawnDirector.safe()` requires arrivals to be at least 18 m from the courier and offscreen or occluded. The rejected 5 m pressure-pulse experiment could never admit an actor; it was reverted. Future cadence work must use valid offscreen approach points.

Native cap trace (`/tmp/s86-captrace.json`): during route travel, living infected usually occupy 11–12 of the 12 low-tier slots while only 0–2 are within 30 m of the courier. For example, at 450 s the director is 12/12 with zero nearby; at 750 s it is again 12/12 with zero nearby. This identifies distant living hunters starving later local arrivals as a remaining pacing constraint. Corpses were not removed and infected stats were not changed.
