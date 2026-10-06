# 03 · Asset Pipeline

**Codex imagegen** (reference) → **clean, upscaled reference** → **agent-written Blender Python (`bpy`) build script** (source of truth, in git) → **headless Blender exports GLB** → **gltf-transform optimization** → **the game loads GLB only** (WebGPU with WebGL2 fallback).

There is **no img2threejs in production**. The existing `assets/fire-engine/` was made with img2threejs and is a **legacy study**. Its upscaled reference and measured spec (dimensions, axle spacing, part list in `object-sculpt-spec.json`) are inputs for the Blender rebuild.

Tooling: Blender **5.2.2 LTS** at `/Applications/Blender.app/Contents/MacOS/Blender` (set by the `BLENDER_BIN` env var, defaulting to that path).

## 1. Principles

1. **Scripts, not .blend files, are the source of truth.** Every asset is reproducible from `assets/<id>/build.py` + the shared library with one headless command. `.blend` files are optional, git-ignored by-products for inspection.
2. **Gameplay never waits for art.** Every asset ID has a **code placeholder** (primitive boxes and capsules with correct dimensions, named nodes, sockets, and colliders) from day one. A GLB replaces it by ID with no gameplay code change.
3. **Contracts before art.** The asset manifest declares dimensions, forward axis, required named nodes, sockets, colliders, and budgets. The validator enforces them on the exported GLB.
4. **Shared look.** Scripts only use **palette materials** from the shared library (`01-art-direction.md` §3). At load, the game swaps them for the `PaletteMaterial` node material by name (Bruno's approach: material identity comes from Blender, shading from Three.js).
5. **Merge for draw calls, separate for motion.** The export merges static geometry by material. Nodes that animate (wheels, doors, limbs, ladders, sirens, dismemberable parts) stay separate, named objects with pivots at their joints.

## 2. Folder layout

```
assets/<id>/
  reference.png              crop from initial-drafts (if drafted)
  reference-upscaled.png     clean, isolated, upscaled (Codex imagegen)
  views/*.png                turnarounds (characters, vehicles, complex props)
  prompt.md                  imagegen prompts, tool, date
  build.py                   bpy build script: SOURCE OF TRUTH
  notes.md                   modeling decisions, measured proportions, deviations
  review.md                  vision review (checklist C/B), verdict
tools/blender/
  sslib/                     shared bpy library: palette.py, primitives.py (beveled boxes, rounded cylinders,
                             tapered limbs), naming.py, pivots.py, sockets.py, colliders.py, decay.py, export.py
  build.py                   entry: blender -b --factory-startup -P tools/blender/build.py -- --asset <id> [--quality high|low]
  render_preview.py          optional quick Eevee turntable (the in-game turntable is authoritative)
layouts/<district>/
  layout.py                  bpy layout script for the static world (terrain, roads, dressing, decay layers, placement + anchor empties)
  notes.md / review.md
public/assets/layouts/
  <district>.base.glb, <district>.w1..w5.glb, <district>.layout.json   (see E10)
public/assets/models/
  <id>.glb                   optimized runtime GLB (high)
  <id>.low.glb               low tier (generated or a script variant)
  <id>.crowd.glb             infected only: baked crowd geometry (partIndex attribute)
  <id>.meta.json             export metadata: nodes, bbox, tris, materials, hash
```

## 3. Stage A: reference image (Codex imagegen)

- Drafted items: crop the region from the `initial-drafts/` sheet (`tools/assets/crop.ts` + `assets/regions.json`), then have Codex imagegen produce a **clean, isolated, upscaled** reference, as done for the fire engine (485×226 → 1837×856).
- New items (no draft): generate with the **style preamble**, attaching 1–2 concept sheets as style references.
- Characters, infected, vehicles: a **turnaround** of front, side, back, and 3/4 views. The draft sheets already contain turnarounds for the survivors, the corgi, and all infected; upscale each view.

Style preamble (prepend to every prompt):

> Stylized low-poly 3D game asset in the art style of the attached "Minor Incident" concept sheets: chunky toy-like proportions, warm saturated colors, soft golden-hour lighting, clean readable silhouette, slight bevels, no text unless specified. Single object, centered, three-quarter isometric view from front-right at ~30° elevation, plain neutral dark-gray background (#2a2730), no shadow clutter, no other objects. No real-world brand names, logos or trademarks; invent fictional brands (e.g. "Sunset Fuel", "Maple Hardware", "Joe's Diner"). Every infected or civilian character is clearly an adult or an older teen (18+ proportions), never a child.

For turnarounds: "orthographic-looking front, left side, back and three-quarter views side by side, same scale, T-pose-free relaxed stance, arms slightly away from the body".

## 4. Stage B: Blender build script (agent-written)

### 4.1 Conventions inside Blender

- Units: meters, scale 1.0, transforms applied before export.
- **Blender is Z-up; the asset front faces +X** and the asset sits on z = 0 (ground contact), centered on X/Y. The glTF exporter's +Y-up conversion maps Blender +X to glTF +X, so in-game forward is **+X** (`02-technical-architecture.md` §3).
- Object names = node names in the manifest (`body`, `wheelFL`, `armL`, `weaponSocketR`, …). Sockets are **empties**. Colliders are empties with a custom property `collider` (`cuboid|capsule|cylinder` + size) and never export as meshes.
- **Pivots** (object origins) sit at joints: shoulders, elbows, hips, knees, the neck, wheel centers, door hinges, the ladder base.
- Materials: only `sslib.palette.mat('<token>')` (names `pal_<token>`), plus `emi_<token>` for emissives and `keep_<name>` for the rare special material (glass, neon with a texture). No image textures by default. Painted details (logos, signs, text) use small atlas textures declared in the manifest.
- Style: the `sslib.primitives` helpers apply consistent bevels (0.02–0.06 m), chunky proportions, and flat or weighted normals. Do not use subdivision surfaces on export.
- **No coplanar surfaces (z-fighting):** decals, stripes, lettering, posters, badges and panel plates stand at least 3 mm proud of the surface beneath them (or are inset/cut into it); never place two faces in the same plane. Review the game-camera view for flicker before calling an asset done.
- Determinism: no randomness, or a seeded `random.Random(asset_seed)`. Two builds must produce identical geometry hashes.

### 4.2 Script contract

```python
# assets/<id>/build.py
from sslib import palette, primitives as P, naming, pivots, sockets, colliders, export
ASSET = { "id": "veh.sedan-red", "category": "vehicle" }
def build(ctx):            # ctx: quality ('high'|'low'), seed, decay variant (None|'wrecked'|'burned'|...)
    body = P.rounded_box("body", size=(4.4, 1.9, 0.9), bevel=0.08, mat=palette.mat("survivorRed"))
    ...
    return ctx.root        # root empty named ASSET["id"]
```

`tools/blender/build.py` loads the script and calls `build()` per requested quality and decay variant. It then validates the scene in Blender (names, pivots, tri count) and exports with fixed exporter settings (`export_format='GLB'`, `export_apply=True`, `export_yup=True`, no cameras or lights, custom properties as extras).

### 4.3 Agent modeling loop (bounded)

1. Read the reference and the views. Write `notes.md` with measured proportions (from the draft scale comparison: survivor 1.4 m) and a part list.
2. Write `build.py` blockout → build → in-game turntable (§6) → compare with the reference (vision checklist C/B) → refine.
3. **At most 4 refine iterations per asset.** If it still fails, mark the asset `needs-human` in `review.md` with the failing checklist items.

### 4.4 Characters and infected

- **Rigid-part models**: separate objects for the head, torso, hip, upper and lower arms, hands, upper and lower legs, and feet, with pivots at the joints. They are animated in code by procedural clips (`02` §6). No skinning in v1.
- **Dismemberment-ready** (gore, `01` §7): infected limbs (`armL/R`, `foreArmL/R`, `head`, `legL/R`) are separate nodes, each with a hidden **stump cap** child (`stump_armL`, …) that the game shows when the limb detaches.
- Variants share bodies: one base body per build class (`adult`, `kid`, `large`) plus clothing and accessory parts and per-variant palette tokens, in one script with a `variant` parameter.

### 4.4b Lights, physics, AO (extras on export)

- **Lights:** light-emitting assets add `light:<name>` empties with an `ss_light` custom property (contract in `06-lighting-shadows-reflections.md` §6). Lamp meshes use `emi_*` materials referenced by the anchor.
- **Physics:** movable assets add `ss_physics` on the root plus `col:<name>` collider empties (contract in `07-physics-props-explosions-smoke.md` §7). Bruno reads `friction` and `restitution` from GLB `userData` the same way (`Objects.js`).
- **Baked AO:** every script bakes ambient occlusion into a color attribute `ao` (`sslib.ao.bake(obj, samples=32)`, Cycles, deterministic seed). `PaletteMaterial` multiplies it.
- **Previews:** `render_preview.py` renders a **day turntable and a night turntable with lights on**. The night version turns the light anchors into Blender lights (Eevee bloom, soft shadows, volumetrics), so the reference-style render (e.g. the light-tower trailer) is reviewed lit as well as unlit.

### 4.5 Decay variants

Vehicles and buildings expose `ctx.decay` variants (`wrecked`, `burned`, `boarded`, `collapsed`) built from the same script, using `sslib.decay` helpers (dents by vertex offset with a seed, broken glass removal, char palette swap, missing parts). Each one exports as `<id>.<variant>.glb`.

## 5. Stage C: export, optimization, integration

1. **Build:** `npm run assets:build -- <id>` (or `--changed` / `--all`) runs headless Blender (`--factory-startup --python-exit-code 1`), writing a raw GLB to `.cache/assets/` and the `<id>.meta.json`.
2. **Optimize** (`tools/assets/optimize.ts`, using the gltf-transform API, following Bruno's `scripts/compress.js` approach):
   `dedup → prune → weld → join (by material, keepNamed for manifest nodes and all animatable / socket / stump nodes) → quantize → meshopt compression`. Textures (rare) become KTX2 (`etc1s` for color, `uastc` for detail). The low tier uses `simplify` (meshoptimizer) at a ratio of about 0.5, unless the script provides `--quality low` geometry.
3. **Crowd bake** (infected only, `tools/assets/bake-crowd.ts`): merges all parts into one geometry with a `partIndex` vertex attribute and a rest-pose table, giving `<id>.crowd.glb` for GPU-instanced crowds (E07).
4. **Runtime registry** (`src/assets/registry.ts`): `loadAsset(id, quality)` uses GLTFLoader + MeshoptDecoder (+ KTX2Loader), caches prototypes, swaps materials to `PaletteMaterial` by name, resolves required nodes and sockets, and falls back to the code placeholder with an `asset.placeholder` log.
5. **Validation** (`npm run assets:validate`, Node, reads GLBs with gltf-transform; no WebGL):
   - the GLB exists for every manifest entry at status ≥ `modeled`
   - bounding box = `dimensions ± tolerance`
   - required nodes and sockets exist; animatable nodes are separate (not joined)
   - forward axis: the nodes tagged `front` lie on +X of the bbox center
   - triangle and material counts are within budget
   - all materials are `pal_*`, `emi_*`, or `keep_*`, with known palette tokens
   - no NaN or degenerate geometry
   - a rebuild is deterministic (geometry hash equal)
   - file size within budget

## 5b. District layouts (hybrid, decision O1)

Static world geometry is authored like assets: `layouts/<district>/layout.py` is a `bpy` script (code, diffable, reviewable) built with `npm run layouts:build -- <district>`. It exports layout GLBs, decay-layer GLBs, placement and anchor empties, and a layout JSON (format in `epic-10-world-districts-decay.md`). **Gameplay anchors (spawns, triggers, objectives) are TypeScript data**, never baked into the layout, so tuning needs no Blender rebuild. A validator cross-checks TS anchors against the layout JSON (E10-AC11). The shared studio render script produces district preview renders for quick review; the in-game photo spots remain the authoritative visual check.

## 6. Turntable and viewer

- `npm run assets:turntable -- <id>` renders the **GLB in the game renderer** (palette material, game lighting) from 4 views (0/90/180/270°) plus the gameplay camera, to `test-results/assets/<id>/`. It also writes a side-by-side comparison sheet with `reference-upscaled.png`.
- `/preview/?asset=<id>` (the existing `preview/` page, rebuilt for GLBs): orbit, explode (separate nodes), wireframe, node picker, decay-variant switch, quality switch.

## 7. Asset manifest (`src/assets/manifest.json`)

```jsonc
{
  "id": "veh.sedan-red",
  "category": "vehicle",                 // vehicle | character | infected | weapon | prop | building | tile | fx | ui
  "status": "placeholder",               // see §9
  "script": "assets/veh.sedan-red/build.py",
  "glb": "public/assets/models/veh.sedan-red.glb",
  "placeholder": "box:4.4x1.5x1.9",
  "dimensions": { "x": 4.4, "y": 1.5, "z": 1.9, "tolerance": 0.1 },   // game space, Y up
  "forward": "+X",
  "requiredNodes": ["body","wheelFL","wheelFR","wheelRL","wheelRR","doorL","lightsFront","lightsBrake"],
  "animatedNodes": ["wheelFL","wheelFR","wheelRL","wheelRR","doorL"],
  "sockets": ["driverSeat","exitL","exitR"],
  "colliders": "from-glb",               // or explicit list
  "budget": { "triangles": 6000, "materials": 8, "fileKB": 120 },
  "decayVariants": ["wrecked", "burned"],
  "source": { "draft": "initial-drafts/suburban-homes-backyards-and-street-props.png", "region": "parked-vehicles-1" }
}
```

**Required nodes by category:**

| Category | Required nodes |
| --- | --- |
| character | `root, hip, torso, head, armL, armR, foreArmL, foreArmR, handL, handR, legL, legR, shinL, shinR, footL, footR, weaponSocketR, weaponSocketL, backpackSocket` |
| infected | the character nodes (no weapon sockets except Butcher, Firefighter, Riot) **+ stump caps** `stump_head, stump_armL/R, stump_foreArmL/R, stump_legL/R` |
| corgi | `root, body, head, tail, legFL, legFR, legBL, legBR, packSocket` |
| quadruped (dogs, cats, lion, zebra, elephant) | `root, body, neck, head, jaw, tail, legFL, legFR, legBL, legBR, pawFL…pawBR` (+ stump caps for infected) |
| primate (gorilla) | character nodes with longer arms, plus `throwSocketR` |
| bird (crow, flamingo) | `root, body, head, wingL, wingR, tail, legL, legR` (crows in flocks are crowd-baked, E17-AC07) |
| vehicle | `body, wheelFL, wheelFR, wheelRL, wheelRR, lightsFront, lightsBrake, driverSeat, exitL, exitR` (+ `sirenL/R` for emergency vehicles, `ladder` for the fire engine) |
| weapon | `grip, muzzle` (ranged), or `grip, tip` (melee), or `grip` (throwable) |
| building | `root`, optional `door_*`, `window_*` (emissive), `roof` (hidden when the player is inside), `interior` |

**Detail tiers (decision 2026-10-05, from the three-round Blender shootout in `experiment/`):**

| Tier | Used for | LOD0 budget | Look |
| --- | --- | --- | --- |
| **Hero** | everything the player sees up close and often: survivors, corgi, NPCs, infected, vehicles, buildings | survivor/NPC ≤ 60k, infected ≤ 40k, vehicle ≤ 80k, building ≤ 100k triangles; animals (appear in groups): crow ≤ 3k, cats/small dogs ≤ 8k, flamingo ≤ 10k, large dogs ≤ 12k, gorilla/lion ≤ 25k; mostly flat structures (helipad, pads, decks) ≤ 20k | rich, finished, soft-bevelled forms, many purposeful parts ("round 1") |
| **Side** | props and street furniture (vending machine, bench, hydrant, weapons, pickups) | 6–12k (weapons ≤ 6k) | chunky but detailed: insets, frames, multi-part wheels, glowing strips ("round 3") |
| **Distant** | objects the player never approaches in regular play (skyline, far terrain dressing) | 1–4k | chunky low-poly, flat palette ("round 2") |

Hero assets ship an **LOD chain**: LOD0 (hero), LOD1 ≈ side-tier density (≈ 10–15% of LOD0), LOD2 ≈ distant-tier density; the runtime picks by screen size, and crowds (infected hordes) render LOD1/LOD2 or the crowd bake beyond ~12 m. Draw calls per asset after joining: hero ≤ 40, side ≤ 30, distant ≤ 12 (animated nodes excluded). Measured reference (25 copies, game camera, M1 Max): hero ≈ 8–15 ms, side ≈ 1.5–2.5 ms, distant ≈ 1.5 ms per frame on WebGPU — so LODs are mandatory for anything that appears more than a handful of times.

## 8. Placeholders

`src/assets/placeholders.ts` generates a code placeholder for any manifest entry: boxes and capsules sized to `dimensions`, every required node as a correctly placed child, magenta-and-gray stripes so placeholders are obvious in screenshots. A test fails if a level at milestone exit still shows placeholders for assets scheduled for that milestone (E17-AC09).

## 9. Status lifecycle

`placeholder → reference (cropped) → upscaled → scripted (build.py exists, builds) → modeled (GLB passes validate) → integrated (registry + in-game use + turntable) → final (vision review passed, review.md signed off)`

`05-asset-inventory.md` tracks the status per asset. The manifest `status` must match it (`T-E17-06`).

## 10. Batch production with Codex

GLBs and layout outputs are **committed to git** (decision O2): `public/assets/models/` and `public/assets/layouts/`. CI validates them in Node and, where Blender is available, rebuilds changed sources and fails if the committed GLB's geometry hash differs from the rebuild (no stale or hand-edited GLBs).

Use the `codex-scheduler` skill: queue imagegen jobs (Stage A) and build-script jobs (Stage B) per asset ID, with a parallelism of 3. Each job writes only inside `assets/<id>/`. After each batch, run `npm run assets:build -- --changed && npm run assets:validate && npm run assets:turntable -- --changed`, then do the vision reviews. Headless Blender runs are CPU-only and safe to run in parallel (one process per asset).
