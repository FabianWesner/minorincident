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

## Campaign weapon rules (PO redesign, 2026-10-07)

The redesigned campaign ([`po-levels-2-6-2026-10-07.md`](po-levels-2-6-2026-10-07.md)) uses four story weapons; the rest of the roster stays in the catalog (tests, scenarios, later content) but is **not handed out in L1–L6** (orchestrator default — PO may change):

| Level | Weapon | Rule |
| --- | --- | --- |
| L1 | baseball bat | single target, 2 hits per 40 HP infected (E19 §5.6) |
| L2 | **fire axe** (optional pickup) | stronger than the bat: a normal frontal swing (45 damage, one hit per 40 HP infected) when fewer than 3 infected are within 2.5 m; **the same input automatically becomes a 360° roundhouse** when ≥ 3 infected are within 2.5 m (25 damage to each, 2–3 m knockback, 0.8 s stagger): it creates space, it does not wipe the crowd (E20 §5.3) |
| L3 | **handgun** (`weapon.pistol`) | first ranged weapon; single target (no pierce), 2 hits per infected, 22 m; does not replace the axe's crowd clearing (E21 §5.2) |
| L4 | **machine gun** | strongest weapon; 10 rounds/s, pierce 1, suited to groups; **unlimited ammunition** (E22 §5.3) |
| L5–L6 | — | **no new weapon**: escalation pauses; responsibility replaces firepower |

**No ammunition system** (PO): the game has no ammo counter, no reserve, no ammo pickups, and the campaign handgun and machine gun never reload or overheat (orchestrator default: the fire rate is the only limit — PO may change this to a cosmetic reload rhythm). Consequences for this epic: the `magazine` / `reloadTime` fields and the `magazine` / `reloadTime` upgrade hooks remain in `ActionDef` for compatibility, but campaign weapons are configured bottomless; `pick.*-ammo` assets are decorative only; any criterion or UI that implies ammo management is **flagged as superseded for the campaign** (E06-AC01's "sane ranges" accept a bottomless magazine). Earlier weapons stay carried and selectable when a new one is acquired (00 §5.3 weapon cycling).

The testable criteria for these rules live in the level epics (still `todo`) so this `done` epic's traceability stays intact: axe roundhouse **E20-AC10**, handgun **E21-AC04/AC05**, gunfire loud events **E21-AC06**, machine gun and unlimited ammo **E22-AC06**, the L5/L6 weapon pause **E23-AC12 / E24-AC05**.

## Acceptance criteria

| ID | Criterion | Verification |
| --- | --- | --- |
| E06-AC01 | Every roster action exists in `src/data/actions/*.ts` and validates against the schema (no missing fields, sane ranges) | unit |
| E06-AC02 | Every action is usable on either side: an automated test equips each action on LEFT, then on RIGHT, uses it in `combat-arena`, and observes at least one `combat.hit` for damage/status actions; utility actions (lures, smoke, shield, adrenaline) emit `combat.effect` and demonstrate their defined gameplay effect | sim |
| E06-AC03 | Role differentiation: shotgun DPS at 3 m > SMG at 3 m; SMG DPS at 12 m > shotgun at 12 m; rifle effective range ≥ 25 m; rocket splash ≥ 3.5 m | sim |
| E06-AC04 | Noise: firing a pistol alerts idle infected within 25 m (`ai.alerted` with cause `noise`); a melee kill alerts only within 6 m | sim |
| E06-AC05 | Molotov creates a fire zone (4 m radius, 6 s) that applies burning and blocks infected pathing preference (they route around it when possible) | sim |
| E06-AC06 | Firecracker lure pulls infected within 15 m to its position for 5 s | sim |
| E06-AC07 | Pickup: walking over a weapon pickup adds it to the selected side's rack; with a full rack it replaces the current action and drops the old one as a pickup | sim |
| E06-AC08 | Each action has an icon and a view asset ID in the manifest (placeholder allowed), and the in-hand model attaches to the correct socket (the socket world position is within 0.05 m of the hand node) | unit/e2e |
| E06-AC09 | Aim indicators: line (ranged), cone (melee), arc + landing circle (throwable) render for the selected side only (screenshot in `combat-arena`, one per category) | visual |
| E06-AC10 | TTK table regenerated (E05-AC14) with all damaging roster actions, within bands; non-damaging utility/status actions have role-effect tests rather than a fictitious kill time | sim |
