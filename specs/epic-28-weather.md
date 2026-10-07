# E28 · Weather

## Goal
A weather system that changes how levels **look, sound, and play**. The states are sun, clouds, overcast, fog, rain, thunderstorm, wind, **snow**, and **ash fall**. They are scripted per level to support the story, drive the lighting (E25), the acoustics (E16), and the physics (E09, E26), and they have systemic gameplay effects. Bruno's `Weather.js`, `RainLines.js`, `Snow.js`, `Lightnings.js`, and `Wind.js` are the base.

## Weather script (campaign, one late-summer day)

| Level | Weather timeline | Story / gameplay purpose |
| --- | --- | --- |
| L1 | clear sun, light breeze | the perfect normal morning |
| L2 | clear midday sun, light gusts | organized help, then the rescue collapses |
| L3 | hazy late afternoon; **smoke haze** and gusts carrying ash | the city visibly collapsing |
| L4 | **perfectly clear** late afternoon (false safety); smoke builds from the battle | the safe city, then war |
| L5 | still air at sunset, **light ash fall** and embers drifting from the fires | silent aftermath |
| L6 | none underground (tunnel haze only); light **ground fog** at the night exit | confinement, then the open night |

> Rows rewritten for the PO's Level 2–6 redesign (2026-10-07). Weather is optional in the redesigned campaign: rain and the thunderstorm are no longer scheduled in a level (they remain in `weather-lab`, `storm-street` and the replay override) — orchestrator default, PO may change.

**Snow:** the campaign day is late summer, so snow is not in the main story. It is available as a **weather override** when replaying completed levels (level select) and in the photo mode (decision W1, changeable). L5's ash fall reuses the snow system (gray-white flakes, ash accumulation on surfaces).

## Systemic effects (data-driven, deterministic sim state)

| Weather | Gameplay | Visual | Audio |
| --- | --- | --- | --- |
| Clear | — | crisp shadows | birds (tier-dependent) |
| Overcast | — | soft shadows, lower sun intensity | muted ambience |
| Wind / gusts | Molotov fire spreads downwind (+40%); smoke drifts; light props wobble or roll in strong gusts | wind lines, foliage and grass bend, flags, debris | wind beds, gust one-shots |
| Rain | noise radii ×0.8 (rain masks sound); fire zones last ×0.6 and spread slower; vehicle grip ×0.85 | rain streaks, splashes, **wetness accumulates** (reflections, E25), puddles grow, characters get a wet sheen | rain bed by intensity, rain on metal and cars, wet footsteps |
| Thunderstorm | + lightning: a flash briefly reveals all infected within 40 m (minimap ping, 0.5 s); scripted strikes on tall props (transformers, trees) cause fires or blackouts; infected sight ×0.85 | lightning flash (light-field + sky flash, exposure pump capped by flash reduction), bolts | thunder delayed by distance (340 m/s) |
| Fog | infected sight ×0.6 and the player's view range reduced; telegraph sounds become more important | height fog, strong lit haze around lights (E25) | damped high frequencies, closer reverb |
| Snow (override) / ash fall (L5) | **footprints** of the player and infected (tracks reveal infected paths); vehicle grip ×0.6 (snow) / ×0.9 (ash); player speed ×0.95 (snow) | flakes, accumulation on up-facing surfaces (roofs, cars, ground), breath vapor (snow) | muffled acoustics (reverb damping), crunchy footsteps (snow) |

Weather never hides the player: precipitation and fog are dithered near the camera-to-player ray, and the player keeps their readability rim (E25 night rules).

## Scope
**In:**
- `WeatherSystem` in the sim (state + timeline keyframes per level, seeded random gusts and lightning, wetness and accumulation values) with a render view: rain lines, splashes, puddle growth, snow and ash particles, accumulation masks in `PaletteMaterial`, lightning bolts and flashes, height fog, wind lines.
- Coupling to E25 (sun intensity, shadow softness, wetness → reflections, fog → lit haze, lightning → light field), E16 (rain, thunder, wind, damping), E09/E26 (grip, gust forces on light props), E27 (fire and smoke modifiers, wind drift), and E07 (sight modifiers).
- The weather override UI in level select and the photo mode.
- Quality tiers.
- Scenarios `weather-lab` (cycles every state) and `storm-street`.

## Bruno references
Reuse first, per the [reuse map](08-bruno-reuse-map.md). Read these before writing new code:
- [`Weather.js`](../folio-2025/sources/Game/Weather.js): weather properties, overrides, update (port as the view-side base; the state moves into the sim)
- [`World/RainLines.js`](../folio-2025/sources/Game/World/RainLines.js): GPU rain lines
- [`World/Snow.js`](../folio-2025/sources/Game/World/Snow.js): snow particles and ground snow with tracks (port; recolor for ash)
- [`World/Lightnings.js`](../folio-2025/sources/Game/World/Lightnings.js): lightning anticipation, arcs, flashes
- [`Wind.js`](../folio-2025/sources/Game/Wind.js) and [`World/WindLines.js`](../folio-2025/sources/Game/World/WindLines.js): wind uniform and streaks
- [`Tracks.js`](../folio-2025/sources/Game/Tracks.js): footprints and tire tracks in snow, ash, and wet ground
- [`Cycles/YearCycles.js`](../folio-2025/sources/Game/Cycles/YearCycles.js): season and weather cycling (pattern for the timelines)
- [`Physics/PhysicsVehicle.js`](../folio-2025/sources/Game/Physics/PhysicsVehicle.js): ice-ratio wheel friction (grip modifiers)
- [`World/WaterSurface.js`](../folio-2025/sources/Game/World/WaterSurface.js): rain ripples on water

## Acceptance criteria

| ID | Criterion | Verification |
| --- | --- | --- |
| E28-AC01 | Weather is sim state: the same seed gives an identical weather timeline (gusts, lightning times, wetness curve) in Node and the browser; each level's timeline matches its script table (state at key ticks) | sim |
| E28-AC02 | Rain modifiers: during rain, pistol noise radius = 25 × 0.8 m; Molotov fire zone duration × 0.6; vehicle grip × 0.85 (sim values via `getState().weather.modifiers`) | sim |
| E28-AC03 | Wetness: wetness rises during rain (0 → ≥ 0.8 within 60 s of heavy rain) and dries afterwards (half-life 90 s); the E25 wet mask follows, so reflection streaks appear only when wetness > 0.3 (visual check at both states) | sim/visual |
| E28-AC04 | Lightning: each strike emits `weather.lightning` with a position; a flash reveals infected within 40 m on the minimap for 0.5 s; thunder plays delayed by distance / 340 m/s (±50 ms); the flash luminance respects flash reduction | sim/e2e |
| E28-AC05 | Fog: infected sight × 0.6 in fog (perception test from E07-AC02 repeated); the player stays readable (contrast ≥ 3:1 vs the 2 m ring) | sim/visual |
| E28-AC06 | Wind: Molotov fire spread is biased downwind (≥ 60% of the new fire cells downwind over 20 trials); light props drift in strong gusts; smoke columns bend in the wind direction (column top offset aligns with wind ±20°) | sim/visual |
| E28-AC07 | Snow / ash: the player and infected leave footprints (track texture coverage grows along their paths); accumulation on up-facing surfaces reaches visible coverage (≥ 60% of the roof and car-top pixels whitened in `weather-lab`); vehicle grip modifiers apply | visual/sim |
| E28-AC08 | Override: completed levels can be replayed with any weather from level select; the override changes only the weather, not mission logic (graph walk passes with every override) | e2e/sim |
| E28-AC09 | Audio coupling: rain bed level follows intensity; snow and fog apply reverb damping (offline render RT60 shorter than clear); wind gust one-shots fire with gusts (event → cue log) | e2e (offline) |
| E28-AC10 | Performance: the heaviest weather (the storm in `storm-street`, ash at the L5 `pair-plaza`) stays within the E18 budgets (rain/snow particles: 20k high / 6k low) | perf |
| E28-AC11 | Readability: precipitation within 6 m of the camera-to-player ray is dithered; the HUD weather icon shows the current state | visual/e2e |
| E28-AC12 | Vision: `weather-lab` frames for clear, overcast, golden-hour haze, storm, fog, and snow pass checklist G (lighting) + a weather-mood check against `initial-drafts/weather-and-time-of-day-moods.png` | vision |
