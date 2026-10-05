# E11 · Interactables, Hazards and Destructibles

## Goal
Make the world interactive. Doors and gates, stand-to-interact objective devices (generators, switches, levers, valves), pickups, environmental hazards (explosive propane, gas cans, car alarms, fuse boxes, fire, toxic spills, live wires), and destructible light props.

## Depends on / Enables
E05, E10 / E12, E19–E24.

## Scope
**In:**
- **`Interactable` component:** ring radius, hold time, conditions, progress that survives brief exits (decays at 2×), interruption by damage (configurable), and events.
- **Device types:** door (open/close/locked/barricade-able), generator (start + fuel), breaker/switch, lever, valve, button, radio, rescue target, car door.
- **Pickups:** health (medkit 50%, soda 15%, energy drink with a speed buff for 8 s), throwable charge refill, weapon pickups (E06), objective items (keys, fuse, batteries).
- **Hazards:** explosive barrel or propane (HP, explodes with splash, chains), gas can (leaks a flammable trail when shot), car alarm (a 20 m noise lure for 10 s when hit), fuse box (shot → electrifies water or metal fences for 5 s), fire zones (spread on flammable props), toxic spill.
- **Destructibles:** fences, crates, barricades, cones, trash cans, mailboxes, glass storefronts. Each has HP and debris (pooled physics pieces with a lifetime).

**Note:** movable physics props and barricades are specified in **E26**; explosion and smoke behavior and visuals in **E27**. E11 provides the hazard and interactable logic they plug into.

## Bruno references
Reuse first, per the [reuse map](08-bruno-reuse-map.md). Read these before writing new code:
- [`InteractivePoints.js`](../folio-2025/sources/Game/InteractivePoints.js): interaction points (adapt to stand-to-interact)
- [`World/ExplosiveCrates.js`](../folio-2025/sources/Game/World/ExplosiveCrates.js): explosive hazards
- [`RayCursor.js`](../folio-2025/sources/Game/RayCursor.js): hover highlight
- [`Objects.js`](../folio-2025/sources/Game/Objects.js): destructible light props

## Acceptance criteria

| ID | Criterion | Verification |
| --- | --- | --- |
| E11-AC01 | Stand-to-interact: progress fills at 1/holdTime per second inside the ring, decays at 2× outside, completes exactly once (`interact.completed`); `E` or a middle-click completes it instantly where allowed | sim |
| E11-AC02 | Taking damage interrupts devices flagged `interruptOnDamage` (progress resets to the last 25% notch) | sim |
| E11-AC03 | Locked door requires its key item; the attempt shows a `locked` hint; with the key it opens and the nav grid updates within 1 tick (infected path through) | sim |
| E11-AC04 | Explosive propane: HP 0 → explosion (radius 5 m) after a 0.3 s fuse; chain-reacts to another propane 4 m away; damages infected, the player (30%), and props | sim |
| E11-AC05 | Car alarm hit → `noise` at 20 m for 10 s; infected within range retarget to the car | sim |
| E11-AC06 | Fire spreads from a fire zone to adjacent flammable props within 3 s (wooden fence, crates) and burns out after the prop's burn time | sim |
| E11-AC07 | Destructible fence takes melee damage, breaks into ≤ 8 debris pieces that despawn after 8 s, and opens the nav cells it blocked | sim |
| E11-AC08 | Pickups apply their effects exactly and emit `pickup.collected`; health never exceeds max | sim |
| E11-AC09 | Interaction ring and progress UI render on top of the world and are readable in every tier (screenshot spot `interact-ui` at W0 and W5) | visual |
