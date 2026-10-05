# E04 · Survivor Controller and Character Presentation

## Goal
A responsive kinematic survivor that walks, turns, collides with the world, takes damage, dies, and respawns. It is rendered with the male or female model (placeholder first), procedural animation clips, and visible gear tiers.

## Depends on / Enables
E01, E02, E03 / E05, E09, E12, E19.

## Scope
**In:** a kinematic capsule (radius 0.35 m, height 1.4 m) using Rapier's character controller against static colliders; acceleration and deceleration; facing logic (the facing follows the selected side's aim when aiming, otherwise the move direction); health, i-frames, regen, death and respawn at a checkpoint; push-out from crowd overlaps (infected cannot pin the player completely: a 0.2 m/s minimum escape); procedural animation clips (idle, walk, run, hurt, die, swing, shoot, throw, kick, interact, enter-car); gear-tier attachments; male and female selection.
**Out:** weapons and attack logic (E05/E06) and the corgi (E08).

## Deliverables
`src/sim/entities/Player.ts`, `src/sim/locomotion/*`, `src/render/characters/{CharacterView,ProceduralAnimator,clips}.ts`, `src/data/survivor.ts`, and the placeholder survivor (capsule + head + arms with the required nodes).

## Bruno references
Reuse first, per the [reuse map](08-bruno-reuse-map.md). Read these before writing new code:
- [`Player.js`](../folio-2025/sources/Game/Player.js): input → intent split (pre/post physics)
- [`View.js`](../folio-2025/sources/Game/View.js): focus point following the player

## Acceptance criteria

| ID | Criterion | Verification |
| --- | --- | --- |
| E04-AC01 | With full move input, the player reaches 95% of 4.5 m/s within 0.15 s and stops within 0.1 s of release | sim |
| E04-AC02 | The player cannot pass through static colliders: a 200-direction sweep into a wall ring leaves the player inside it, with penetration ≤ 0.02 m | sim |
| E04-AC03 | The player slides along walls (moving diagonally into a wall keeps ≥ 60% of the tangential speed) | sim |
| E04-AC04 | Facing: during an aim hold the facing equals the aim within 1 tick; otherwise it turns toward the move direction at ≥ 720°/s | sim |
| E04-AC05 | Damage → i-frames for 0.6 s (no further damage); regen starts 4 s after the last damage at 2 HP/s | sim |
| E04-AC06 | At 0 HP: a `player.died` event, then respawn at the last checkpoint after 2.0 s with full HP; level pickups and objective progress are kept | sim |
| E04-AC07 | Surrounded by 12 infected in a ring, the player can still escape in at least one direction within 3 s using move input only (anti-pin) | sim |
| E04-AC08 | Both survivor variants load (placeholder or final), contain every required node (`03` §4), and stand 1.4 m ±0.07 tall | unit |
| E04-AC09 | Animation state follows the sim (`idle`, `run`, `hurt`, `die`, …); the clip mapping table covers every locomotion and action state with no missing-clip fallbacks in a 60 s bot run | e2e |
| E04-AC10 | Gear tier 0–4 visually differs: the turntable screenshots of tiers 0 and 4 differ by > 5% of the character's pixels, and the identity colors (red top, teal backpack) are present in every tier (color sampling) | visual |
| E04-AC11 | The character-sheet screenshot passes the **Character vision checklist** (`90` §7.2) against `initial-drafts/survivors-corgi-and-equipment.png` (when the final asset is integrated) | vision |
