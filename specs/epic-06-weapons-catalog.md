# E06 · Weapons, Throwables and Abilities Catalog

## Goal
Fill the combat system with the full action roster, delivered in increments per milestone. Each action is pure data plus a view (model, animation, VFX and SFX hooks, HUD icon).

## Roster

| Increment | Short range | Long range | Throwable | Ability |
| --- | --- | --- | --- | --- |
| **M1** | fists, kick, bat, crowbar, machete, knife | — | — | — |
| **M2** | nail bat, shovel, police baton | pistol, shotgun, nail gun, SMG, hunting rifle | frag grenade, Molotov, pipe bomb, firecracker lure, smoke grenade (E27) | corgi lure |
| **M3** | fire axe, katana | assault rifle, machine gun, rocket launcher | flashbang | ground slam, shield bubble, adrenaline, turret |

Each `ActionDef` has: `id, category, side-agnostic flag, damage, range, arc|spread, fireRate|swingTime, windup/active/recovery, magazine, reloadTime, charges, recharge, projectile{speed, gravity, pierce}, splash{radius, falloff}, knockback, stagger, status, noiseRadius, aimIndicator, tier, upgradeHooks, viewAssetId, iconId`.

## Scope
**In:** all `ActionDef`s, the action views (held model on `weaponSocketR/L`, muzzle and tip sockets), a pickup entity for weapons found in levels (it auto-adds to the selected side's rack, or replaces the current action when the rack is full and shows the replaced item as a drop), and the noise model (gunshots attract infected).
**Out:** the upgrade effects themselves (E13 applies the modifiers through `upgradeHooks`).

## Bruno references
Reuse first, per the [reuse map](08-bruno-reuse-map.md). Read these before writing new code:
- [`World/ExplosiveCrates.js`](../folio-2025/sources/Game/World/ExplosiveCrates.js): arming → explode flow for throwables
- [`Trails.js`](../folio-2025/sources/Game/Trails.js): tracer ribbons
- [`World/Fireballs.js`](../folio-2025/sources/Game/World/Fireballs.js): rocket and grenade blasts

## Acceptance criteria

| ID | Criterion | Verification |
| --- | --- | --- |
| E06-AC01 | Every roster action exists in `src/data/actions/*.ts` and validates against the schema (no missing fields, sane ranges) | unit |
| E06-AC02 | Every action is usable on either side: an automated test equips each action on LEFT, then on RIGHT, uses it in `combat-arena`, and observes at least one `combat.hit` | sim |
| E06-AC03 | Role differentiation: shotgun DPS at 3 m > SMG at 3 m; SMG DPS at 12 m > shotgun at 12 m; rifle effective range ≥ 25 m; rocket splash ≥ 3.5 m | sim |
| E06-AC04 | Noise: firing a pistol alerts idle infected within 25 m (`ai.alerted` with cause `noise`); a melee kill alerts only within 6 m | sim |
| E06-AC05 | Molotov creates a fire zone (4 m radius, 6 s) that applies burning and blocks infected pathing preference (they route around it when possible) | sim |
| E06-AC06 | Firecracker lure pulls infected within 15 m to its position for 5 s | sim |
| E06-AC07 | Pickup: walking over a weapon pickup adds it to the selected side's rack; with a full rack it replaces the current action and drops the old one as a pickup | sim |
| E06-AC08 | Each action has an icon and a view asset ID in the manifest (placeholder allowed), and the in-hand model attaches to the correct socket (the socket world position is within 0.05 m of the hand node) | unit/e2e |
| E06-AC09 | Aim indicators: line (ranged), cone (melee), arc + landing circle (throwable) render for the selected side only (screenshot in `combat-arena`, one per category) | visual |
| E06-AC10 | TTK table regenerated (E05-AC14) with all roster actions, within bands | sim |
