# 07 · Movable Objects, Barricades, Explosions and Smoke

> **The town is a toy box that becomes a fortress.** Everything light enough to move, moves: cones fly, carts roll, benches tip, and car doors swing. You can push, kick, and blast those objects, and you can **brace them into barricades** that the hordes have to tear through. Explosions are the loudest, brightest, and most physical moments in the game, and smoke shows how much of the town is still burning.

This is the concept. The implementation epics are [E26 Physics props and barricades](epic-26-physics-props-and-barricades.md) and [E27 Explosions, fire and smoke](epic-27-explosions-fire-smoke.md).

## 1. Reference: what Bruno does (folio-2025)

- `Objects.js` + `Physics.js`: visual node + optional Rapier body. Bodies start **sleeping**; `friction` and `restitution` come from the GLB `userData` (Blender custom properties). Objects that fall through the floor are reset. `resetAll()` restores the initial state.
- `Bricks.js`, `Benches.js`, `Fences.js`, `Lanterns.js`, `ExplosiveCrates.js`: **instanced** dynamic props (`InstancedGroup`); instance matrices update only while the body is awake.
- `ExplosiveCrates`: a contact triggers an arming click, then after 0.4 s an explosion, a fireball, and the crate is disabled.
- `Explosions.explode(coords, radius, strength)`: a radial impulse with an **upward bias**, scaled by mass and linear falloff, applied one tick later; a camera **roll kick** by distance; leaves blown out; bullet-time when the vehicle is hit hard.

We keep all of this (sleeping instanced dynamics, physics values from Blender extras, delayed radial impulse with upward bias, camera kick) and **add gameplay**: props as weapons, props as obstacles, and props as barricades.

## 2. Movable object classes

| Class | Examples (drafts) | Player | Vehicle | Infected | Explosion |
| --- | --- | --- | --- | --- | --- |
| **Light** (≤ 15 kg) | cones, trash cans, recycle bins, mailbox (pole-mounted ones break off), chairs, folding chairs, boxes, coolers, flamingos, sandbag (single), basketballs, bikes, wagons | walking into it **nudges** it; **kick** launches it (it becomes a projectile) | flies away | the crowd shoves it aside | flies far |
| **Medium** (15–150 kg) | shopping carts, benches, picnic tables, crates, oil drums, propane tanks, lockers, vending carts, sofas, porta-potty (tips over), gas cans, pallets, school desks | **push** by walking into it (the player slows to 55%), **brace** into barricades | pushed | pushes it slowly when blocked (≥ 4 infected) | tumbles |
| **Heavy** (150–2000 kg) | dumpsters, jersey barriers, vending machines, cars (parked), cargo containers (small) | **push** only with the shoulder-push upgrade (player speed 25%); otherwise fixed | **ram-pushed** | only Brutes/Armored can shove it | shifts or flips (cars) |
| **Fixed** | houses, walls, lamp posts, trees, hydrants (breakable → water jet), bus shelters | — | stops the vehicle | — | (scripted destruction only) |

All dynamic props are **deterministic sim objects** (Rapier in the fixed-step sim). Visuals are instanced and follow only while awake.

## 3. Props as weapons and tools

- **Kick** (the L1 RIGHT action, and an action all game long): launches light props along the aim (impulse 6 m/s + 2 m/s up). A prop that hits an infected at > 4 m/s deals momentum damage (`mass × speed × k`) and knocks it down. **Kicking a cone into a runner is the first "aha" in L1.**
- **Cart ramming:** pushing a shopping cart at full speed into a group knocks down the front row.
- **Rolling drums and propane:** knock a propane tank over and kick it into a crowd, then shoot it.
- **Vehicle bulldozing:** cars push and launch props; heavy props stop cars (E09).
- **Explosive launch:** explosions throw props, and the props deal secondary damage (capped per prop, never more than the explosion itself).

## 4. Barricades: building defenses without an inventory

Barricades follow the "seconds to learn" pillar: **push stuff into a gap, stand still, and it braces.**

### 4.1 Barricade slots

Level designers place **barricade slots** in TypeScript gameplay data (`src/levels/districts/*.ts`, the hybrid layout decision): doorways, windows, fence gaps, alleys, and street narrows. A slot is a line segment with a required **coverage** (width × height). Its ghost outline (dashed white with an icon) appears when the player is within 8 m during build-friendly moments (prep phases, hold-outs) or always in the build-tutorial segment.

### 4.2 Filling and bracing

1. Push or kick movable props into the slot. Each prop contributes **coverage** from its footprint projected onto the slot line (a prop data field `barricadeValue` can scale it: a sofa covers more than a chair).
2. At **≥ 80% coverage**, the slot turns yellow and **stand-to-interact** shows "Brace" (1.5 s; `E` or middle-click for an instant brace).
3. Bracing turns the props into one **barricade entity**: the bodies become kinematic/fixed, the HP is the sum of the props' `barricadeHP`, it blocks navigation (the nav grid updates), and planks/straps appear between the props as a visual "bracing" overlay.
4. **Board-up points** (windows and doors with a nearby plank stack): stand-to-interact for 2 s builds a plank barricade without pushing anything (L2 Mrs. Alvarez's house, L5 houses).
5. **Car barricade:** park a car across a slot, exit, and brace (the car counts as 100% coverage, with HP = car HP × 2).
6. **Sandbags:** a sandbag pallet is a pushable heavy object that braces to a low wall (infected vault over it slowly; it blocks bullets for the player behind it: cover).

### 4.3 How infected deal with barricades

- They path around if a detour is ≤ 1.5× the length; otherwise they **attack the barricade** (DPS per archetype; Brutes deal 5× damage, the Butcher 8×; Bloated explosions deal splash damage).
- Low barricades (< 0.9 m: sandbags, benches, carts) can be **vaulted** by runners and sprinters (1.2 s vault, vulnerable), but not by crawlers or heavies.
- A damaged barricade shows cracks, shakes on hits, and loses props. At 0 HP it **breaks**: the props become dynamic again and are flung inward (good physics drama), and the nav grid reopens.
- Repair: stand-to-interact on a damaged barricade restores 25% of its HP per 2 s (with no props needed), so the player trades shooting time for repairs.

### 4.4 Where barricades matter

| Level | Use |
| --- | --- |
| L1 | Tutorial moment: kick cones, push a cart, then a store door slot (optional), bracing the hardware store's back door to stop runners while you grab the weapon |
| L2 | Mrs. Alvarez's house (board-up), the gym hold-out (push lockers and benches into the gym doors before the Brute breaks through: it breaks them, but the barricade buys time) |
| L3 | Optional: block a side street with a car to stop sprinters following the route |
| L4 | The substation: brace the gates while restarting breakers |
| **L5** | **Core mechanic:** each fallback position has a **20 s prep phase** with 3–5 slots and plenty of props (carts, cars, sandbags, dumpsters); barricades decide how the waves flow; the gas station mega-hazard can be "baited" by funneling infected with barricades |
| L6 | The helipad final stand: crates, sandbag pallets, and the wrecked fire engine as anchors |

## 5. Explosions: the anatomy of a stunning blast

Every explosion is a data-driven `ExplosionDef` (the sim: damage, radius, impulse, statuses, prop launch, barricade damage) plus a `BlastFxPreset` (the view). They play in **seven beats**:

| Beat | Time | Visual | Light | Physics / gameplay | Audio |
| --- | --- | --- | --- | --- | --- |
| 1. Tell | −1.5…0 s | fuse sparks, a propane hiss jet, a red-blinking beeper (pipe bomb), a glowing barrel | small flicker | telegraph decal (danger circle) | hiss, beep accelerating |
| 2. Flash | 0–60 ms | a white-yellow core sphere and a screen-space **flash** (capped by flash reduction) | light-field flash (HDR 20+) + hero point light + exposure kick | damage resolves at t=0 (sim) | crack transient |
| 3. Fireball | 0–0.8 s | a **volumetric-look fireball**: 6–20 noise-displaced instanced spheres with a TSL fire gradient (white → yellow → orange → red → black), expanding and rising, with self-occlusion darkening at the edges | fire light, flickering | — | boom body |
| 4. Shockwave | 0–0.35 s | a refraction ring (screen-space distortion, high tier), a **ground dust ring** pushing outward, grass and leaves flattened radially (light-field / tracks texture), windows shatter in the radius | — | **radial impulse with upward bias**, applied 1 tick later (Bruno), launching props, gibs, and corpses; car alarms trigger | low thump + glass |
| 5. Debris | 0.05–3 s | physics chunks (props' debris sets + generic rubble), spark streaks with trails, burning fragments, gore gibs (gore setting) | burning fragments emit small fire lights for 2 s | debris can deal minor damage | debris rattle |
| 6. Smoke | 0.3–25 s | a **rising smoke column** lit from below by the dying fire (orange underside, gray top), drifting with the wind; a dust cloud at ground level | the fire light fades over 2 s | smoke blocks infected sight (§6) | roar decay |
| 7. Aftermath | to the end of the level | a scorch decal, small persistent fires (on flammables), smoldering embers, a burned variant swap for cars and props | ember glow | fire zones (E11) | ringing: a tinnitus low-pass if the player was within 4 m (setting) |

**Camera:** shake scaled by distance and size, plus a **roll kick** (Bruno) and, for mega blasts within 15 m of the player, **dramatic slow-motion** at 0.35× for 0.6 s. The slow-motion is a sim time-scale event, so it stays deterministic and is skippable in settings.

**Explosion classes:**

| Class | Sources | Radius | Look |
| --- | --- | --- | --- |
| Small | frag grenade, pipe bomb, firecracker finale, gas can | 3.5–4.5 m | compact fireball, lots of sparks |
| Medium | propane tank, oil drum, rocket | 5–6 m | big fireball, a mushroom puff, debris |
| Large | a car explosion, a fuel tank | 7 m | the car **jumps** (impulse on the car body), its doors and hood fly off as physics parts, burning wreck swap, a long smoke column |
| Mega | the gas station (L5), the bridge charges (L5 twist), the L6 fuel truck | 12–20 m | a multi-stage chain (pump → canopy → tanks), a mushroom cloud, the sky glows orange, a town-wide light-field tint for 5 s |
| Toxic | Bloated burst, hazmat tanks | 3–4 m | green-yellow gas burst instead of fire, a lingering toxic cloud (damage over time) |
| Incendiary | Molotov | 4 m | a liquid fire splash spreading along the ground, fire zone |

**Chain reactions:** explosions damage other explosives in their radius. Chains are deterministic and delayed by 0.15–0.3 s per link (readable "ripple"). There is a cap of 8 chain links per second.

## 6. Smoke: atmosphere, landmark, and gameplay

| Smoke type | Source | Look | Gameplay |
| --- | --- | --- | --- |
| **Columns** | burning buildings and cars (W3–W5), explosion aftermath | tall, wind-bent, **visible from far away** above everything, lit orange from fires below, darker at the top; they cast soft shadow strips on the ground in the sun direction | **landmarks**: the town's burning areas read on the horizon; at W4–W5 the sky is hazy |
| **Clouds** | explosions, collapses (dust), vehicle crashes | thick, rolling, quick to dissipate (5–10 s) | block sight briefly |
| **Smoke grenade** (new throwable, M2) | the player | thick white-gray cloud, 6 m, 12 s | **infected inside lose track of the player**; an escape tool |
| **Fire extinguisher** (a movable prop) | shooting or kicking it | a white burst + spin-off jet, knocks back | extinguishes fire zones within 3 m, stuns infected for 1 s |
| **Steam** | burst pipes and hydrants (W3+) | white, fast-rising | cosmetic + wets the ground (reflections, E25) |
| **Toxic gas** | hazmat, Bloated | green-yellow, low, creeping | damage over time, the Hazmat infected are immune |
| **Tear gas** | abandoned police canisters (L3, L4 checkpoint) | pale yellow-white | slows infected by 30% and the player by 15% |
| **Exhaust, tire smoke** | cars accelerating hard, handbrake drifts | short puffs | cosmetic |

**Rendering:**
- **Soft particles** (depth fade) with procedural TSL noise (no texture assets).
- **Lit by the light field** (fires, floodlights, and sirens tint smoke: orange from below, red/blue pulses from police bars), plus a sun term with fake normals from the noise gradient, so smoke looks volumetric.
- **Wind-driven** (Bruno's wind uniform).
- Large columns are built from stacked instanced puff meshes with vertex noise.
- **Readability rule:** smoke between the camera and the player fades (camera-near dither), and when smoke covers the player, a rim silhouette shows them.
- **Smoke shadows:** columns project a soft, moving shadow strip (decal) in the sun direction, and thick clouds darken the light field under them.

## 7. Asset contract: physics extras (Blender → game)

Movable assets carry a custom property `ss_physics` on their root (exported as glTF extras; Bruno reads `friction` and `restitution` the same way), plus collider empties (`col:<name>`, with `shape` and size properties):

```jsonc
{
  "class": "medium",            // light | medium | heavy | fixed
  "mass": 35,                   // kg
  "friction": 0.6, "restitution": 0.15,
  "centerOfMass": [0, 0.3, 0],
  "pushable": true, "kickable": false,
  "barricadeValue": 1.0,        // coverage multiplier
  "barricadeHP": 250,
  "vaultable": true,            // height < 0.9 m
  "flammable": true, "burnTime": 20,
  "breakable": { "hp": 120, "debrisSet": "debris.wood-small" },
  "explosive": null,            // or { "explosion": "explosion.propane" }
  "sounds": "prop.metal-medium" // impact sound set
}
```

The validator checks: the mass is inside its class band, the colliders' AABB is within 15% of the visual AABB, the center of mass is inside the collider, and every explosive references an existing `ExplosionDef`.

## 8. Performance and determinism rules

- Props are **sleeping** by default. The awake budget is **150 bodies high / 60 low**. When over budget, the farthest awake props off screen are frozen (put to sleep) first.
- Debris and gibs are pooled (debris cap 120 high / 40 low) with a lifetime of 8–30 s.
- Instanced visuals update their matrices only for awake bodies (Bruno).
- All physics run inside the deterministic fixed-step sim (same Rapier build in Node and the browser). VFX particles are view-only. Debris that affects gameplay (damage) is a sim object; purely cosmetic debris (sparks, dust) is view-only.
- Smoke particle budget: 6k particles high / 2k low. Column puffs: 400 instances high / 120 low.
