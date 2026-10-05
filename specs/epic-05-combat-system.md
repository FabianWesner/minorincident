# E05 · Combat System (two-slot directional model)

## Goal
Implement the combat core: the two action **sides** with racks, the **last-used side becomes selected** and aim rotates it, the selector cycles the selected side's rack, soft aim assist, and data-driven attack resolution for melee, projectile/hitscan, throwable, and ability actions. It also covers damage, knockback, stagger, status effects, friendly-fire rules, hit-stop, and combat events.

## Depends on / Enables
E04 / E06, E07, E15, E16, all levels.

## Scope
**In:** `ActionDef` schema; `Loadout` (LEFT/RIGHT racks of up to 3); selected-side state machine; aim per side (the remembered direction); selector; action phases (wind-up / active / recovery, cooldown, magazine/reload with infinite reserve, charges with a recharge timer); hit queries (melee arc via the spatial hash, ray or swept projectiles, splash sphere with line-of-sight); `DamageEvent` pipeline (modifiers → armor/shield direction checks → HP → stagger/knockback → death); statuses (burning, stunned, slowed, toxic); friendly fire (player 30% from own explosives, NPCs 100%); aim assist; hit-stop.
**Out:** the specific weapon tuning and visuals (E06) and the VFX (E15).

## Deliverables
`src/sim/combat/{Loadout,ActionRunner,HitQuery,Damage,Status,AimAssist}.ts`, `src/data/actions/schema.ts`, and the scenario `combat-arena` (a 30×30 m arena; dummy infected with configurable HP and armor facing).

## Bruno references
Reuse first, per the [reuse map](08-bruno-reuse-map.md). Read these before writing new code:
- [`Explosions.js`](../folio-2025/sources/Game/Explosions.js): splash impulse model
- [`Time.js`](../folio-2025/sources/Game/Time.js): bullet time for hit emphasis (optional)

## Acceptance criteria

| ID | Criterion | Verification |
| --- | --- | --- |
| E05-AC01 | Using LEFT sets `selectedSide=LEFT`; aim input then changes only LEFT's aim, and RIGHT keeps its last aim. Using RIGHT switches; the sequence from concept §5.1 (fire MG, rotate, throw grenade, rotate) produces the expected per-side aims | sim |
| E05-AC02 | The selector cycles only the selected side's rack, wraps around, takes 0.25 s (the action is unusable during the swap), and emits `loadout.switched` | sim |
| E05-AC03 | Melee: a bat swing hits every dummy inside its arc (range 1.9 m, 100°) and none outside; at most `maxTargets` are hit; damage is applied once per swing per target | sim |
| E05-AC04 | Ranged: pistol bullets respect fire rate, magazine, and reload time; reload is automatic when empty; the reserve never decreases (infinite) | sim |
| E05-AC05 | Throwable: the grenade lands within 0.3 m of the aim point when in range (clamped to max range otherwise), explodes after the fuse, damages with falloff inside the radius, and blocks damage behind full-cover walls (LOS) | sim |
| E05-AC06 | Charges: a throwable with 2 charges and a 12 s recharge cannot be used a 3rd time immediately; a charge returns at 12 s ±1 tick | sim |
| E05-AC07 | Knockback moves the target along the hit direction by the defined impulse ±10%; stagger interrupts infected attacks | sim |
| E05-AC08 | Directional armor: a Riot dummy facing the player takes 0 bullet damage from the front (±60°) and full damage from behind; explosives ignore the shield | sim |
| E05-AC09 | Statuses: burning deals the defined DoT per second for its duration, doesn't stack beyond max stacks, and is extinguished by water zones | sim |
| E05-AC10 | Friendly fire: the player's own grenade deals 30% of the base damage to the player and 100% to escorts | sim |
| E05-AC11 | Aim assist: with a target 8° off aim and in range, the shot direction snaps to it (Default setting); at 15° off it does not; with assist `Off` it never snaps | sim |
| E05-AC12 | Every attack emits `combat.attack`, `combat.hit`, `combat.kill` events with entity IDs and positions (consumed by VFX, audio, and tests) | unit |
| E05-AC13 | In the browser, a scripted mouse sequence (move cursor, LMB, RMB, wheel) in `combat-arena` produces the same per-side state as the sim test (end-to-end wiring) | e2e |
| E05-AC14 | Kill time-to-kill table: the sim measures TTK for each weapon × archetype pair and writes `test-results/balance/ttk.json`; values lie in the bands defined in `src/data/balance.ts` | sim |
