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
| Nail gun | Close-mid precision with strong sustained DPS | 14 × 6/s → 20 × 6/s (three nails drop a native 60 HP ordinary infected) |
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

Static-reserve experiment: increasing the journey reservation from one slot to three produced 39 attack starts, nine gaps over 30 s, and a 243.1 s longest gap (seed 1, low tier, completed in 1,012.5 s). It reduced pressure and was reverted; a static reservation alone does not solve local arrival starvation. Receipt: `/tmp/s86-reserve3.json`.

Passed-anchor admission experiment: stopping unadmitted slots once the courier passed their anchor by 80 m produced 858 attack starts but timed out at 1,800 s and retained a 243.8 s gap (nine gaps over 30 s). It was reverted because it increased late pressure without resolving cadence or preserving completion. Receipt: `/tmp/s86-expirepassed.json`.

Runtime actor trace (`/tmp/s86-actortrace.json`) confirms cap holders are living chase/attracted actors, often 40–110 m away, rather than corpses. It also confirms that the fixed-HP TTK table is not the runtime-health table: `InfectedSystem.spawn()` applies the pre-existing global `INFECTED_TOUGHNESS` multiplier. Native L10 runners in the trace have 60 HP and armored infected 240 HP. This scaling was not changed; actual runtime TTK/target compliance requires a separate native-health verification before completion.

Native-health correction: nail damage is now 20 (120 raw DPS), so three nails cover the native ordinary infected's 60 HP. The assertion now reads `infectedDef().hp * INFECTED_TOUGHNESS`. Focused combat, typecheck and lint pass. The full threat audit and remote-unit receipt above predate this final 18→20 correction and require refresh before completion; the fixed-target nail TTK row above also predates this correction.

Post-correction validation (20-damage nail gun): full ten-level audit `/tmp/s86-threat-nail20` completed in 384.3 s; every level's skilled/passive flag set matches the c9a9bbbd baseline, with the same two existing top-level L4 failures. Remote `sh tools/remote/run.sh "$PWD" -- npm test` passed on 94.130.181.173: 106 passed, one skipped, 27 files, 221.0 s / 240 s. This supersedes the earlier note requiring refresh after the nail correction. The pacing criterion and native-health TTK report refresh remain open.

Native-health area verification: all cluster fixtures now derive ordinary HP from the infected catalog (60 HP). Molotov at 24 burn DPS left 2–3.5 HP after two seconds; 28 DPS clears all five within two seconds. Flame, pipe bomb and rocket also clear their five-target fixtures within three seconds at native HP. Focused combat, typecheck and lint pass. Full audit and remote-unit results above predate the 24→28 molotov correction and require refresh.

Native direct-impact estimates below use `damageAmount()` with runtime HP and authored cadence, excluding reloads, travel and accuracy. They supplement the earlier fixed-target table; they are not full firing simulations. Ordinary=60, sprinter=45, Alpha=300, brute=450, armored=240.

| Weapon | Ordinary | Sprinter | Alpha | Brute | Armored front | Armored rear |
| --- | --- | --- | --- | --- | --- | --- |
| bat | 3@1 | 3@1 | 14@6.5 | 21@10 | 22@10.5 | 11@5 |
| fire-axe | 2@0.5 | 1@0 | 6@2.5 | 9@4 | 9@4 | 5@2 |
| handgun | 3@0.67 | 3@0.67 | 30@9.67 | 23@7.33 | 24@7.67 | 12@3.67 |
| army-mg | 5@0.4 | 4@0.3 | 43@4.2 | 33@3.2 | 35@3.4 | 18@1.7 |
| shotgun | 1@0 | 1@0 | 2@0.5 | 2@0.5 | 2@0.5 | 1@0 |
| rocket-launcher | 1@0 | 1@0 | 2@0.83 | 3@1.67 | 2@0.83 | 2@0.83 |
| hunting-rifle | 1@0 | 1@0 | 2@1 | 2@1 | 2@1 | 1@0 |
| nail-gun | 3@0.33 | 3@0.33 | 30@4.83 | 23@3.67 | 24@3.83 | 12@1.83 |
| machete | 2@0.4 | 2@0.4 | 8@2.8 | 12@4.4 | 12@4.4 | 6@2 |
| assault-rifle | 3@0.27 | 2@0.13 | 24@3.07 | 18@2.27 | 19@2.4 | 10@1.2 |

Final molotov correction validation: `/tmp/s86-threat-molotov28` completed all ten levels in 382.1 s. Every skilled/passive flag set matches the c9a9bbbd baseline; only the two pre-existing L4 criteria remain at top level. Remote units on 46.225.66.90 passed 106 tests with one skipped in 197.3 s / 240 s. This supersedes the pending-refresh note after the 28-DPS correction. The remaining open acceptance work is L10 continuous attack cadence and complete native firing TTK measurement.

Actual native firing receipt: [native-ordinary.json](native-ordinary.json) records `SimWorld` held-fire runs against a stationary 60 HP dummy at 1.5 m, seed 1, assist off, including startup/travel. Hunting rifle: 1 shot / 0.133 s; nail gun: 3 shots / 0.483 s; machete: 2 attacks / 0.500 s; molotov: 1 throw / 2.150 s from input; assault rifle: 3 shots / 0.383 s versus handgun 3 / 0.783 s. The bat pushes the dummy out of reach, and the rocket launcher does not start with this LEFT input fixture; those measurements remain unresolved rather than being reported as valid TTK. Flashbang remains nonlethal.

Ordinary firing-fixture correction: the rocket was previously aimed inside blast-safety distance. At 10 m it fires once and kills in 0.667 s including travel. Resetting the bat dummy to its fixed position each tick prevents knockback from ending the stationary-target measurement: three attacks kill in 0.767 s. `native-ordinary.json` now supersedes the earlier unresolved bat/rocket receipt and records these fixture conditions. All damaging weapons have a successful ordinary-target native firing measurement; Flashbang remains nonlethal.

Actual firing matrix: [native-targets.json](native-targets.json) extends the receipt to all six native-health target profiles. It includes real startup, projectile travel, reload/recharge and repeated throwable taps. Dummies carry the relevant archetype and armored plate response, but stay fixed in place; this measures weapon execution without target movement. Front faces the source (yaw π), rear faces away (yaw 0). `attacks@seconds` below starts at initial input; `>30` is a bounded non-kill, not a TTK.

| Weapon | Ordinary 60 | Sprinter 45 | Alpha 300 | Brute 450 | Armor front 240 | Armor rear 240 |
| --- | --- | --- | --- | --- | --- | --- |
| bat | 3@0.767 | 3@0.767 | 13@4.167 | 89@>30 | 20@6.517 | 10@3.15 |
| fire-axe | 2@0.617 | 1@0.117 | 6@2.617 | 9@4.117 | 9@4.117 | 5@2.117 |
| handgun | 3@0.783 | 3@0.783 | 30@9.783 | 23@7.45 | 24@7.783 | 12@3.783 |
| army-mg | 5@0.533 | 4@0.433 | 43@4.333 | 33@3.333 | 35@3.533 | 18@1.833 |
| shotgun | 1@0.117 | 1@0.117 | 2@0.617 | 2@0.617 | 2@0.617 | 1@0.117 |
| rocket-launcher | 1@0.667 | 1@0.667 | 2@1.5 | 3@2.35 | 2@1.5 | 2@1.5 |
| pipe-bomb | 2@2.017 | 2@2.017 | 2@2.267 | 3@14.017 | 2@2.267 | 2@2.267 |
| hunting-rifle | 1@0.133 | 1@0.133 | 2@1.133 | 2@1.133 | 2@1.133 | 1@0.133 |
| nail-gun | 3@0.483 | 3@0.483 | 30@6.417 | 23@3.817 | 24@3.983 | 12@1.983 |
| machete | 2@0.5 | 2@0.5 | 8@2.9 | 12@4.483 | 12@4.483 | 6@2.083 |
| molotov | 2@2.15 | 2@1.15 | 3@12.217 | 3@18.217 | 2@8.15 | 2@8.15 |
| assault-rifle | 3@0.383 | 2@0.25 | 24@3.183 | 18@2.383 | 19@2.517 | 10@1.317 |
| flashbang | 4@>30 | 4@>30 | 4@>30 | 4@>30 | 4@>30 | 4@>30 |
| flamethrower | 3@0.783 | 3@0.783 | 18@5.783 | 17@5.45 | 15@4.783 | 10@3.117 |

Native before/after firing comparison (supersedes the earlier formula-based TTK comparison): the same `SimWorld` harness was run with the c9a9bbbd weapon catalog and the current catalog, retaining identical current engine behavior and native-health fixtures. Catalog restoration was automatic and the gameplay source is unchanged. Each cell is `attacks@seconds before → after`; `>30` denotes a non-kill by the 30-second bound. Flashbang is intentionally nonlethal. Reload and charge delays are included. Full paired receipts are in `native-targets.json`.

| Weapon | Ordinary 60 | Sprinter 45 | Alpha 300 | Brute 450 | Armor front 240 | Armor rear 240 |
| --- | --- | --- | --- | --- | --- | --- |
| bat | 3@0.767 → 3@0.767 | 3@0.767 → 3@0.767 | 13@4.167 → 13@4.167 | 89@>30 → 89@>30 | 20@6.517 → 20@6.517 | 10@3.15 → 10@3.15 |
| fire-axe | 2@0.617 → 2@0.617 | 1@0.117 → 1@0.117 | 6@2.617 → 6@2.617 | 9@4.117 → 9@4.117 | 9@4.117 → 9@4.117 | 5@2.117 → 5@2.117 |
| handgun | 3@0.783 → 3@0.783 | 3@0.783 → 3@0.783 | 30@9.783 → 30@9.783 | 23@7.45 → 23@7.45 | 24@7.783 → 24@7.783 | 12@3.783 → 12@3.783 |
| army-mg | 5@0.533 → 5@0.533 | 4@0.433 → 4@0.433 | 43@4.333 → 43@4.333 | 33@3.333 → 33@3.333 | 35@3.533 → 35@3.533 | 18@1.833 → 18@1.833 |
| shotgun | 1@0.117 → 1@0.117 | 1@0.117 → 1@0.117 | 2@0.617 → 2@0.617 | 2@0.617 → 2@0.617 | 2@0.617 → 2@0.617 | 1@0.117 → 1@0.117 |
| rocket-launcher | 1@0.667 → 1@0.667 | 1@0.667 → 1@0.667 | 2@1.5 → 2@1.5 | 3@2.35 → 3@2.35 | 2@1.5 → 2@1.5 | 2@1.5 → 2@1.5 |
| pipe-bomb | 2@2.017 → 2@2.017 | 2@2.017 → 2@2.017 | 2@2.267 → 2@2.267 | 3@14.017 → 3@14.017 | 2@2.267 → 2@2.267 | 2@2.267 → 2@2.267 |
| hunting-rifle | 1@0.117 → 1@0.133 | 1@0.117 → 1@0.133 | 7@7.517 → 2@1.133 | 5@4.117 → 2@1.133 | 6@6.517 → 2@1.133 | 3@2.117 → 1@0.133 |
| nail-gun | 5@0.817 → 3@0.483 | 4@0.65 → 3@0.483 | 43@8.583 → 30@6.417 | 33@6.917 → 23@3.817 | 35@7.25 → 24@3.983 | 18@2.983 → 12@1.983 |
| machete | 2@0.55 → 2@0.5 | 2@0.55 → 2@0.5 | 10@4.167 → 8@2.9 | 15@6.383 → 12@4.483 | 15@6.383 → 12@4.483 | 8@3.25 → 6@2.083 |
| molotov | 2@3.15 → 2@2.15 | 2@2.15 → 2@1.15 | 4@27.25 → 3@12.217 | 4@>30 → 3@18.217 | 3@19.217 → 2@8.15 | 3@19.217 → 2@8.15 |
| assault-rifle | 3@0.383 → 3@0.383 | 2@0.25 → 2@0.25 | 24@3.183 → 24@3.183 | 18@2.383 → 18@2.383 | 19@2.517 → 19@2.517 | 10@1.317 → 10@1.317 |
| flashbang | 4@>30 → 4@>30 | 4@>30 → 4@>30 | 4@>30 → 4@>30 | 4@>30 → 4@>30 | 4@>30 → 4@>30 | 4@>30 → 4@>30 |
| flamethrower | 13@4.117 → 3@0.783 | 10@3.117 → 3@0.783 | 73@26.783 → 18@5.783 | 82@>30 → 17@5.45 | 60@22.117 → 15@4.783 | 49@16.117 → 10@3.117 |

Nearest-group admission experiment: sorting authored groups by X distance from the courier completed in 1,016.0 s but produced only 54 attack starts and a 758.5 s longest gap. It was reverted. Receipt: `/tmp/s86-nearestgroups.json`. Prioritizing unadmitted groups alone cannot reclaim capacity held by distant living pursuers.

Residency investigation: `ChunkResidency.sleepOutside()` already preserves actors as serialized sleeping records, releases live AI slots, and retains identity/timers for restoration. `wakeInside()` restores records in loaded-chunk iteration order, constrained by the director cap. A future local-pressure change must coordinate suspension and wake priority; changing admission alone leaves distant live holders in place, while suspending alone may immediately wake them again. Corpse persistence is handled independently by the existing saved-entity path. No residency behavior was changed in this investigation.

Coordinated-residency experiment: offscreen living cure hunters beyond 50 m were saved through existing sleep records and prevented from waking beyond 40 m. Identities, HP and corpses were preserved; pursuit actors were exempt. The run completed in 1,009.6 s but dropped to 33 attack starts, with ten gaps over 30 s and a 243.5 s longest gap. It was reverted. Receipt: `/tmp/s86-dormant50.json`. Freeing distant capacity by itself did not improve contact.

Harness-only valid-arrival pulse: every 15 s before the finale, a runner was requested 40 m ahead when the shared safety/residency checks and capacity allowed it. Direct tick-callback spawning collided with scripted admission and hit the concurrency guard; switching to the director request queue completed in 1,085.8 s with 75 starts, eight gaps over 30 s, and a 253.3 s longest gap. No production code was changed. Receipt: `/tmp/s86-validpulse.json`. Valid queued arrivals alone did not close the cadence gap.
