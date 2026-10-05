# E27 · Explosions, Fire and Smoke

## Goal
Make explosions, fire, and smoke the **most spectacular moments** of the game, and also systemic gameplay: data-driven `ExplosionDef`s with the seven-beat blast anatomy, chain reactions, car and mega explosions, fire spread, and smoke that blocks sight, marks the burning town, and is lit by the light field. Concept: [07-physics-props-explosions-smoke.md](07-physics-props-explosions-smoke.md) §5–6. Light coupling: [06](06-lighting-shadows-reflections.md). Particle and decal infrastructure: E15.

## Depends on / Enables
E05, E11, E15, E25, E26 / E21–E24 (L3+ hazards, the L5 gas station, the L6 fuel truck).

## Scope
**In:**
- `ExplosionDef` (damage curve, radius, impulse, upward bias, statuses, barricade and prop damage, chain delay) and `BlastFxPreset` for the classes small, medium, large (car), mega, toxic, and incendiary.
- The seven beats:
  - tell telegraphs
  - flash (light-field flash + hero light + capped exposure kick)
  - TSL fireball (instanced noise spheres with a fire gradient)
  - shockwave (high-tier screen refraction ring, ground dust ring, grass flattening, window shatter)
  - debris sparks and burning fragments
  - smoke column
  - aftermath (scorch decals, persistent small fires, burned variant swaps)
- Camera shake + roll kick + mega slow-motion (sim time-scale event, setting toggle).
- Chain reactions (capped).
- Car explosions (body jump, detached doors and hood as physics parts, burning-wreck swap).
- The mega-explosion sequencer (L5 gas station, L5 bridge charges, L6 fuel truck).
- Fire: flames (instanced flame cards + core glow), embers, heat haze (high tier), fire spread on flammables (with E11), building fires per decay tier.
- Smoke types:
  - columns (stacked puffs, wind-bent, visible from far, shadow strips)
  - clouds and dust
  - **smoke grenade** (new throwable)
  - fire extinguisher prop
  - steam, toxic gas, tear gas
  - exhaust and tire smoke
- **Smoke gameplay** (sight blocking, toxic DoT, tear-gas slow).
- Smoke lighting from the light field.
- The readability rule (camera-near dither + player rim when occluded).
- Scenarios `blast-lab`, `fire-lab`, `smoke-lab`.

## Bruno references
Reuse first, per the [reuse map](08-bruno-reuse-map.md). Read these before writing new code:
- [`Explosions.js`](../folio-2025/sources/Game/Explosions.js): impulse + roll kick + bullet time (port)
- [`World/Fireballs.js`](../folio-2025/sources/Game/World/Fireballs.js): TSL triplanar-noise fireball (port + extend)
- [`World/ExplosiveCrates.js`](../folio-2025/sources/Game/World/ExplosiveCrates.js): arming tell + contact trigger
- [`Time.js`](../folio-2025/sources/Game/Time.js): bulletTime → mega slow-mo
- [`World/Lightnings.js`](../folio-2025/sources/Game/World/Lightnings.js): anticipation and explosion particles, arcs
- [`Tornado.js`](../folio-2025/sources/Game/Tornado.js): column pattern
- [`World/VisualTornado.js`](../folio-2025/sources/Game/World/VisualTornado.js): swirling puff visuals
- [`World/Leaves.js`](../folio-2025/sources/Game/World/Leaves.js): explode scatter
- [`Wind.js`](../folio-2025/sources/Game/Wind.js): smoke drift
- [`Noises.js`](../folio-2025/sources/Game/Noises.js): noise textures
- [`World/Confetti.js`](../folio-2025/sources/Game/World/Confetti.js): debris bursts

## Acceptance criteria

| ID | Criterion | Verification |
| --- | --- | --- |
| E27-AC01 | Every `ExplosionDef` and `BlastFxPreset` validates; every explosive prop, throwable, and scripted blast references one | unit |
| E27-AC02 | Damage and impulse: for each class the sim damage at 0 / 50% / 100% radius matches the curve (±2%); the radial impulse has an upward bias and is applied 1 tick later (shared with E26-AC05) | sim |
| E27-AC03 | Seven beats: a frame sequence of a medium explosion in `blast-lab` (captured at fixed sim ticks: t=0, 2, 6, 15, 40, 180, 900) shows flash, fireball, shockwave ring, debris, smoke column, and scorch decal in order (per-frame detectors: luminance spike, fire-hue area, ring radius growth, gray-area growth, decal presence) | visual |
| E27-AC04 | Chain reaction: 5 propane tanks 3 m apart explode in sequence with 0.15–0.3 s per link (event timestamps); the chain cap holds (≤ 8 links/s) | sim |
| E27-AC05 | Car explosion: the car body gets an upward impulse (it rises ≥ 0.5 m), ≥ 2 parts (doors, hood) detach as physics bodies, and the car swaps to its burned variant; a smoke column persists ≥ 20 s | sim/visual |
| E27-AC06 | Mega explosion (gas station): the scripted chain plays pump → canopy → tanks, kills ≥ 80% of the infected in 12 m (shared with E23-AC06), tints the town-wide light field for 5 s, and triggers slow-motion only if the player is within 15 m (and the setting is on) | sim/e2e |
| E27-AC07 | Flash reduction: with the setting on, the full-screen luminance delta per frame stays ≤ 20% during every explosion class (shared metric with E15-AC08) | visual |
| E27-AC08 | Smoke grenade: infected inside the 6 m cloud lose their target (`ai.lostTarget`) within 0.5 s and wander; the effect ends when the cloud dissipates (12 s ±1 tick) | sim |
| E27-AC09 | Toxic and tear gas: toxic deals the defined DoT to non-Hazmat infected and the player; tear gas slows infected by 30% and the player by 15% while inside | sim |
| E27-AC10 | Fire extinguisher prop: shot or kicked → a burst that extinguishes fire zones within 3 m and stuns infected in its cone for 1 s | sim |
| E27-AC11 | Smoke is lit: at night in `smoke-lab`, the lower third of a column above a fire has a mean hue of 15–45° (orange) and is ≥ 2× brighter than the top third; under a siren the smoke luminance oscillates in sync with the strobe | visual |
| E27-AC12 | Readability: when a smoke cloud covers the player, the player rim silhouette is visible (player mask contrast ≥ 2:1); smoke within 6 m of the camera ray to the player is dithered to ≤ 40% opacity | visual |
| E27-AC13 | Columns as landmarks: in L6 `l6-overview`, ≥ 5 smoke columns are visible and rise above the building tops; column shadow strips appear on the ground in the sun/moon direction | visual/vision |
| E27-AC14 | Budgets: `blast-lab` mega + chain stays within the particle caps (6k/2k), debris caps, and perf budgets; pools return to baseline 30 s after the last blast | perf |
| E27-AC15 | Vision **checklist H (explosions, fire and smoke)** passes for `blast-lab` (medium, car, mega), `fire-lab` (building fire at night), `smoke-lab` (smoke grenade, column) and the L5 `l5-gas-station-mega` spot | vision |
