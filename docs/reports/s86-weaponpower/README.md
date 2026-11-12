# s86-weaponpower

Global weapon tuning responds to the PO UAT that new weapons felt weak. Infected health, armor, speed and damage are unchanged. Corpses persist. L10 receives larger authored groups and closer finale approaches.

**Status: incomplete.** Weapon targets and current checks are supported below; L10 still fails the continuous 30-second attack-start cadence requirement.

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
| Molotov | Fire patch for lane denial and cluster burn | 15 DPS, 6 s zone → 28 DPS, 8 s zone |
| Assault rifle | Flexible automatic DPS above the handgun | 26 × 7.5/s → unchanged (195 vs handgun's 60 DPS) |
| Flashbang | Nonlethal 3 s stun to open space or interrupt a push | Existing stun role retained |
| Flamethrower | Short-range cone that burns clustered enemies over time | 4 damage, 8 DPS, 5 rays → 20 damage, 24 DPS, 7 rays |

## Native before/after firing measurements

[Paired receipts](native-targets.json) use the c9a9bbbd weapon catalog and current catalog in the same current `SimWorld` engine. Seed 1; assist off; stationary inert dummies tagged with the relevant archetype/plate response; native HP includes the existing 1.5 toughness multiplier. Range is 1.5 m, except rocket at 10 m to respect blast safety. Bat target position is restored each tick against knockback. Times start at input and include startup, travel, reload and recharge. Throwables are repeatedly tapped subject to actual charges. These are controlled weapon measurements, not moving AI fights.

Each cell is `attacks@seconds before → after`; `>30` denotes a bounded non-kill. Flashbang is nonlethal. Ordinary is the normal runner archetype; the fast runner profile is the sprinter.

| Weapon | Ordinary 60 HP | Sprinter 45 HP | Alpha 300 HP | Brute 450 HP | Armored front 240 HP | Armored rear 240 HP |
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

The requested fixed 160-HP armored/300-HP brute profiles differ from native spawned HP; the earlier fixed-target estimates are superseded by these native-health measurements. [Ordinary receipt](native-ordinary.json) also records the complete ordinary-target run.

## Native area checks

Five 60-HP targets: molotov clears within 2 s after ignition and its patch lasts 8 s; flamethrower clears a narrow close cone within 3 s; centered pipe bomb and rocket blasts clear within 3 s. Rocket cluster coverage uses the native explosion API; its launcher execution is measured separately above. These assertions run in the existing combat case, retaining the 150-case repository budget. A native hunting-rifle shot also kills two 60-HP ordinary targets aligned at 2 m and 4 m, verifying actual one-target piercing. Focused combat, typecheck and lint pass with this assertion.

## L10 pressure and remaining criterion

Current seed-1 low-tier skilled run: 41 attack starts, 2.447/minute from first attack to completion, 1,010.02 s completion. Baseline: 40 starts, approximately 2.386/minute, 1,010.45 s. The per-minute target passes narrowly. The longest attack-start gap remains 350.77 s, so the continuous 30-second criterion fails. Receipt: `/tmp/s86-finaleplus1.json`.

Existing resident caps are retained: up to 15 regular/high and 22 finale/high, with lower low-tier limits. Native traces show 11–12 of 12 low-tier slots occupied while only 0–2 infected are within 30 m. Holders are living pursuers, not corpses. The protected hangar conversation lasts 56 s; clarification about excluding protected story periods is pending, and outdoor gaps remain independently unresolved.

Rejected experiments were reverted: larger static reserves, passed-anchor expiry, nearest-group priority, closer dynamic placement, coordinated sleep/wake, valid queued pulses, and combined sleep/pulses. They reduced contact, retained long gaps, or prevented completion. No rejected gameplay experiment remains.

## Audit and checks

Full current audit `/tmp/s86-threat-final-count` completed in 415.5 s. All ten skilled/passive flag sets exactly match c9a9bbbd baseline receipts. Top-level exit is 1 because two pre-existing L4 criteria fail.

| Level | Skilled flags before → after | Passive flags before → after |
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

Typecheck and lint pass. Focused combat: 7 cases pass, including all new weapon assertions. Remote `sh tools/remote/run.sh "$PWD" -- npm test`: 106 passed, 1 skipped, 27 files, 199.0 s / 240 s on 46.225.66.90. No browser runs. No deployment or push.

## Browser QA needed

Human QA should confirm visible molotov cluster burning, flamethrower cone readability, and weapon feel. No visual fix is claimed.

Pulse admission instrumentation: 57 attempts, 55 safe points, 57 resident points, capacity available on 26 attempts, and 25 requests queued. The pulse mechanism was active rather than wholly rejected by safety checks, but single-runner arrivals did not sustain attack contact. Receipt: `/tmp/s86-pulse-admissions.json`; production behavior unchanged.

Three-runner queued-pulse harness: replacing each single arrival with three ordinary runners, through the same safety/cap queue, completed in 1,015.0 s with 53 starts, five gaps over 30 s, and a 446.1 s longest gap. The experiment remained outside production. Receipt: `/tmp/s86-threepulse.json`. Increasing this pulse's count alone did not sustain contact.

Existing-sprinter pulse harness: substituting the unchanged sprinter archetype for the single ordinary runner completed in 1,018.1 s with 43 starts, five gaps over 30 s, and a 397.5 s longest gap. It remained harness-only. Receipt: `/tmp/s86-sprinterpulse.json`. Faster existing archetype selection did not solve cadence in this arrival pattern.

Paired native group measurement (five 60-HP targets, three seconds): molotov **0/5 → 5/5**, sustained flamethrower **0/5 → 5/5**, pipe bomb **5/5 → 5/5**, centered native rocket explosion **5/5 → 5/5**. Full fixture conditions and remaining HP are stored in `native-targets.json` (`areaBefore`/`areaAfter`). Flamethrower requires sustained fire for this result; a brief single trigger left survivors in this independent fixture.

Contact-only diagnostic: before cure release, outside the protected hangar, while at least one visible living infected stayed within 30 m, the longest uninterrupted attack-start lull was 128.5 s (680.4 s total qualifying contact). The counter resets when contact is absent or an attack starts. Thus the cadence failure persists under a narrower nearby-contact interpretation; it cannot be attributed only to travel/story pauses. Receipt: `/tmp/s86-contact-lull.json`. This is additional diagnostic evidence, not a replacement for the whole-run target.

Longest contact-lull evidence: at tick 43,387 the courier was x3320/z94; nearby actors included an Alpha chasing at 24 m, armored chaser at 26 m, and an attracted sprinter with target 0 at 16 m (`/tmp/s86-lull-evidence.json`). Extending the L10 idle/wander pursuit refresh to attracted actors completed in 1,011.6 s but reduced starts to 34 and left a 309.6 s gap. The change was reverted (`/tmp/s86-refresh-attracted.json`).

Finale count correction: increasing regular finale slots from 8/5 to 9/6 (high/low) yields 41 attack starts, 2.447/minute, and 1,010.02 s completion in the current native run. This restores the per-minute target above baseline (~2.386/minute), but the 350.77 s gap persists. Local L10 skilled/passive flags are both empty (`/tmp/s86-l10-finaleplus1`); typecheck, lint and seven focused combat cases pass. Full audit and remote units must refresh after this count change.

Time-box handoff: current source is committed and final full audit/remote units are refreshed after the 9/6 finale count change and rifle-pierce assertion. Every level flag set matches baseline; all rejected gameplay experiments are reverted. Outstanding acceptance: sustained outdoor attack cadence (350.77 s maximum gap), plus clarification of the protected 56 s story exception. The goal is incomplete and no deployment/push occurred.

## Requested fixed-HP native comparison

The same native firing harness also measured the requested fixed profiles below, distinct from runtime toughness-scaled HP above. Before uses c9a9bbbd catalog; after uses current catalog. Conditions and `attacks@seconds` notation match the native-health table; a 30 s non-kill is `>30`. Receipts are `requestedFixedHpBefore`/`requestedFixedHpAfter` in `native-targets.json`.

| Weapon | Ordinary 40 | Fast runner 30 | Alpha 300 | Brute 300 | Armor front 160 | Armor rear 160 |
| --- | --- | --- | --- | --- | --- | --- |
| bat | 2@0.417 → 2@0.417 | 2@0.417 → 2@0.417 | 13@4.167 → 13@4.167 | 89@>30 → 89@>30 | 14@4.483 → 14@4.483 | 7@2.133 → 7@2.133 |
| fire-axe | 1@0.117 → 1@0.117 | 1@0.117 → 1@0.117 | 6@2.617 → 6@2.617 | 6@2.617 → 6@2.617 | 6@2.617 → 6@2.617 | 3@1.117 → 3@1.117 |
| handgun | 2@0.45 → 2@0.45 | 2@0.45 → 2@0.45 | 30@9.783 → 30@9.783 | 15@4.783 → 15@4.783 | 16@5.117 → 16@5.117 | 8@2.45 → 8@2.45 |
| army-mg | 3@0.333 → 3@0.333 | 3@0.333 → 3@0.333 | 43@4.333 → 43@4.333 | 22@2.233 → 22@2.233 | 23@2.333 → 23@2.333 | 12@1.233 → 12@1.233 |
| shotgun | 1@0.117 → 1@0.117 | 1@0.117 → 1@0.117 | 2@0.617 → 2@0.617 | 2@0.617 → 2@0.617 | 2@0.617 → 2@0.617 | 1@0.117 → 1@0.117 |
| rocket-launcher | 1@0.667 → 1@0.667 | 1@0.667 → 1@0.667 | 2@1.5 → 2@1.5 | 2@1.517 → 2@1.517 | 1@0.667 → 1@0.667 | 1@0.667 → 1@0.667 |
| pipe-bomb | 2@2.017 → 2@2.017 | 2@2.017 → 2@2.017 | 2@2.267 → 2@2.267 | 2@2.267 → 2@2.267 | 2@2.267 → 2@2.267 | 2@2.267 → 2@2.267 |
| hunting-rifle | 1@0.117 → 1@0.133 | 1@0.117 → 1@0.133 | 7@7.517 → 2@1.133 | 4@3.117 → 1@0.133 | 4@3.117 → 2@1.133 | 2@1.117 → 1@0.133 |
| nail-gun | 3@0.483 → 2@0.317 | 3@0.483 → 2@0.317 | 43@8.583 → 30@6.417 | 22@3.65 → 15@2.483 | 23@3.817 → 16@2.65 | 12@1.983 → 8@1.317 |
| machete | 2@0.55 → 1@0.1 | 1@0.117 → 1@0.1 | 10@4.167 → 8@2.9 | 10@4.167 → 8@2.9 | 10@4.167 → 8@2.9 | 5@1.9 → 4@1.3 |
| molotov | 2@2.15 → 2@1.15 | 2@1.15 → 2@1.15 | 4@27.25 → 3@12.217 | 4@27.25 → 3@12.217 | 3@13.217 → 2@5.15 | 3@13.217 → 2@5.15 |
| assault-rifle | 2@0.25 → 2@0.25 | 2@0.25 → 2@0.25 | 24@3.183 → 24@3.183 | 12@1.583 → 12@1.583 | 13@1.717 → 13@1.717 | 7@0.917 → 7@0.917 |
| flashbang | 4@>30 → 4@>30 | 4@>30 → 4@>30 | 4@>30 → 4@>30 | 4@>30 → 4@>30 | 4@>30 → 4@>30 | 4@>30 → 4@>30 |
| flamethrower | 10@3.117 → 2@0.45 | 7@2.117 → 2@0.45 | 73@26.783 → 18@5.783 | 60@20.117 → 12@3.783 | 43@14.117 → 10@3.117 | 34@11.117 → 7@2.117 |
