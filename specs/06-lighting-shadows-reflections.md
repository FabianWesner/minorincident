# 06 · Lighting, Shadows and Reflections

> **Light is the story of the game.** L1 is lit by the sun. L6 is lit by fluorescent tubes that fail into red emergency lights and a flashlight, until the survivors climb out into the night. As the town loses power, **every light the player sees is one someone is still fighting for.** Lights are both art and gameplay: they show safety, objectives, and danger.

This document defines how lights, shadows, and reflections look and how they are built so they look **stunning on every tier** and stay testable. The implementation epic is [E25](epic-25-lighting-shadows-reflections.md). Base rendering (palette material, sun, bloom, camera) is in [E02](epic-02-rendering-camera-visual-style.md).

## 1. Showcase target: the light-tower trailer

The reference render of `prop.light-tower-trailer` (S10 "fencing & lighting") currently shows the **unlit** state: flat cream lamp faces, no glow, no light on the ground. The same asset in-game at dusk or night, once its generator is started, must show **all of this**:

| Layer | What the player sees |
| --- | --- |
| Emissive head | Lamp faces at HDR warm-white (`light_led_white`, intensity > 1) with a soft **bloom halo**; the reflector rim stays slightly visible so it doesn't become a white blob |
| Startup | Starting the generator (stand-to-interact) gives a **staggered power-on**: engine sputter, two lamps flicker 3–4 times on a fluorescent pattern, then lock on, a subtle exposure "pump", and a hum loop |
| Light pools | Two bright, soft-edged **elliptical pools** on the ground in the aim direction, slightly overlapping, with warm falloff. The pools are **clipped by walls and props** (they don't leak through the fence or the house) |
| Shadows | Infected walking into the pool cast **long, sharp-ish shadows** stretching away from the tower. Fences cast striped shadows through the chain-link. This is a hero light with real shadow maps when near the player |
| Beams | Two **volumetric cones** from lamp to ground: faint, with drifting dust motes and soft edges, fading where they hit geometry (depth fade) |
| Haze | Low ground fog around the tower glows warmer and brighter (lit haze) |
| Glint | A small **lens glint / flare** when a lamp faces the camera (occlusion-tested) |
| Reflections | On wet asphalt, a **vertical light streak** reflects under each lamp, and the car paint and windows nearby pick up the highlights |
| Gameplay | Infected inside the pool are fully readable. The lights attract **Screamers** (they hate light) or act as an objective "safe island", per level script. Shooting a lamp breaks it with sparks and darkness |

The `light-lab` scenario reproduces exactly this at night, and it is the first acceptance target of E25.

## 2. Mood per level (light script)

| Level | Time | Key light | Signature practical lights | Shadow character | Reflection moments |
| --- | --- | --- | --- | --- | --- |
| L1 | late morning | high warm sun, cool sky fill | shop signs off, a few open-sign neons | short, crisp, soft blue-violet | car paint, shop windows (with interiors) |
| L2 | midday (preset `L2`) | high, hard white sun (clearly higher than L1) | station alarm beacons (red rotating), fire-truck and police light bars (red/blue sweeps) | short, hard | police car paint, shop glass at the rescue building |
| L3 | late afternoon (preset `L3`) | lower, warmer, harsher sun through smoke haze | burning cars and houses, police light bars, muzzle flashes | **longer, warm** | broken shop glass, wrecked bus windows |
| L4 | clean late afternoon, false safety (preset `L4`) | clear, saturated warm-neutral sun, little haze | lit shop interiors, army floodlights; then muzzle flashes, tracers, HMG and tank flashes, the fuel-truck fireball | long, crisp, then broken up by smoke columns | car paint, intact shop windows (shattering during the battle) |
| L5 | sunset (preset `L5`, gloom ramp) | deep red/orange sun on the horizon, fading over the level | fires still burning in the ruins, the metro lookout's flashlight; street lamps dead (power out) | very long, red; fire flicker | puddles from burst mains, broken glass |
| L6 | underground → night (presets `L6-subway`, then `L6`) | none underground; cool moonlight at the exit | fluorescent strips (`metro-main`), warm camp lights; after the breach red emergency lights and the **weapon flashlight**; fires on the skyline at the exit | flashlight and emergency-light shadows | wet tunnel floor, tiled walls |

> Rows L2–L6 rewritten for the PO's Level 2–6 redesign (2026-10-07, `po-levels-2-6-2026-10-07.md`): midday → late afternoon → false safety → sunset devastation → underground shelter → night.

**Night readability rule:** at night the scene is dark but **never muddy**. The player is always readable: a soft hero rim light plus a small light-field aura follow the player, and in L6 (underground after the power fails) a **weapon flashlight** follows the aim direction. Infected eyes and telegraphs are emissive and contrast with the darkness.

## 3. Architecture: five lighting layers

Real dynamic lights are expensive, and a dying town needs **hundreds** of light sources, so lighting is layered. Every light source is defined **once**, as a light anchor (§6), and each layer renders it in its own way.

| Layer | Technique | Tiers | Cost | Purpose |
| --- | --- | --- | --- | --- |
| **1. Emissive + bloom** | HDR emissive materials (`emi_*`) feeding the bloom pass, with luminance normalization per hue (Bruno `Materials.js` pattern) | all | ~free | the glowing source itself (lamps, windows, neon, sirens, eyes, fire) |
| **2. Light field** | A top-down **2D light accumulation render target** around the camera focus (an orthographic pass like Bruno's `Tracks.js`, 1024² over 80 m on high and 512² on low). Every light draws its **footprint** (pool, cone, window spill, sweeping siren arc, fire flicker) into it, additively, in HDR. `PaletteMaterial` samples it for ground, walls (with height falloff), characters (at foot height), and fog (lit haze). | **all** (WebGPU and WebGL2) | 1 small pass | **unlimited** cheap light pools, the main night look |
| **3. Hero lights** | Up to N real `SpotLight`/`PointLight` sources (`DynamicLighting` batching, so changing light counts doesn't recompile shaders), selected each frame by importance (distance to the focus, intensity, in-frustum, gameplay priority), with hysteresis and 0.3 s crossfades. While promoted, a light's light-field contribution is crossfaded out (no double lighting). | high: 8 (≤ 3 with shadow maps); low: 3 (≤ 1 shadow) | moderate | true 3D shading and **real shadows** near the player |
| **4. Volumetric beams and flares** | Beam cone meshes (additive, fresnel-soft edges, scrolling noise, depth-fade on intersection, dust-mote particles), `LensflareMesh` glints, and `GodraysNode` for the sun at golden hour | beams: all (fewer on low); flares and god rays: high | low to moderate | the "stunning" factor: visible light |
| **5. Reflections** | env PMREM per time of day (all tiers), **reflection splats** for emissive sources on wet or glossy surfaces (all), `SSRNode` (high), planar reflection for the river (high), interior-mapped windows (all) | mixed | low to moderate | wet streets, glossy floors, car paint, glass, water |

**Spike (first E25 task):** evaluate `ClusteredLighting` (Forward+, up to 1024 point lights, WebGPU compute) for the high tier on WebGPU. If it holds the perf budget, it **replaces layer 3 on WebGPU-high** for unshadowed lights (shadowed hero lights stay). The light field stays as the universal baseline, so WebGL2 and low look consistent and CI (WebGL2) tests the same baseline.

## 4. Shadows

| Shadow type | Technique | Tiers |
| --- | --- | --- |
| **Sun / moon** | One directional shadow map fitted to the camera's optimal area (Bruno `Ligthing.js` approach), **tinted** toward `#4a3a6a`, PCF soft. Cascades are unnecessary with the narrow-FOV high camera. | high 2048², low 1024² |
| **Hero spot shadows** | Shadow maps for promoted spot lights (light trailers, floodlights, player-car headlights, the helicopter searchlight) | high ≤ 3, low ≤ 1 |
| **Light-field occlusion** | For **static** lights, a 2D visibility polygon is computed at layout build time (Blender layout script: a ray cast against building and prop footprints), so pools stop at walls and **buildings cast "light shadows" in pools** at zero runtime cost. Dynamic lights (car headlights, fires on moving objects) use an unclipped footprint plus a cheap 16-ray occlusion test against the static footprint map. | all |
| **Contact / blob shadows** | Instanced soft blob decals under every character, infected, corgi, and vehicle; they grow and fade with the light-field intensity at night (pointing away from the strongest nearby light) | all (low uses only these for crowds) |
| **Crowd shadows** | Instanced infected cast into the sun shadow map (one shadow draw per archetype) | high |
| **Ambient occlusion** | **Baked AO** in a vertex-color attribute `ao`, computed by every bpy build script (Cycles AO bake into the color attribute, deterministic sample count), multiplied in `PaletteMaterial`; plus `GTAONode` screen-space AO | baked: all; GTAO: high |
| **Fire flicker shadows** | Fire hero lights jitter their position by ±0.15 m with noise, giving living shadows | high |

**Shadow art direction:** shadows are colored (purple-blue, never black), with soft penumbra at the sun and sharper edges for spot lights. Contact darkening grounds every object. At golden hour shadows are **long and graphic**, and they are a deliberate part of the composition of L4 photo spots.

## 5. Reflections and mirroring

| Surface | Technique | Tiers |
| --- | --- | --- |
| **Car paint, chrome, metal** | `PaletteMaterial` gains material **classes**: `matte` (default), `gloss` (car paint: a stylized sharp specular lobe + fresnel env), `metal` (chrome: env-dominant), `glass`, `wet`. The env map is a **PMREM generated per time of day** from a stylized "Sunset Grove env scene" (sky gradient, sun disc, emissive city blocks, fire glow at night) | all |
| **Wet asphalt and puddles** | A **wetness mask** (from the layout JSON: gutters, potholes; **rain wetness from the weather system, E28**; plus runtime decals: burst hydrants, fire hoses, leaking gas hoses, blood pools as glossy dark-red). Wet pixels get a darker albedo, lower roughness, and env reflection; **reflection splats**: every light anchor with `reflect` draws a stretched vertical light streak, offset toward the camera by the light's height, into a reflection target that wet pixels sample. That gives the classic neon-on-wet-street look on **every tier**. | all; SSR adds true reflections on high |
| **Polished floors** (supermarket, mall, gym, hospital: shiny in drafts S07/S08) | `gloss` floor class: env + reflection splats of signs and ceiling lights, plus `SSRNode` on high | all / high |
| **Shop and house windows** | **Interior mapping** shader (fake rooms from a small atlas of interior cubemaps: diner booths, pharmacy shelves, living rooms) + fresnel env reflection; lit at night (emissive interiors) per power group; broken glass at W3+ removes the reflection layer | all |
| **River and water** | `Water2Mesh`-style flow normals + planar reflection (`ReflectorForSSR` / `Reflector`) on high; env + reflection splats on low. At night the burning town reflects in the river (L4–L6 key shots) | high / low |
| **Mirrors** (story props: car mirrors, a shop mirror, the pharmacy security mirror) | Small `Reflector` instances activated only when on screen and within 15 m, max 1 at a time | high |
| **Eyes and blood** | Infected eyes get a tiny specular glint; fresh blood pools use the `wet` class (glossy, reflect lights), and dried blood turns matte after 30 s | all |

## 6. Light anchor contract (Blender → game)

Every light-emitting asset or layout defines its lights in the `bpy` script as **empties named `light:<name>`** with a custom-property JSON `ss_light`. The glTF export keeps them as nodes with `extras`, and the runtime creates all five layers from them. KHR_lights_punctual is **not** used (the game owns the light semantics).

```jsonc
// custom property "ss_light" on empty "light:flood_L"  (local -Z = light direction, Blender light convention)
{
  "type": "spot",                 // spot | point | area | window | beacon | fire | neon
  "color": "light_led_white",     // light palette token (§7)
  "intensity": 6.0,               // normalized 0..10 (maps to light-field HDR value and hero-light candela)
  "range": 24,                    // m
  "angle": 48, "penumbra": 0.35,  // spot only, degrees / 0..1
  "pool": true,                   // draw a light-field footprint
  "beam": "soft",                 // none | soft | strong  (volumetric cone)
  "flare": true,                  // lens glint when facing camera
  "reflect": true,                // reflection splat on wet/gloss surfaces
  "shadow": "hero",               // none | hero  (eligible for real shadow map when promoted)
  "heroPriority": 2,              // 0..3, gameplay importance for promotion
  "flicker": "none",              // none | fluorescent | fire | damaged | startup
  "animation": null,              // { "rotate": deg_per_s } | { "strobe": "police" } | null
  "powerGroup": "self",           // self | <district block id> | generator:<id>
  "breakable": true,              // can be shot out (HP 1, sparks, emissive off)
  "emissiveNodes": ["lampHeadL"], // meshes whose emi_* material follows this light's state
  "tiers": "all"                  // all | high
}
```

**Rules (validated by `assets:validate` / `layouts:build`):**
- Every mesh with an `emi_*` lamp material is referenced by some light anchor's `emissiveNodes`, or is flagged `decorativeEmissive` (e.g. tiny LEDs).
- Spot direction is the empty's local −Z. The validator checks that a spot hits the ground within `range` (no lights pointing at the sky by accident, unless `type` is a searchlight).
- Light colors must be light palette tokens. Intensities fall within 0–10.
- Vehicles: `headlightL/R` (spot, beam soft, shadow hero for the player car), `brakeL/R` (point, small), `sirenL/R` (beacon with rotate or strobe, red/blue), interior dome (point, off).
- Buildings: window light groups (`window` type: rectangle spill footprints on the ground in front of the windows), entrance lamps, neon signs (`neon` type: colored footprint + strong reflection splats).

**Blender preview:** `render_preview.py` converts the light anchors into real Blender lights and renders a **day and a night turntable** (Eevee: bloom, soft shadows, volumetrics). The asset review checks the lit state as well. The in-game turntable (`assets:turntable`) also gets a **night view with lights on** (and on vs. off).

## 7. Light color palette

| Token | Use | Hex (start) |
| --- | --- | --- |
| `light_sun_noon` / `light_sun_golden` / `light_moon` | key lights | `#fff4e0` / `#ffb066` / `#9fb4ff` |
| `light_sodium` | old street lamps (L5–L6 orange streets) | `#ffa94d` |
| `light_led_white` | floodlights, light trailers, new street lamps | `#fff1d6` |
| `light_fluorescent` | shops, gas station canopy, gym | `#e8fff4` |
| `light_window_warm` | home windows | `#ffc773` |
| `light_neon_pink` / `light_neon_blue` / `light_neon_green` | diner, open signs, pharmacy cross | `#ff4fa3` / `#4f8bff` / `#4dff9a` |
| `light_siren_red` / `light_siren_blue` | emergency light bars | `#ff2d2d` / `#2f6bff` |
| `light_fire` | fires, Molotovs, burning cars | `#ff7a1a` (flicker to `#ffb347`) |
| `light_muzzle` | muzzle flash pulse | `#ffd27a` |
| `light_toxic` | hazmat spills, bloated burst | `#a6ff4d` |
| `light_spark` | electrical arcs, broken lamps | `#bfe3ff` |

Telegraph colors stay distinct from every light color (the colorblind-safe set in E15).

## 8. Light behaviors (systemic)

- **Power grid:** every light has a `powerGroup`. Decay tiers and scripts switch groups (an L4 block-by-block blackout cascade with a rolling flicker wave; a generator restart brings a group back with the startup flicker). Power state is sim state (deterministic, testable); visuals follow.
- **Startup and shutdown sequences:** fluorescent startup (2–4 stutters), sodium warm-up (dim orange → full over 3 s), damaged buzz flicker, death (a spark burst plus a 0.5 s fade).
- **Breakable lights:** shooting a lamp (HP 1) → sparks, glass shards, emissive off, light off. This is a gameplay tool: darkness reduces infected sight range by 40%.
- **Animated:** rotating beacons (light field draws a sweeping arc; hero promotion is allowed), strobing police bars, swinging lamps after explosions (pendulum), the helicopter searchlight sweep (scripted path, strong beam, shadow hero, god rays).
- **Transient lights:** muzzle flash (one light-field pulse per shot, plus a hero pulse for the player's gun on high), explosions (a big light-field flash + a hero point light for 0.25 s + an exposure kick capped by the flash-reduction setting), Molotov fire (a fire light for the zone's duration), electric arcs.
- **Gameplay links:** lit areas raise player visibility to infected (sight range +20% in light, −40% in darkness); Screamers avoid strong light; objectives and safe points are marked by distinctive light colors (green flares = extraction, white floods = safe zone).

## 9. Exposure and tone mapping

`AgX` tone mapping (or ACES, decided in the E25 spike by vision review), with a **fixed exposure per time-of-day preset** (no auto-exposure, so it's deterministic for goldens) plus **scripted exposure pumps** (power-on, explosions, the dawn finale), capped by flash reduction. Bloom threshold 1.0 means only HDR emissives and light-field hotspots bloom.

## 10. Quality tiers (lighting)

| Feature | High (WebGPU or WebGL2) | Low / mobile |
| --- | --- | --- |
| Light field | 1024² / 80 m, HDR float | 512² / 60 m, half-float |
| Hero lights | 8 (3 shadowed), 1024² spot shadow maps | 3 (1 shadowed), 512² |
| Clustered lights (WebGPU only, if the spike passes) | ≤ 256 unshadowed | off |
| Beams | all, with dust motes | nearest 6, no motes |
| God rays / lens flares | on | off |
| GTAO | on | off (baked AO only) |
| SSR | on (half-res) | off (env + splats) |
| Planar water / mirrors | on | off |
| Crowd shadows | sun shadow map | blob decals |

## 11. Concept key frames (to produce)

Codex imagegen produces **lighting key frames** that serve as vision-review targets (`assets/_keyframes/lighting/`, listed in `05-asset-inventory.md` §4.8; frames 2–4 and 6 are superseded by the redesign key frames `kf-l2-midday`, `kf-l3-late-afternoon-smoke`, `kf-l4-safe-city`, `kf-l5-sunset-ruins`, `kf-l6-subway-emergency`, `kf-l6-night-exit`, see `05` §6.5):

1. `kf-light-trailer-night.png`: the light-tower trailer at night on a wet parking lot, with beams, pools, and infected shadows
2. `kf-l4-goldenhour-godrays.png`: a Main Street blackout cascade at golden hour, god rays through smoke
3. `kf-l5-sodium-dusk.png`: a residential street at blue hour, sodium lamps, sirens, convoy headlights, a wet road
4. `kf-l6-fire-night.png`: the burning neighborhood at night, fire shadows, the river reflection
5. `kf-mall-polished-floor.png`: the mall interior with neon signs reflected on a polished floor
6. `kf-helipad-dawn.png`: the final stand at the helipad, flares, searchlight beam, dawn backlight

**Interim targets already available:** `initial-drafts/explosions-fire-smoke-and-lighting-fx.png` (S24: the light-tower trailer at night, sodium lamp, police bar, neon on a wet street) and `initial-drafts/weather-and-time-of-day-moods.png` (S25: sun, overcast, golden hour, storm, night fire and fog, snow) cover key frames 1–4 for vision reviews until dedicated full-frame key frames exist.

Each key frame uses the style preamble from `03-asset-pipeline.md` §3, with "game screenshot, isometric high angle, same camera as the attached gameplay mockup".
