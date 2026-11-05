# E10 · World, Districts and World-State Decay

## Goal
Build Sunset Grove as **districts** that levels compose, with a **decay-layer system** (W0–W5) so one layout serves many levels. Authoring is **hybrid** (decision O1): the static world comes from **Blender layout scripts** (`layouts/<district>/layout.py` → layout GLBs + layout JSON), and gameplay anchors come from **TypeScript data** (`src/levels/districts/*.ts`), validated against the layout. That way the player sees the town fall apart, and L6 can revisit earlier places.

## Depends on / Enables
E02 / E09, E11, E12, all levels.

## Scope
**In:**
- **Static world: Blender layout script** (`layouts/<district>/layout.py`, `bpy`, in git, uses `tools/blender/sslib` + `sslib.layout`). It builds terrain, roads (curbs, crosswalks, markings), lawns, lots, and static dressing, and exports:
  - `public/assets/layouts/<district>.base.glb`: unique static geometry, merged by material
  - `public/assets/layouts/<district>.w1.glb … .w5.glb`: **visual decay layers** (additive geometry; e.g. burned facades, rubble, wrecks), plus a removal list for base nodes
  - **Placement empties** for repeated props and buildings (`inst:<assetId>` with transform and decay-tier range). The runtime instantiates these from the asset GLBs through `InstancedGroup` (Bruno's reference-GLB approach), so props are not duplicated into the layout mesh.
  - **Named anchor empties** (`anchor:<name>`, e.g. `anchor:diner-door`, `anchor:hardware-display`)
  - `public/assets/layouts/<district>.layout.json`: bounds, road graph with lanes, building footprints, static colliders, the walkable mask source, the anchor table (name → transform), light groups (lit windows and lamps per block, so W3 power outages can switch them), **acoustic zones** (reverb-preset polygons, `09` §4), a **surface map** (asphalt, grass, wood, tile, metal, gravel; footsteps and tire sounds), and a geometry hash
  - Preview renders of the district via the shared studio render scripts (`tools/blender/render_preview.py --layout <district>`)
- **Gameplay data: TypeScript** (`src/levels/districts/*.ts`, type-checked): spawn points, spawn volumes, triggers, objective anchors, interactable placements, civilian routes and safe points, photo spots, dynamic nav-blockers, and the **gameplay side of decay layers** (blockers that change navigation, fire zones that deal damage, power-out light groups to disable). Positions are given either as `anchor('<name>')` references into the layout JSON or as explicit coordinates. **Tuning gameplay never requires a Blender rebuild.**
- **Level composition:** the level selects districts, a tier, a time of day, and overrides.
- **Runtime-only ground effects:** grass (Bruno `Grass` adapted, GPU wind, placed from a lawn mask in the layout JSON), and trees and bushes as instanced foliage from placement empties.
- **Streaming:** all districts of a level load at level start (no open-world streaming); a loading budget applies.
- **Districts for v1:** D-RES, D-MAIN, D-SCHOOL, D-SHOP, D-CIVIC, D-PARK, **D-ZOO** (Sunset Grove Zoo, between D-CIVIC and the rail line), D-EDGE. Perch points for cats and flock roosts for crows are layout anchors.
- **Minimap data:** a top-down render target or vector map from the road graph and buildings.

**Out:** interactive objects (E11) and mission scripting (E12).

## Bruno references
Reuse first, per the [reuse map](08-bruno-reuse-map.md). Read these before writing new code:
- [`World/World.js`](../folio-2025/sources/Game/World/World.js): assembly
- [`References.js`](../folio-2025/sources/Game/References.js): placement empties
- [`InstancedGroup.js`](../folio-2025/sources/Game/InstancedGroup.js): props
- [`Terrain.js`](../folio-2025/sources/Game/Terrain.js): ground shading
- [`World/Floor.js`](../folio-2025/sources/Game/World/Floor.js): floor + bedrock
- [`World/Grass.js`](../folio-2025/sources/Game/World/Grass.js): grass with TSL wind (port)
- [`Tracks.js`](../folio-2025/sources/Game/Tracks.js): local influence RT
- [`World/Foliage.js`](../folio-2025/sources/Game/World/Foliage.js): instanced foliage
- [`World/Trees.js`](../folio-2025/sources/Game/World/Trees.js): trees
- [`World/Bushes.js`](../folio-2025/sources/Game/World/Bushes.js): bushes
- [`World/Flowers.js`](../folio-2025/sources/Game/World/Flowers.js): flowers
- [`Wind.js`](../folio-2025/sources/Game/Wind.js): wind uniform
- [`World/WaterSurface.js`](../folio-2025/sources/Game/World/WaterSurface.js): river and creek
- [`World/PoleLights.js`](../folio-2025/sources/Game/World/PoleLights.js): street lamps
- [`World/Scenery.js`](../folio-2025/sources/Game/World/Scenery.js): road placement
- [`TextCanvas.js`](../folio-2025/sources/Game/TextCanvas.js): sign text

## Acceptance criteria

| ID | Criterion | Verification |
| --- | --- | --- |
| E10-AC01 | Every layout JSON validates: closed bounds, road graph connected, no placement empty overlaps a road lane (except allowed types), all `inst:` asset IDs exist in the manifest | unit |
| E10-AC02 | The nav grid is baked deterministically (same hash per seed), and every walkable region needed by the level is connected (flood fill from the player start reaches all objective anchors) | sim |
| E10-AC03 | Decay layers apply additively: for each district, the W0…W5 prop counts and the light-on counts change monotonically as defined (e.g. lit windows W0 ≥ W3 ≥ W5; wreck count rises) | unit |
| E10-AC04 | The same district at W0 and W5 from the same photo spot differs visibly: the mean luminance of the lit-window mask drops, fire emitters > 0 at W5, and the vision checklist §7.5 "decay reads" passes for each district | visual/vision |
| E10-AC05 | Instancing: repeated props (fence, lamp, cone, tree, hedge, parked car) render through instanced batches; draw calls for a full district ≤ 250 at the high tier | perf |
| E10-AC06 | Level load time for the largest composition (L6) ≤ 6 s on the desktop reference machine with warm cache, in a production build | perf |
| E10-AC07 | Colliders match visuals: for each building and heavy prop the collider AABB is within 10% of the visual AABB in X and Z | unit |
| E10-AC08 | Photo spots for every district and tier exist and produce non-empty screenshots (no NaN camera, ≥ 30% non-sky pixels) | e2e |
| E10-AC09 | District look passes the **Diorama vision checklist** (`90` §7.1) against its draft sheet (D-RES ↔ S05, D-MAIN ↔ S06, D-SCHOOL ↔ S07, D-SHOP ↔ S08, D-PARK ↔ S09, D-CIVIC ↔ S10) | vision |
| E10-AC10 | Minimap data matches the world: the road polylines of the minimap overlay the 3D road centerlines within 1 m | unit |
| E10-AC11 | Cross-validation TS ↔ layout: every `anchor('<name>')` used in district or level data exists in the layout JSON; every spawn point, trigger, and objective anchor lies inside the district bounds and on a walkable nav cell (spawns) or a reachable cell (objectives); orphan anchors are reported as warnings | unit |
| E10-AC12 | `npm run layouts:build -- <district>` runs headless Blender, is deterministic (identical geometry hash and identical layout JSON on rebuild), and changing only a TS gameplay file triggers **no** layout rebuild (build cache keyed on the layout script + sslib + referenced asset hashes) | static |
