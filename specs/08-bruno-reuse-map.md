# 08 · Bruno Simon folio-2025 Reuse Map

**Goal: reuse as much as possible.** The checkout `folio-2025/` (commit `41046b5`, MIT license, © 2025 Bruno Simon) is our technology reference. The deep analysis is in `docs/bruno-reference/`. This file maps **every useful source file** to our epics and says how to reuse it. All paths are relative to `folio-2025/sources/Game/`.

## 1. Reuse modes and rules

| Mode | Meaning |
| --- | --- |
| **Port** | Copy the file into `src/…`, convert it to TypeScript, keep the structure, and replace the `Game.getInstance()` singleton with injected services. Keep the MIT header (`// Adapted from folio-2025 by Bruno Simon (MIT)`). |
| **Adapt** | Use it as the blueprint, rewritten for our needs (e.g. into the deterministic sim) |
| **Pattern** | Borrow only the technique or shader idea |
| **Skip** | Not useful for us |

**Mandatory porting rules:**
1. **Sim-side code** (physics, vehicle, objects, explosions-as-damage) must be made deterministic. Replace `gsap.delayedCall` and `setTimeout` with sim-tick timers, replace `Math.random` with `Rng` streams, and use the fixed step instead of `ticker.deltaScaled` (see `docs/bruno-reference/movement-and-physics.md`, timing caveat).
2. **View-side code** (materials, VFX, camera, UI) may keep GSAP and render-time randomness.
3. Replace the singleton with constructor injection (`services`), add `dispose()` to everything (Bruno rarely disposes), and register callbacks through our ordered `EventBus` phases.
4. Every ported file is listed in `THIRD_PARTY_NOTICES.md` (static test E01).
5. Bruno's Blender-authored GLBs and textures are **not** reused (our assets come from our own `bpy` scripts). Shaders, code, and **techniques** are reused.

## 2. Core runtime

| Bruno file | What it does | Our use | Mode | Epic |
| --- | --- | --- | --- | --- |
| `Game.js` | Composition root, staged boot (intro batch → Rapier + assets in parallel → world steps), `reset()` | Boot sequence + loading stages in `src/main.ts`; no singleton | Adapt | E01 |
| `Events.js` | Callback buckets ordered by number | `core/EventBus` ordered phases (`02` §4) | Port | E01 |
| `Ticker.js` | Delta capping, time scale, frame waits, `tick` emit | Render-frame ticker; the sim gets a separate fixed-step clock | Adapt | E01 |
| `Time.js` | `bulletTime` (scale 0.5, progress, end time) | **Dramatic slow-mo** for mega explosions and vehicle hits, as a sim time-scale event | Adapt | E27, E09 |
| `ResourcesLoader.js` | Cached GLTF / Draco / KTX2 / texture loaders, per-texture modifiers | `assets/registry.ts` loader layer (add the Meshopt decoder) | Port | E17 |
| `Quality.js` | High/low tiers, mobile heuristic, events | `Quality` service (+ the adaptive frame-time logic) | Port + extend | E18 |
| `Viewport.js` | Size, pixel-ratio cap at 2, resize events | Same | Port | E02 |
| `Debug.js` | Tweakpane panels + bindings | `?debug` pane | Port | E01 |
| `Monitoring.js` | stats-gl hook | `?perf` overlay | Adapt | E18 |
| `PreRenderer.js` | Warms shader and pipeline compilation with a 32px cube render | Pre-warm before `screenshotReady()` and level start (avoids hitches) | Port | E02, E18 |
| `ClosingManager.js`, `Modals.js`, `Menu.js`, `Overlay.js`, `Notifications.js`, `Tabs.js` | DOM UI services | Menu/modal/toast plumbing (restyled) | Adapt | E14 |
| `Options.js` | Settings persistence | Settings service | Adapt | E14 |
| `utilities/*` | Math helpers (`remapClamp` …), ObservableMap/Set | Shared utils | Port | E01 |
| `Server.js`, `Whispers.js`, `Achievements.js`, `KonamiCode.js`, `Easter.js`, `BlackFriday/*`, `World/Areas/*` | Portfolio content | — | Skip (patterns from `Areas`/`Zones` only) | — |

## 3. Input

| Bruno file | What it does | Our use | Mode | Epic |
| --- | --- | --- | --- | --- |
| `Inputs/Inputs.js` | Named action map, device modes, filter sets, `updateMode` | `InputSystem` → `InputFrame`; scheme detection | Adapt | E03 |
| `Inputs/Keyboard.js` | Key state, mapping | Keyboard device | Port | E03 |
| `Inputs/Pointer.js` | Pointer events, coordinates, buttons | Mouse device (+ middle-button interact, autoscroll suppression) | Port + extend | E03 |
| `Inputs/Wheel.js` | Normalized wheel (`normalize-wheel`) | Selector (with debounce) | Port | E03 |
| `Inputs/Nipple.js` | Custom touch joystick (meshes, progress, angle) | **Mobile floating move stick** | Port | E03 |
| `Inputs/InteractiveButtons.js` | On-screen buttons bound to actions | Touch action buttons (drag-to-aim added) | Adapt | E03, E14 |
| `Inputs/Gamepad.js` | Gamepad mapping | — (gamepad is post-v1) | Skip for v1 | — |
| `RayCursor.js` | Pointer raycasting with intersect registration | Cursor → ground raycast, hover on interactables | Adapt | E03, E11 |
| `InputFlag.js` | Input hint flag UI | Onboarding prompt bubble style | Pattern | E14 |

## 4. Camera, rendering, lighting

| Bruno file | What it does | Our use | Mode | Epic |
| --- | --- | --- | --- | --- |
| `View.js` | Perspective cam FOV 25, spherical orbit, smoothed focus, **optimal area**, aspect adaptation, zoom, roll kick, cinematic blending, speed lines | **Follow camera** (fixed yaw in combat), cinematic blending for twists, roll kick for explosions, optimal area for shadows and light field; speed lines while driving | Port (trim free/map modes) | E02, E09, E27 |
| `Rendering.js` | WebGPURenderer init, RenderPipeline, bloom (threshold 1, strength 0.25), blur/DOF switch | Render pipeline base; we add GTAO, SSR, god rays, and the light-field pass | Port + extend | E02, E25 |
| `Passes/cheapDOF.js` | Screen-center hash blur (tilt-shift) | Optional miniature DOF (edges only) | Port | E02 |
| `Materials/MeshDefaultMaterial.js` | Lambert node material + core shadow, tinted drop shadow, terrain bounce, fog, alpha discard, reveal | **`PaletteMaterial` base**; add the light-field sample, material classes (gloss/metal/glass/wet), baked AO, gore blood mask | Port + extend | E02, E25, E15 |
| `Materials.js` | Palette texture, `createEmissive` with **luminance normalization**, gradients, `updateObject` (material swap by name) | Palette swap at GLB load (`pal_*`, `emi_*`), emissive normalization for lamps, neon, sirens | Port | E02, E17, E25 |
| `Materials/MeshGridMaterial.js` | Grid shader | Debug and placeholder ground | Port | E01 |
| `Ligthing.js` | Directional light, shadow camera fitted to the optimal area, tinted shadow uniforms, day-cycle direction | **Sun/moon + shadow fitting** | Port | E02, E25 |
| `Cycles/Cycles.js`, `Cycles/DayCycles.js`, `Cycles/YearCycles.js` (YearCycles → weather timelines, E28) | Keyframed color/intensity cycles over time | **Time-of-day presets per level** (L1 morning → L6 night/dawn), the L6 dawn transition | Adapt (scripted, not real-time) | E02, E25, E24 |
| `Fog.js` | World fog uniforms | Fog + **lit haze** (light-field tint) | Port + extend | E02, E25 |
| `Noises.js` | Generated perlin/voronoi/hash textures | **Shared noise textures** for fire, smoke, fireballs, beams, decay | Port | E15, E27 |
| `InstancedGroup.js` | Base + references → one `InstancedMesh` per child mesh, dirty updates | **All repeated props**, placement empties from layout GLBs, physics props | Port | E10, E26 |
| `References.js` | Reference empties from GLB → placements | Layout GLB placement and anchor empties (`inst:`, `anchor:`) | Adapt | E10 |
| `TextCanvas.js` | Text to canvas texture | Signs, scoreboard digits, floating labels | Port | E10, E14 |
| `Reveal.js` | Radial reveal of the world | Level intro reveal / respawn effect | Pattern | E14 |

## 5. Physics, vehicle, objects, explosions

| Bruno file | What it does | Our use | Mode | Epic |
| --- | --- | --- | --- | --- |
| `Physics/Physics.js` | Rapier world, body/collider descriptions, friction rules, contact-force events routed to user data, initial state | **Physics service in the sim** (fixed step); collision categories; contact callbacks for props, explosives, vehicles | Port (make the timestep fixed) | E01, E26 |
| `Physics/PhysicsVehicle.js` | Rapier `VehicleController`, 4 raycast wheels, engine force, top speeds, boost, brakes, idle/reverse brake, hydraulics, **stuck detection**, upside-down detection, flip, `activate()` | **All drivable vehicles** (retuned per `VehicleDef`); stuck and flip recovery for the bots and players | Port | E09 |
| `Physics/PhysicsWireframe.js` | Collider debug rendering | `?debug` physics view | Port | E01 |
| `World/VisualVehicle.js` | Wheels (steer and suspension smoothing), back lights, **blinkers**, antenna spring, boost animation and trails, ground track, paints | **Vehicle view**: wheels, brake lights, blinkers (hazard lights in panic!), boost trails, tire tracks | Port | E09, E25 |
| `Player.js` | Input → accelerate/steer/boost/brake, unstuck, flip, distance stats | Vehicle driver input layer (survivor walking is new code) | Adapt | E09 |
| `Respawns.js` | Respawn points from references | Checkpoint respawn points | Adapt | E12 |
| `Objects.js` | Visual + physical objects, **sleeping**, friction/restitution from GLB `userData`, sync only when awake, **reset when fallen**, `resetAll` | **`PropSystem`** for every movable object | Port | E26 |
| `World/Bricks.js`, `World/Benches.js`, `World/Fences.js`, `World/Lanterns.js` | Instanced dynamic props from reference GLBs | Template for cones, bins, carts, benches, fence segments, lanterns | Port (pattern per prop family) | E26 |
| `World/ExplosiveCrates.js` | Contact → arming click → 0.4 s → explosion + fireball + disable | **Explosive props** (propane, drums, gas cans): the tell beat + trigger | Port (sim timers) | E27, E11 |
| `Explosions.js` | Radial impulse with upward bias, mass-scaled linear falloff, applied 1 tick later; view roll kick; leaves blown; bullet time on vehicle hit | **Core of the explosion physics** + camera kick | Port | E27, E26 |
| `World/Fireballs.js` | TSL fireball: sphere with **triplanar perlin noise**, red→orange emissive gradient, GSAP progress | **Fireball beat** (instanced, multi-sphere, with a smoke-out phase added) | Port + extend | E27 |
| `World/Lightnings.js` | Anticipation particles, arc mesh, explosion particles, sounds | **Electric arcs** (substation, fuse boxes, broken lamps) + the anticipation-particle tell for explosions | Adapt | E27, E25, E22 |
| `Tornado.js`, `World/VisualTornado.js` | Tornado force field + visuals | Pattern for the **smoke column** (stacked rotating puffs, force on objects) | Pattern | E27 |
| `Zones.js` | Trigger volumes with enter/leave | Mission trigger volumes | Adapt | E12 |
| `InteractivePoints.js` | Interaction points with key icon, sounds, input binding | **Stand-to-interact** points (+ radial fill), interaction prompts | Adapt | E11, E14 |

## 6. World, environment, ambience

| Bruno file | What it does | Our use | Mode | Epic |
| --- | --- | --- | --- | --- |
| `World/World.js` | Feature assembly in steps | District/level world assembly | Adapt | E10 |
| `Terrain.js` | Terrain gradient and nodes, track influence | Ground shading (lawns, dirt) + track influence | Adapt | E10 |
| `World/Floor.js` | Floor visual + bedrock + physical | Base ground and kill-floor (reset when fallen) | Port | E10, E26 |
| `World/Grass.js` | Blade geometry, terrain-sampled placement and color, **TSL wind deformation**, tracks interaction | **Lawns, parks, baseball field** (flattened by tracks, explosions, and fire scorch) | Port | E10 |
| `Tracks.js` | **Top-down orthographic local render target** (512² / 40 m) around the player for tracks | Tire and foot tracks **and the template for the light-field pass** (same moving local RT technique) | Port + reuse technique | E10, E25 |
| `Trails.js` | Trail ribbons (boost) | Vehicle boost and drift trails, tracer ribbons | Port | E09, E15 |
| `World/Foliage.js`, `World/Trees.js`, `World/Bushes.js`, `World/Flowers.js` | Instanced foliage from references, physical trees, wind | **Trees, hedges, flower beds** of Sunset Grove (palette-tinted); burned variants at W4–W5 | Port | E10 |
| `World/Leaves.js` | GPU leaves around the optimal area, `explode(coords, radius)` | Leaves scatter on explosions, cars, and running; ash flakes at W5 (recolored) | Port | E15, E27 |
| `Wind.js`, `World/WindLines.js` | Global wind uniform, wind line streaks | Shared wind for grass, foliage, **smoke, fire, flags**; wind lines for atmosphere | Port | E10, E27 |
| `Weather.js`, `World/RainLines.js`, `World/Snow.js`, `World/Lightnings.js` | Weather properties and overrides, rain, snow | **Weather system** (rain, storm, fog, snow, ash fall, wind) with gameplay effects; wetness feeds reflections | Port + extend (state moves into the sim) | E28, E25 |
| `World/WaterSurface.js`, `Water.js` | Water surface nodes + ice | River (D-EDGE), puddles, the creek (D-PARK) | Adapt | E10, E25 |
| `World/PoleLights.js` | **Instanced lamp posts** with physics, emissive glass, fireflies, a **day/night switch interval** | **Street lamps** + the power-group on/off switching + fireflies in parks at dusk | Port + extend | E25, E10 |
| `World/Scenery.js` | Road and scenery assembly | Road kit placement pattern | Pattern | E10 |
| `World/Confetti.js`, `World/Bubble.js` | Particle bursts, speech bubbles | Confetti → pattern for **gore gibs and sparks** bursts; bubble → corgi bark ping | Pattern | E15, E08 |
| `Map.js` | Map view with locations, player, texture | **Minimap** (circular, objective markers) | Adapt | E14 |
| `Title.js`, `World/Intro.js` | Title and intro sequence | Title screen intro | Pattern | E14 |
| `Audio.js` | Howler registry, positional sounds, `antiSpam`, `distanceFade`, rate randomization, ambiences, playlist | **AudioService** (+ voice limiter, crowd aggregation); **port the blur/focus handling** (mute + pause the playlist on blur, resume on focus unless user-muted) and extend it with `visibilitychange`, `pagehide`, and `AudioContext.suspend()` | Port + extend | E16 |

## 7. Data and asset pipeline

| Bruno file | What it does | Our use | Mode | Epic |
| --- | --- | --- | --- | --- |
| `scripts/compress.js` (repo root `folio-2025/scripts/`) | gltf-transform + toktx compression of GLBs and textures | `tools/assets/optimize.ts` (meshopt instead of Draco, as a bounded job queue) | Adapt | E17 |
| `vite.config.js` | WASM, top-level await, node polyfills | Vite config for Rapier WASM | Adapt | E01 |
| `readme.md` "Blender" section | Export presets, palette texture muted and set in Three.js | Same philosophy: material identity from Blender, shading in Three.js (`pal_*` swap) | Pattern | E17 |

## 8. Using the map

- Each epic file has a **"Bruno references"** section listing the files above that apply to it. Read those files **before** writing new code.
- When porting, record the source file and commit in the file header and in `THIRD_PARTY_NOTICES.md`.
- If a Bruno technique is rejected after evaluation, note why in the epic report, so it isn't reconsidered blindly.
