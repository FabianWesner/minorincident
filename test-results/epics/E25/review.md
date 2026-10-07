# E25 increment 1 (lighting-core): agent self-review

Agent pre-check only; the orchestrator owns the vision review. Screenshots are game-camera (follow) frames at 1600x900,
headless WebGL2 on the Mac's GPU, L1's town (D-GROVE) at the lamp corner (62.2, -1.4) with six runners and a pistol
pickup. References: `initial-drafts/weather-and-time-of-day-moods.png`, `initial-drafts/explosions-fire-smoke-and-lighting-fx.png`.

| Preset | File | Used by |
| --- | --- | --- |
| L1 late morning | `mood-L1.png` | L1 |
| L2 midday | `mood-L2.png` | L2 (was L1 before this lane) |
| L3 afternoon | `mood-L3.png` | L3 |
| L4 golden hour | `mood-L4.png` | L4 |
| L5 dusk | `mood-L5.png` | L5 (was golden before this lane) |
| L6 night (fires) | `mood-L6.png` | L6 |
| night | `mood-night.png` | `night-street`, L4 night segments through the mission `timeOfDay` action |

Night-specific frames: `night-street.png` plus `night-street-player-mask.png` (AC13) and `hero-shadow.png` (AC06).

## Checklist G: Lighting (L5, L6, night)

- [must] Light sources glow and cast visible light: **PASS**. The sodium lamps bloom and leave warm pools on the pavement and road. Windows, neon and fires also draw pools (303 pools in the high window at night-street).
- [must] Light respects geometry: **FAIL (partly)**. Hero shadows work: the survivor's shadow falls away from the lamp overhead (`hero-shadow.png`). Pools are not clipped by walls yet, because the visibility polygons (AC03) are deferred.
- [must] Shadows are colored, not black: **PASS**. The hero shadow is purple-blue (hue 277°, 75% darker than the lit pool beside it). Moon shadows keep the preset tint.
- [must] At night the player and threats stay readable, moody and not muddy: **PASS**. Away from every lamp the survivor scores 3.13:1 against its 2 m ring. Each runner's brightest pixel is its red eye, and the crowd keeps a faint cool rim.
- [should] Beams, haze and glints: **FAIL**. Deferred (AC09; lit haze and flares not built).
- [should] Reflections where the surface demands them: **FAIL**. Deferred (AC10/11). Cheap wet streaks were also left out, because they need a wet mask first.
- [should] The mood matches the light script (06 §2): **PASS**. L5 reads as blue-hour dusk with sodium lamps, L6 and night as cool moonlight with warm practicals.

Result: the light-pool, readability and shadow-colour musts pass; pool occlusion fails pending AC03. **Overall: not passed.**

## Checklist A / E spot checks (daylight presets)

- [must] The palette is warm and saturated, with no default-three look in L1–L4: **PASS**. The field pass is skipped in daylight (`lightPools: 0`), so L1 is pixel-identical in look to before.
- [must] Shadows are soft and tinted: **PASS** (unchanged sun shadow).
- [should] The mood per level: **PASS**. L2 is now midday white sun instead of a copy of L1, and L5 is dusk instead of golden hour.

## Readability at the game camera (lane requirement)

- The player stays readable in every preset: **PASS**. At night a survivor-only fill and rim keep it clear without lighting the ground ring.
- Infected silhouettes stay readable: **PASS**. The grazing rim and red eyes carry them at night. Hair reads as a dark mass, which is acceptable at this distance.
- Pickups stay readable: **PASS (weak)**. The pistol shows a small cool glint pool at night. The pickup model itself is tiny at every time of day (pre-existing).

## Open visual issues for the orchestrator

1. Pools leak through walls and fences (no visibility polygons yet).
2. Window pools of houses are soft circles rather than rectangular spills.
3. The night sidewalk is quite light lavender. The AC13 contrast margin is small (3.13 against 3.0).
