# Minor Incident third-party notices

## Skinned courier pilot

`src/render/characters/library.skin.json` retargets Mesh2Motion's human base and
addon animation clips to our original courier geometry and joint contract.
Source: [Mesh2Motion/mesh2motion-app](https://github.com/Mesh2Motion/mesh2motion-app),
pinned commit `79f3f61a9852ef70234a5a4a7c13ed87f7a71833`.
The rig and animation assets use
[CC0 1.0 Universal](https://github.com/Mesh2Motion/mesh2motion-app/blob/79f3f61a9852ef70234a5a4a7c13ed87f7a71833/LICENSE-CC0.MD).
Our courier mesh is original; the offline adaptation does not redistribute
upstream tool code or optional model packs. Kick and mount/dismount use the
project's authored clips; saddle/grip/pedal contacts are solved in presentation.
Rebuild with `tools/skinpilot/retarget.ts` and the pinned external checkout.

The following source adaptations use Bruno Simon's folio-2025 (MIT,
copyright 2025 Bruno Simon):

| Reference | Local adaptation |
| --- | --- |
| `Menu.js`, `Modals.js`, `Options.js`, `sources/style/menu.styl`, `sources/style/modals.styl` (41046b5) | `src/ui/GameUI.ts`, `Settings.ts`, `ui.css` — named DOM screens, focus context, persisted settings |
| `Map.js`, `Notifications.js`, `InputFlag.js`, `World/Intro.js` (41046b5) | `src/ui/Hud.ts`, `Onboarding.ts` — reusable map pins, stable text and persisted scheme-aware prompt identity |
| `Zones.js`, `Respawns.js` (41046b5) | `src/sim/missions/Mission.ts` — volume edge latches and named checkpoint restore |
| `World/Bubble.js`, `InteractivePoints.js` (41046b5) | `src/render/npc/NpcView.ts`, `src/sim/npc/Escorts.ts` — transient bark pings, projected escort badges and proximity/leave interaction latches |
| `Notifications.js` (41046b5) | `src/ui/MissionUI.ts` — stable objective/subtitle identity, sim tick expiry |
| `Options.js`, `Audio.js` | `src/sim/progression/Save.ts` — localStorage browser boundary, with injected storage and schema validation |
| `Game.js` | `src/core/Services.ts`, `src/main.ts`, `src/Game.ts` — staged boot and injected ownership |
| `Events.js` | `src/core/EventBus.ts` — ordered callback buckets |
| `Ticker.js` | `src/core/Ticker.ts` — render ticker, with a separate fixed sim clock |
| `Physics/Physics.js` | `src/physics/Physics.ts` — Rapier service, fixed timestep and disposal |
| `Physics/PhysicsWireframe.js` | `src/render/PhysicsWireframe.ts` — debug collider buffers |
| `Debug.js` | `src/debug/Debug.ts` — query-gated Tweakpane, including production look tuning |
| `Materials/MeshGridMaterial.js` | `src/render/MeshGridMaterial.ts` — trimmed XZ grid shader |
| `ResourcesLoader.js` | `src/assets/registry.ts` — promise cache and loaders |
| `Materials.js` | `src/assets/materials.ts` — material swap by name |
| `scripts/compress.js` | `tools/assets/optimize.ts` — compression stage adapted for meshopt |
| `utilities/maths.js` | `src/core/maths.ts` — clamp and lerp |
| `Inputs/Inputs.js` | `src/input/Buttons.ts` — action sources and latched edges |
| `Inputs/Keyboard.js` | `src/input/devices/Keyboard.ts` — keys, blur release and disposal |
| `Inputs/Inputs.js` | `src/input/InputSystem.ts` — input phase, action map and schemes |
| `Inputs/Pointer.js` | `src/input/devices/Pointer.ts` — mouse events and suppression |
| `Inputs/Wheel.js` | `src/input/devices/Wheel.ts` — normalized selector direction |
| `RayCursor.js`, `Inputs/Nipple.js` | `src/input/devices/RayCursor.ts` — ground-plane ray math |
| `Inputs/Nipple.js` | `src/input/devices/Nipple.ts` — radial progress/angle, floating DOM presentation |
| `Inputs/InteractiveButtons.js`, `Inputs/Pointer.js` | `src/input/devices/Touch.ts` — touch actions and independent contact ownership |
| `Player.js` (41046b5) | `src/sim/entities/Player.ts`, `src/sim/locomotion/KinematicController.ts` — input intent before physics, survivor pose after physics |
| `View.js` (41046b5) | `src/render/View.ts` — focus, aspect adaptation, shake and cinematic blending |
| `Rendering.js`, `Viewport.js` (41046b5) | `src/render/Renderer.ts` — backend bootstrap and pixel ratio |
| `Materials/MeshDefaultMaterial.js`, `Materials.js` (41046b5) | `src/render/PaletteMaterial.ts`, `src/render/Materials.ts` — palette texture, captured tinted shadows, core shade, bounce, normalized HDR emissive |
| `Ligthing.js`, `Fog.js`, `Cycles/DayCycles.js` (41046b5) | `src/render/Lighting.ts`, `src/data/timeOfDay.ts` — visible-area sun shadows, golden-morning mood and radial two-colour fog/background |
| `Rendering.js`, `Passes/cheapDOF.js` (41046b5) | `src/render/PostFx.ts` — HDR bloom and protected tilt-shift blur (18 samples high; 6 at half resolution low) |
| `InstancedGroup.js` (41046b5) | `src/render/InstancedGroup.ts` — shared mesh batches and dirty placement updates |
| `InstancedGroup.js` (41046b5) | `src/render/CrowdView.ts` — infected rigid-part GPU batches, extended through E17 crowd helpers |
| `Zones.js` (41046b5) | `src/sim/ai/InfectedSystem.ts` — perception enter/alert transitions without singleton dependencies |
| `PreRenderer.js` (41046b5) | `src/render/PreRenderer.ts`, `src/render/GameView.ts`, `src/Game.ts` — hidden-variant shader warm-up at level load (compileAsync and a 32px render in the gameplay pass) |

| `Physics/PhysicsVehicle.js`, `Player.js` (41046b5) | `src/sim/vehicles/VehicleBody.ts`, `Vehicles.ts` — fixed-step four-wheel raycast suspension, engine taper, idle/reverse braking, low centre of mass, bounded stuck history and mass-scaled upside-down jump/roll recovery. Recovery delays use simulation ticks in place of GSAP timers; speed-scaled steering and rear handbrake grip are our arcade tuning. |
| `World/VisualVehicle.js` (41046b5) | `src/render/VehicleView.ts` — fixed-tick wheel steering/suspension smoothing, interpolated chassis roll and wheel transforms, brake lamps and emergency lamp animation |
| `Explosions.js` (41046b5) | `src/sim/combat/Damage.ts` — radial splash falloff and direction-scaled impulse, without singleton/render dependencies |
| `Explosions.js`, `Time.js` (41046b5) | `src/sim/combat/Explosions.ts` — E27 radial impulse with upward bias, mass-scaled linear falloff applied one sim tick later, bullet-time trigger by distance |
| `World/Fireballs.js`, `Explosions.js`, `Time.js` (41046b5) | `src/render/vfx/Blasts.ts`, `src/render/View.ts` — noise-dissolved TSL fireball spheres with a fire gradient, camera roll kick by distance, bullet-time ramp (MaterialX noise replaces the Perlin texture) |

| `Noises.js`, `World/Confetti.js`, `World/Leaves.js`, `Trails.js` (41046b5) | `src/render/vfx/FxPool.ts` — fixed instancing, shader burst trajectories, shared sine noise and tracer slots |

All folio-2025 adaptations above reference commit `41046b5`.

Foliage: `src/render/Foliage.ts` adapts `World/Foliage.js`, `World/Bushes.js` and `World/Trees.js`: instanced leaf cards, bent spherical normals, two-colour crowns and screen-space reveal. All trunk models and the procedural leaf-cluster SDF are original; no Bruno foliage textures or branded art are distributed.

## Bruno Simon MIT license

Copyright (c) 2025 Bruno Simon

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

## Dependencies

Three.js, Vite, TypeScript, Vitest, ESLint, typescript-eslint, Tweakpane, tsx,
pixelmatch, pngjs and DefinitelyTyped types use MIT or the permissive licenses
distributed with those packages. Rapier and Playwright use Apache-2.0.
Project dependency versions are pinned in package-lock.json. Wrangler is a
deploy-only tool invoked through npx and is not a project dependency.
glTF Transform, meshoptimizer, ndarray and pngjs use MIT.
The local PNG-only ndarray-pixels adapter avoids Sharp/libvips and its
non-permissive native dependency. Production atlases must be PNG. Basis Universal runtime transcoders bundled
by Three.js use Apache-2.0 (Binomial LLC).
No reference art, meshes, textures, or audio from folio-2025 are reused.

E10 district assembly and placement-empty batching adapt the patterns in Bruno Simon's
`World/World.js` and `References.js` (folio-2025, MIT, commit 41046b5) in
`tools/blender/sslib/layout.py`. GPU grass/wind uses the same MIT notice.

E10 also adapts `World/Grass.js` / `Wind.js` in `src/render/Grass.ts`,
`World/World.js` / `References.js` in `src/render/DistrictView.ts`, and the
`TextCanvas.js` canvas-sign pattern for fictional landmark signage (same MIT source).

## E16 audio

`src/audio/AudioRegistry.ts` and `src/audio/AudioService.ts` adapt the registry,
anti-spam, distance fade, rate variation, persistent mute, blur and focus patterns
from Bruno Simon's `Audio.js`, and the arming/variant pattern from
`World/ExplosiveCrates.js` (MIT, commit 41046b5). The original MIT notice above applies.

Recordings and original system cues share the sprite files in `public/assets/audio/`.
`assets/audio/LICENSES.md` (also shipped at `public/assets/audio/LICENSES.md`) records
every encoded file, SHA256, source URL, author, license URL and per-cue sprite segment.
Source masters and download hashes are pinned in `assets/audio/imports.json`.
Original synthesized system cues remain self-made MIT (`src/audio/synthesis.ts`).
Event stingers use excerpts of bbatv / bbatv1's **comfort in uncertainty**
(CC-BY 3.0, album attribution below). The L1 outro is one 2.5-second excerpt,
not a synthesized melody over a second completion cue. Jukebox, ice-cream and
car-radio music use **Running free** from the same album. UI taps, the low-health
percussion pulse and ringing decays reuse **Impact Sounds — Kenney**, CC0:
https://kenney.nl/assets/impact-sounds;
https://creativecommons.org/publicdomain/zero/1.0/.
Edits include excerpting, low-pass/high-pass filtering, fixed detuning and fades;
exact per-cue sources and hashes are in the segment ledgers.
Radio/PA/megaphone speech ambience reuses **Crowd Shouting/Speaking Ambience —
StarNinjas** (CC0, attribution below), with a radio-band filter. The civilian
"Hey!" is a spoken CC0 recording by mujtaba-io (listed below).
These are human speech ambience/reactions; exact authored messages are in captions.
No Bruno SFX or John Murphy music, samples or melodies are used.

All third-party recordings below were modified: excerpts, EQ, fades, loudness
normalization and Opus/AAC encoding. Their licenses apply to the audio independently
of the repository's MIT source license. Attribution also appears in the in-game
Credits & Licenses screen; both lists below are generated from the same data.

The graph uses native Web Audio and its small registry/loader instead of Howler,
as explicitly permitted by sound-design §9 for a custom graph/offline rendering.
FFmpeg is a local asset/test tool, not bundled or redistributed with the game.

<!-- credits:start (generated by tools/credits/generate.ts; shown in-game under Credits & Licenses) -->
## Runtime libraries and technology

- @dimforge/rapier3d-compat 0.21.0 — @dimforge/rapier3d-compat. Source: https://www.npmjs.com/package/@dimforge/rapier3d-compat. License: Apache-2.0 (https://spdx.org/licenses/Apache-2.0.html).
- three 0.186.0 — three. Source: https://www.npmjs.com/package/three. License: MIT (https://spdx.org/licenses/MIT.html).
- tweakpane 4.0.5 — tweakpane. Source: https://www.npmjs.com/package/tweakpane. License: MIT (https://spdx.org/licenses/MIT.html).
- folio-2025 (source patterns adapted at commit 41046b5) — Bruno Simon. Source: https://github.com/brunosimon/folio-2025. License: MIT (https://spdx.org/licenses/MIT.html). Engine, input, UI, rendering, vehicle, explosion (impulse, fireball, roll kick, bullet time) and audio patterns; no art, meshes, textures or audio reused.
- Mesh2Motion human rig and animation clips — Mesh2Motion (Scott Petrovic and contributors). Source: https://github.com/Mesh2Motion/mesh2motion-app. License: CC0 1.0 (https://creativecommons.org/publicdomain/zero/1.0/). Rig and animations retargeted to our original characters (pinned commit 79f3f61).
- meshoptimizer decoder (bundled with three.js addons) — Arseny Kapoulkine. Source: https://github.com/zeux/meshoptimizer. License: MIT (https://spdx.org/licenses/MIT.html).
- Basis Universal transcoder (public/assets/basis) — Binomial LLC. Source: https://github.com/BinomialLLC/basis_universal. License: Apache-2.0 (https://spdx.org/licenses/Apache-2.0.html).

## Recorded music and sound credits

Every recording below was modified for the game: excerpts, EQ, pitch, fades, compression, loudness normalization and Opus/AAC encoding.

- Running free; comfort in uncertainty — bbatv / bbatv1. Source: https://opengameart.org/content/peace-is-king-here. License: CC-BY 3.0 (https://creativecommons.org/licenses/by/3.0/). Files: 01 Running free_0.mp3, 09 __comfort in uncertainty 1.mp3.
- Blinding Lights — Zander Noriega (https://soundcloud.com/zander-noriega). Source: https://opengameart.org/content/blinding-lights. License: CC-BY 3.0 (https://creativecommons.org/licenses/by/3.0/). Files: Zander Noriega - Blinding Lights.wav.
- Zombies sound pack — artisticdude. Source: https://opengameart.org/content/zombies-sound-pack. License: CC0 (https://creativecommons.org/publicdomain/zero/1.0/). Files: zombie-1.wav, zombie-2.wav, zombie-3.wav, zombie-4.wav, zombie-5.wav, zombie-6.wav, zombie-7.wav, zombie-8.wav, zombie-9.wav, zombie-10.wav, zombie-11.wav, zombie-12.wav, zombie-13.wav, zombie-14.wav, zombie-15.wav, zombie-16.wav, zombie-17.wav, zombie-18.wav, zombie-19.wav, zombie-20.wav, zombie-21.wav, zombie-22.wav, zombie-23.wav.
- Zombie Sound Effects — Bendzer. Source: https://opengameart.org/content/zombie-sound-effects-by-bendzer. License: CC-BY 4.0 (https://creativecommons.org/licenses/by/4.0/). Files: Zombie Growling.wav.
- 6 Zombie Sounds — ChibiBagu. Source: https://opengameart.org/content/6-zombie-sounds. License: CC-BY 3.0 (https://creativecommons.org/licenses/by/3.0/). Files: Roar2.wav, Roar3.wav.
- Bamboo stick swooshes — qubodup. Source: https://opengameart.org/content/swish-bamboo-stick-weapon-swhoshes. License: CC0 (https://creativecommons.org/publicdomain/zero/1.0/). Files: swosh-01.flac, swosh-02.flac, swosh-03.flac, swosh-04.flac.
- Impact Sounds — Kenney. Source: https://kenney.nl/assets/impact-sounds. License: CC0 (https://creativecommons.org/publicdomain/zero/1.0/). Files: footstep_concrete_000.ogg, footstep_concrete_001.ogg, footstep_concrete_002.ogg, footstep_concrete_003.ogg, footstep_concrete_004.ogg, footstep_grass_000.ogg, footstep_grass_001.ogg, footstep_grass_002.ogg, footstep_grass_003.ogg, footstep_wood_000.ogg, footstep_wood_001.ogg, footstep_wood_002.ogg, footstep_wood_003.ogg, impactBell_heavy_000.ogg, impactBell_heavy_001.ogg, impactBell_heavy_002.ogg, impactBell_heavy_003.ogg, impactGlass_light_000.ogg, impactGlass_light_001.ogg, impactGlass_light_002.ogg, impactGlass_light_003.ogg, impactGlass_medium_000.ogg, impactGlass_medium_001.ogg, impactMetal_heavy_000.ogg, impactMetal_heavy_001.ogg, impactMetal_heavy_002.ogg, impactMetal_heavy_003.ogg, impactMetal_light_000.ogg, impactMetal_light_001.ogg, impactMetal_light_002.ogg, impactMetal_light_003.ogg, impactMetal_medium_000.ogg, impactMetal_medium_001.ogg, impactMetal_medium_002.ogg, impactMetal_medium_003.ogg, impactPlate_light_000.ogg, impactPlate_light_001.ogg, impactPlate_light_002.ogg, impactPlate_light_003.ogg, impactPunch_medium_000.ogg, impactPunch_medium_001.ogg, impactPunch_medium_002.ogg, impactPunch_medium_003.ogg, impactSoft_heavy_000.ogg, impactSoft_heavy_001.ogg, impactSoft_heavy_002.ogg, impactSoft_heavy_003.ogg, impactSoft_medium_000.ogg, impactSoft_medium_001.ogg, impactSoft_medium_002.ogg, impactSoft_medium_003.ogg, impactTin_medium_000.ogg, impactTin_medium_001.ogg, impactTin_medium_002.ogg, impactTin_medium_003.ogg, impactWood_heavy_000.ogg, impactWood_heavy_001.ogg, impactWood_heavy_002.ogg, impactWood_heavy_003.ogg.
- Fantozzi's Footsteps — Fantozzi. Source: https://opengameart.org/content/fantozzis-footsteps-grasssand-stone. License: CC0 (https://creativecommons.org/publicdomain/zero/1.0/). Files: Fantozzi-SandL1.flac, Fantozzi-SandL2.flac, Fantozzi-SandR1.flac, Fantozzi-SandR2.flac, Fantozzi-StoneL1.flac, Fantozzi-StoneL2.flac, Fantozzi-StoneR1.flac, Fantozzi-StoneR2.flac.
- Sirens and Alarm Noise — aquinn. Source: https://opengameart.org/content/sirens-and-alarm-noise. License: CC0 (https://creativecommons.org/publicdomain/zero/1.0/). Files: siren_0.mp3.
- 12 wet towel impacts — Iwan Gabovitch (qubodup). Source: https://opengameart.org/content/12-wet-towel-hittingfallingpunching-floor-sounds. License: CC0 (https://creativecommons.org/publicdomain/zero/1.0/). Files: wet_towel_on_floor-01.flac, wet_towel_on_floor-02.flac, wet_towel_on_floor-03.flac, wet_towel_on_floor-04.flac.
- Dog barking mono — Brandon Morris. Source: https://opengameart.org/content/dog-barking-mono. License: CC0 (https://creativecommons.org/publicdomain/zero/1.0/). Files: dog_barking_mono.wav.
- Zombie moans — Darsycho. Source: https://opengameart.org/content/zombie-moans. License: CC0 (https://creativecommons.org/publicdomain/zero/1.0/). Files: darsycho__zombie-moans_0.ogg.
- Ambient Bird Sounds — isaiah658. Source: https://opengameart.org/content/ambient-bird-sounds. License: CC0 (https://creativecommons.org/publicdomain/zero/1.0/). Files: birds-isaiah658_0.ogg.
- High traffic road sounds — IgnasD. Source: https://opengameart.org/content/high-traffic-road-sounds. License: CC0 (https://creativecommons.org/publicdomain/zero/1.0/). Files: gatve Varniu_2.ogg.
- Crowd Shouting/Speaking Ambience — StarNinjas. Source: https://opengameart.org/content/crowd-shoutingspeaking-ambience. License: CC0 (https://creativecommons.org/publicdomain/zero/1.0/). Files: crowd_shouting_0.ogg.
- Female high-pitched scream SFX — WuxiaScrub. Source: https://opengameart.org/content/female-high-pitched-scream-sfx. License: CC0 (https://creativecommons.org/publicdomain/zero/1.0/). Files: screams_0.ogg.
- 37 hits/punches — Independent.nu. Source: https://opengameart.org/content/37-hitspunches. License: CC0 (https://creativecommons.org/publicdomain/zero/1.0/). Files: hit01.mp3.flac, hit03.mp3.flac, hit09.mp3.flac, hit10.mp3.flac, hit12.mp3.flac, hit15.mp3.flac, hit18.mp3.flac, hit24.mp3.flac, hit27.mp3.flac, hit29.mp3.flac, hit33.mp3.flac, hit36.mp3.flac.
- 80 CC0 creature SFX — rubberduck. Source: https://opengameart.org/content/80-cc0-creature-sfx. License: CC0 (https://creativecommons.org/publicdomain/zero/1.0/). Files: eat_01.ogg, eat_04.ogg, scream_01.ogg, scream_02.ogg.
- 11 male human pain/death sounds — Michel Baradari. Source: https://opengameart.org/content/11-male-human-paindeath-sounds. License: CC-BY 3.0 (https://creativecommons.org/licenses/by/3.0/). Files: die1.wav, die2.wav, pain2.wav, pain4.wav, pain5.wav, pain6.wav.
- Undead Moans — AntumDeluge. Source: https://opengameart.org/content/undead-moans. License: CC0 (https://creativecommons.org/publicdomain/zero/1.0/). Files: undead-2.ogg.
- 75 CC0 breaking / falling / hit SFX — rubberduck. Source: https://opengameart.org/content/75-cc0-breaking-falling-hit-sfx. License: CC0 (https://creativecommons.org/publicdomain/zero/1.0/). Files: bfh1_glass_breaking_01.ogg, bfh1_glass_breaking_02.ogg, bfh1_glass_breaking_03.ogg, bfh1_glass_breaking_04.ogg, bfh1_glass_falling_01.ogg, bfh1_glass_hit_01.ogg, bfh1_glass_hit_02.ogg, bfh1_metal_falling_01.ogg, bfh1_metal_falling_02.ogg, bfh1_metal_hit_01.ogg, bfh1_metal_hit_02.ogg, bfh1_metal_hit_03.ogg, bfh1_metal_hit_04.ogg, bfh1_rock_falling_01.ogg, bfh1_rock_falling_02.ogg, bfh1_rock_falling_03.ogg, bfh1_rock_falling_04.ogg, bfh1_wood_breaking_01.ogg, bfh1_wood_breaking_02.ogg, bfh1_wood_breaking_03.ogg, bfh1_wood_breaking_04.ogg.
- 100 CC0 SFX #2 — rubberduck. Source: https://opengameart.org/content/100-cc0-sfx-2. License: CC0 (https://creativecommons.org/publicdomain/zero/1.0/). Files: sfx100v2_door_01.ogg, sfx100v2_door_02.ogg, sfx100v2_door_03.ogg, sfx100v2_door_04.ogg, sfx100v2_footstep_wet_01.ogg, sfx100v2_footstep_wet_02.ogg, sfx100v2_footstep_wet_03.ogg, sfx100v2_switch_01.ogg, sfx100v2_switch_02.ogg.
- 15 vocal male strain/hurt/pain/jump sounds — qubodup. Source: https://opengameart.org/content/15-vocal-male-strainhurtpainjump-sounds. License: CC0 (https://creativecommons.org/publicdomain/zero/1.0/). Files: slightscream-02.flac, slightscream-03.flac, slightscream-04.flac, slightscream-05.flac, slightscream-06.flac, slightscream-07.flac, slightscream-08.flac, slightscream-09.flac, slightscream-11.flac, slightscream-12.flac.
- Female RPG Voice Starter Pack (type 2, medium voice) — cicifyre. Source: https://opengameart.org/content/female-rpg-voice-starter-pack. License: CC0 (https://creativecommons.org/publicdomain/zero/1.0/). Files: attack1.wav, attack2.wav, attack3.wav, damaged1.wav, damaged2.wav, damaged3.wav, jump1.wav, jump2.wav, jump3.wav.
- 100 CC0 Metal and Wood SFX — rubberduck. Source: https://opengameart.org/content/100-cc0-metal-and-wood-sfx. License: CC0 (https://creativecommons.org/publicdomain/zero/1.0/). Files: metal_close_01.ogg, metal_hit_01.ogg, metal_hit_02.ogg, metal_hit_03.ogg, metal_hit_04.ogg, metal_open_01.ogg, wood_close_01.ogg, wood_close_02.ogg, wood_cracking_01.ogg, wood_cracking_02.ogg, wood_cracking_03.ogg, wood_cracking_04.ogg, wood_hit_01.ogg, wood_hit_02.ogg, wood_hit_03.ogg, wood_hit_04.ogg, wood_slam_01.ogg, wood_slam_02.ogg, wood_slam_03.ogg, wood_slam_04.ogg.
- Car Sound Effects Pack (Low Quality) — GGBotNet. Source: https://opengameart.org/content/car-sound-effects-pack-low-quality. License: CC0 (https://creativecommons.org/publicdomain/zero/1.0/). Files: Car_Horn.ogg.
- Aggressive NPC sounds — mujtaba-io. Source: https://opengameart.org/content/aggressive-npc-sounds-hey-i-will-kill-you. License: CC0 (https://creativecommons.org/publicdomain/zero/1.0/). Files: hey_aggressive_mujtaba.wav.
- Voice Effects Zombie-Skeleton-Monster Human Male — ArcadeParty. Source: https://opengameart.org/content/zombie-skeleton-monster-voice-effects. License: CC0 (https://creativecommons.org/publicdomain/zero/1.0/). Files: zombieDeath1.wav, zombieDeath2.wav, zombieDeath3.wav, zombieDeath4.wav, zombieYell2.wav, zombieYell4.wav, zombieYell7.wav, zombieYell9.wav.
- 8 wet squish/slurp impacts — Independent.nu. Source: https://opengameart.org/content/8-wet-squish-slurp-impacts. License: CC0 (https://creativecommons.org/publicdomain/zero/1.0/). Files: impactsplat03.mp3.flac, impactsplat07.mp3.flac.

## Original work

- Game code, 3D models, textures, UI art and synthesized cues — Minor Incident contributors. License: MIT (https://spdx.org/licenses/MIT.html). Original work; synthesized system cues come from src/audio/synthesis.ts.
<!-- credits:end -->
