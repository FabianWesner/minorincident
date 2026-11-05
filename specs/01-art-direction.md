# 01 · Art Direction

The source of truth is the 11 sheets in `initial-drafts/`. The gameplay mockup (`sunset-grove-combat-gameplay-mockup.png`) is the **north-star frame**: every in-game screenshot is judged against it.

## 1. Look in one sentence

A warm, saturated, chunky-low-poly **miniature diorama** at golden hour. It has soft colored shadows, glowing windows and lamps, rounded "toy" proportions, and lots of bright-red stylized blood and chunky dismemberment: over-the-top comic gore, not realism.

## 2. Camera and framing

- A high-angle **narrow-FOV perspective** camera (Bruno style; see `docs/bruno-reference/movement-and-physics.md`): FOV 25°, azimuth π/4, polar angle about 0.30π, follow distance tuned so the survivor is about 1/12 of the screen height on a 16:9 desktop.
- The camera yaw stays **fixed during combat** so aim stays stable. Only cinematic moments rotate it.
- Buildings and props that cover the survivor fade out (alpha dither) or show a cutaway (roofs hidden when inside).
- Narrow (portrait mobile) aspect ratios move the camera further out (Bruno's aspect adaptation).
- Optional tilt-shift ("cheap DOF") applies only to the top and bottom 15% of the screen and **never blurs the play area**.

## 3. Palette

The global palette comes from the sheets' "material / color palette" panels and is used by every asset through a shared palette texture (Bruno's `MeshDefaultMaterial` pattern):

| Token | Use | Hex (start value) |
| --- | --- | --- |
| `asphalt` | roads | `#5b4f5c` |
| `sidewalk` | pavers | `#b9a4a0` |
| `grass` | lawns | `#6f8f3a` |
| `foliage` | trees/hedges | `#7da23c` |
| `woodWarm` | fences, benches, porches | `#b0703f` |
| `picketWhite` | fences, trim | `#f2e6dc` |
| `brick` | main street, school | `#a8483a` |
| `survivorRed` | hoodie/jacket, HUD health | `#d9363e` |
| `backpackTeal` | survivor backpack, corgi pack | `#2f6e6a` |
| `schoolBusYellow` | bus, hazard stripes | `#f2b630` |
| `policeBlue` / `sirenRed` | emergency lights | `#2f6bff` / `#ff2d2d` (emissive > 1 for bloom) |
| `windowGlow` | lit windows, lamps | `#ffc773` (emissive) |
| `blood` | decals, splatter | `#b3121f` |
| `infectedSkin` | zombie skin base | `#c9a39a` |
| `infectedEye` | glowing eyes | `#ff3b2f` (emissive) |
| `uiDark` | panels | `#25222c` |

A coding agent checks these tokens with the palette-coverage test (`T-E02-05`).

## 4. Lighting

- One **directional sun** with tinted shadows (shadow color mixes toward purple-blue `#4a3a6a`, never pure black), a hemisphere ambient, and a terrain-bounce approximation.
- **Emissive lamps** (street lamps, windows, neon, sirens) use HDR colors that feed bloom. There are no dynamic point lights except for at most 4 "hero" lights (e.g. muzzle flash, fire) on the high tier.
- The sky, fog, sun, and shadow tint follow the **time-of-day** curve per level (concept §9). L4 matches the drafts' golden hour exactly.

### 4.1 Lighting concept
The full lighting, shadow, and reflection concept, including the per-level light script, light palette, and Blender light anchors, is in [06-lighting-shadows-reflections.md](06-lighting-shadows-reflections.md). Explosions, fire, and smoke look: [07](07-physics-props-explosions-smoke.md) §5–6.

## 5. World-state decay tiers

| Tier | Name | Visual layer additions | Light / sky |
| --- | --- | --- | --- |
| W0 | Normal | open shops, moving traffic, civilians, clean streets | bright late morning |
| W1 | Panic | doors ajar, dropped bags, a few crashed cars, police cars with sirens | midday |
| W2 | Emergency response | barriers, cones, checkpoint tents, blood trails, abandoned belongings | afternoon |
| W3 | Breakdown | power outages (dark windows on some blocks), fires, blocked roads, wrecks, broken glass | golden hour |
| W4 | Overrun | barricaded houses, burned cars, large blood pools, many corpses, smoke columns | dusk |
| W5 | Destroyed | burning buildings, collapsed facades, rubble, ash particles, wrecked emergency vehicles | night, fire-lit, dawn at the end |

Decay is implemented as **additive layers** on a shared district layout (props added or swapped, materials tinted, lights disabled). E10 owns the system.

## 6. Characters

- Proportions: heads about 1/4 of body height (chibi-leaning), big hands and feet, and readable silhouettes at 60 px tall.
- Survivors: a red jacket or tee, a teal backpack with a corgi patch, and red sneakers. These identity colors stay present at every gear tier.
- Infected: desaturated skin, **emissive red eyes** (they read in the dark), torn clothes, and blood on the clothes. Each archetype has a unique **silhouette cue** (Brute: bulk; Riot: shield; Hazmat: yellow suit; Screamer: hair and arms up; Bloated: belly).
- Survivors stand about 1.4 m tall (scale comparison sheet). Infected adults are 1.5–1.7 m; Brute and Armored are 2.0–2.2 m.

## 7. Blood and gore policy

**Decision (Q8): more gore.** The target rating is Mature (M / PEGI 18). The *look* stays stylized and chunky to match the toy diorama, but the *amount* is high:

- **Blood:** heavy bright-red sprays on every hit, arterial arcs on blade kills, large pooling floor decals (pooled, cap 600, fade after 120 s), blood trails from wounded and crawling infected, and wet **blood accumulation on weapons, the player's clothes, and car bumpers and windshields** (vertex-color or decal masks that build up during a level).
- **Dismemberment:** limbs detach on heavy melee kills (machete, axe, katana, shovel: 35% chance per kill; always on a finishing combo), shotgun kills at close range (head or arm), explosions (all limbs, plus chunky low-poly gibs), and vehicle run-overs at high speed. Detached limbs become pooled physics gibs (cap 80). Stumps show caps (asset requirement, `03` §4.4).
- **Infected wounds:** crawlers are created when legs are destroyed (a legless runner keeps crawling). Riot and Armored lose armor pieces visibly.
- **Corpses** persist 45 s, then sink (cap 100). Gibs persist 30 s.
- **Still no realistic viscera textures** (no organs or photo-real wounds): all gore uses palette reds and dark reds on low-poly shapes.

The settings **Full / Reduced / Off** change visuals only, never gameplay. Reduced keeps blood but no dismemberment or gibs. Off swaps red for dark-gray splats with no decals or gibs.

## 8. UI style

Taken from the mockup: the circular portrait top left with chunky red health and blue armor bars, a corgi portrait below it, the circular minimap top right with an N marker, and action cards at bottom center with key badges. Rounded dark panels (`uiDark`) with a thin warm border. The title logo now reads "MINOR INCIDENT"; its home-screen draft is `initial-drafts/home-screen.png`. Tagline lines: "A quieter neighborhood today · Braver people tomorrow".

The mockup shows four ability cards (Q, W, E, R). Our control model uses **two sides plus a selector**, so the HUD shows **two large slot cards (LEFT / RIGHT)**, each with a small rack strip and the selected side highlighted. This deviation is intentional; see Open Question Q2.
