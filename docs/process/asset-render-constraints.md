# Minor Incident: constraints for a new asset creation / rendering approach

A brief for a research agent. All numbers come from the repo (2026-10-23); file references are in brackets.

## 1. Product and look
- A browser game (desktop plus phones): an isometric zombie-outbreak courier game, 10 levels, a public beta at minor-incident.com.
- Style: a warm, saturated, chunky low-poly "toy diorama", bevels 0.02–0.06 m, no subdivision look. Adult proportions. Infected have desaturated skin and **emissive red eyes** (#ff3b2f). Shadows are tinted toward #4a3a6a, never black. [specs/01-art-direction.md]
- Approved style references: `assets/char.courier-female/reference.png`, `assets/inf.brute/reference.png`, `assets/inf.bbq-dad/reference.png`. Current concept drafts to hit: `assets/inf.alpha/concepts/`, `assets/inf.mega-alpha/concepts/`, `assets/inf.<animal>/reference.png`.
- The quality bar: "a player would believe this is the draft brought to life in the game's style". The PO wants it stunning at close zoom; the old Blender/LLM pipelines plateaued at a judge score of 5–7/10.

## 2. Runtime and engine
- three.js **0.186.0**, the `WebGPURenderer` from `three/webgpu` with an automatic **WebGL2 fallback**. Both backends must render identically. [src/render/Renderer.ts]
- Materials: TSL node materials. The game swaps GLB materials by name to palette materials: `pal_<token>`, `emi_<token>`, `keep_glass|keep_neon`, from a 120-token palette (src/assets/palette.json). **No image textures today**: 0 of 1,234 shipped GLBs contain images, and 999 use vertex colours (COLOR_0); AO is baked into a colour attribute. Textures are allowed by the spec (KTX2/WebP ≤ 1024 px hero, ≤ 512 side), but there is no textured crowd path yet.
- Hard GPU limits: crowd instancing must fit **≤ 8 vertex buffers on WebGPU** and ≤ 16 attribute locations on WebGL2. Breaking it once made every pedestrian invisible on WebGPU (P0). Per-instance data is one interleaved 9-float stream. [src/render/characters/CrowdAppearance.ts]
- No new shader graphs may compile mid-play: every material variant must be prewarmed behind the loading card, and lights/shadow lists stay stable. Cold-shader stalls of 3.7–4.5 s were a real bug. [src/render/PreRenderer.ts, docs/reports/fixes-13h-l10/]
- Units: metres, **Y up, forward +X** for every asset. Blender authoring is Z-up facing +X, ground at z = 0, transforms applied. Manifest dimensions: x = depth, y = height, z = width.

## 3. Performance budgets (per quality tier)

| | high | low (phones auto-select low) |
|---|---|---|
| frame | 16.7 ms (level specs p95 ≤ 14 ms) | 33.3 ms (phone p95 ≤ 33) |
| draw calls (scene) | 600 | 300 |
| triangles (scene) | 1.5 M | 0.5 M |
| JS heap after load | 400 MB | 250 MB |
| infected alive cap | 200 | 100 (per level 30–200) |
| pixel ratio cap | 2 | 1.5 |
| shadow map | 2048 | 1024 |

- Crowds: **≤ 30 mesh draw calls with 200 AI**, zero non-instanced crowd meshes; the corpse burst ≤ 7 draws. [tests/perf/horde.spec.ts]
- Persistent corpses: corpses never despawn. Up to **282–400 bodies per level** on low, in 128-body instanced pages.
- Load: the worst of 20 cold loads ≤ **6 s** per level, no slower than PROD; no gameplay frame > 200 ms after the loading card; initial download ≤ 15 MB gzip, start district ≤ 25 MB. [docs/qa/regression-gate.md]
- Memory: 5 reloads must stay within 110 % of the first load (heap, geometries, textures).
- Devices: desktop reference M1 Max; emulated Pixel 7 (CPU ×4 throttle) and iPhone 14 (×2) at 390×844. Phones run the low tier.

## 4. Asset budgets and delivery

| Class | LOD0 triangles | LOD1 | LOD2 | materials | file |
|---|---|---|---|---|---|
| Regular infected (many on screen) | ≤ 40k spec; authored ~5–7k | 5–7k | ~5k | ≤ 4–7 | ≤ 1.5 MB |
| Alpha (few on screen) | 8,000 | 3,000 | 1,000 | ≤ 7 | 800 KB |
| Mega Alpha (boss) | 16,000 | 6,000 | 2,000 | ≤ 7 | |
| Zoo: zebra / elephant / dog | 6k / 12k / 5k | 2k / 4k / 2k | 0.7k / 1.5k / 1k | | |
| Survivor / courier (hero) | ≤ 60k (skinned courier ~45–51k) | | | | ~650 KB |
| Vehicles (APC, tank) | ≤ 15k total | | | ≤ 8 | 1.5 MB |
| Accessories (hats, glasses) | 150 | 80 | — | 1 | 20 KB |

- LOD ratios: LOD1 ≈ 10–15 %, LOD2 ≈ 3–4.5 % of LOD0. Switch distances: high LOD1 at 8 m, LOD2 at 24 m; low LOD1 from 0 m, LOD2 at 16 m; crowd LOD by pixel size (LOD1 above 104 px). [src/render/lodPolicy.ts]
- Format: glTF 2.0 / GLB, **EXT_meshopt_compression + KHR_mesh_quantization mandatory**, pipeline dedup → prune → weld → join by material → quantize → meshopt. [tools/assets/optimize.ts]
- Validator [tools/assets/validate.ts]:
  - bbox = manifest dimensions;
  - required/animated/socket nodes present exactly once;
  - forward +X;
  - palette material names only;
  - budgets;
  - hidden **stump caps** (head, armL/R, foreArmL/R, legL/R) for dismemberment;
  - no NaN or degenerate triangles;
  - deterministic geometry hash;
  - no z-fighting.
- Licences: permissive only (MIT/Apache-2.0/BSD/ISC/CC0). Tools may be GPL if only used at build time. Credits are generated automatically.

## 5. Characters, rigs and motion
- Rig contract (rigid parts, no skinning, except the courier): `root, hip, torso, head, armL/R, foreArmL/R, handL/R, legL/R, shinL/R, footL/R, weaponSocketR/L, backpackSocket`. Quadrupeds add `body, neck, head, jaw, tail, legF/B L/R, paw*`. Separate nodes with pivots at the joints. [src/data/survivor.ts]
- The skinned courier (exception): 33–36 deforming bones, retargeted CC0 Mesh2Motion clips.
- Animation: TRS actions from `assets/animation-library/library.glb` (99 clips). **Crowds use a baked pose atlas** (a float texture, 24 frames per clip; 35 infected clips, 52 civilian clips), one merged geometry per archetype with a part index, rendered as an InstancedMesh. Corpses freeze the last frame of the death clip into static instanced pages.
- Movement each character class needs:
  - infected: idle, walk, shamble, run/sprint, swing, windup, hurt, stagger L/R, knockdown, flung, get-up, crawl, death-back/side/crumple, infection stagger/collapse/rise;
  - civilians: walk variants, sit, sit-down/stand-up, carry, cane, startle/flee/grabbed, shoot, gestures;
  - player: idle, walk, run, combos per weapon, shoot, throw, kick, interact, enter-car, mount/dismount, hand-over, ride, carry;
  - Alpha and animal special moves: charge, ground-slam, grab-throw, roar, pounce, flank, pound, elephant trunk swipe, zebra kick/stampede, flamingo dive;
  - corgi: trot, gallop, sit, bark, growl;
  - vehicles: wheels, doors, turret/gun, and the bike (handlebar, crank, pedals, cargo box).
- Accessories attach to the head with per-base-model fit transforms (glasses clearance 12 mm). Health bars sit at the top of the drawn bounds; no anchor nodes.
- Heights: civilians 1.8 m, courier 1.40–1.46 m, corgi 0.95 m, Alpha 2.51 m, Mega 2.58 m, elephant 3.0 m, zebra 2.45 m.

## 6. Camera and how assets are seen
- Isometric-ish follow camera: FOV 25°, radius 19 m, polar 0.30π, **fixed yaw π/4** in gameplay, zoom 0.5–1.5. The driving view widens to about 1.36× the radius. A character is about **120–180 CSS px tall** at default zoom (2–3× that on retina/phones). The PO plays **WebGPU, low quality, close zoom**, so close-ups matter.
- Lighting: day and many night presets (dusk, subway, zoo night, crossing night, L10 night); readability at night is a known weak spot.

## 7. Scale of the job
- **452 manifest entries**: characters 46, infected 44, props 172, buildings 84, vehicles 27, weapons 30, accessories 13, UI 36. 1,234 shipped GLBs (129 MB), 82 district layout GLBs, 13 districts.
- Any new approach must allow incremental migration, one asset class at a time, behind the same names, nodes and manifest contract, and must be testable in our gates: the asset validator, `npm run qa:invariants`, the visual A/B against PROD, and the Scene Lab capture matrix (high/low × zoom 0.5/1/1.5 × WebGPU/WebGL2).

## 8. What failed before (so the research can avoid it)
- Voxel-union plus reduction produced blobs; convex "corpse shells" fixed the shards at low quality but looked terrible up close.
- LLM-in-Blender builds: clean but very faceted, small heads, arms that stick out because of the fixed rest pose. A blind judge plateaued at 5–7/10 against the drafts after many rounds.
- WAM (an LLM geometry DSL): it binds 1:1 to our rig and is triangle-efficient, but it peaked at 5.5/10 on the zebra. Stripes via subdivision blew the budget; we found a compiler winding bug.
- Hard limits that bit us: the WebGPU vertex-buffer limit, cold shaders mid-play, the per-pool material copies, the colour-only shading that can't carry fur, manes or faces.
