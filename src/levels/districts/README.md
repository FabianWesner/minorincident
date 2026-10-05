# District authoring (E10)

`layouts/<id>/layout.py` uses `tools/blender/sslib/layout.py` to export unique static meshes,
`inst:` placement empties and `anchor:` empties in Blender. The exporter converts to game
coordinates: metres, +Y up, +X forward. Base and W1–W5 geometry are merged by palette material;
removable base nodes keep their names. Build with `npm run layouts:build -- D-RES` (all districts
if no ID), or force a deterministic rebuild with `--force`. Preview with
`python3 tools/blender/render_preview.py --layout D-RES`.

The committed layout JSON is the gameplay source for bounds, roads/lanes, footprints,
collider AABBs, excluded walkable regions, lawn masks, named anchors, acoustic presets,
surface polygons and power groups. Later surface polygons override earlier ones. Geometry
hashes cover vertex positions, topology, materials, tier and transforms. The build cache
uses the district script, shared Python sources, referenced manifest entries and referenced
asset bytes; gameplay TypeScript never enters its key.

`<id>.ts` holds gameplay locations, routes, triggers, interactable/objective placements,
photo poses and cumulative blockers/fire/power changes. `anchor(name)` resolves against the
layout; explicit `{x,z}` positions need no Blender rebuild. Cross-validation rejects missing,
outside, blocked or unreachable locations and reports orphan anchors in the state snapshot.
The 1m nav bake inflates heavy obstacles by 0.4m and flood-fills required objective paths.

`compositions.ts` selects districts, origins, tier, time of day and gameplay overrides. All
selected districts load before play; `L6` composes all eight. District IDs also name isolated
compositions for authoring/verification. A tier override on an isolated district selects its
matching day/night mood; campaign compositions retain their authored time of day.

Test API v1.3 implements `loadLevel(id,{seed,tier})` for world composition, adds an optional
`getState().districts` snapshot (absent in foundation fixtures), and reports render batches,
nav hash, power state, removal lists, vector minimap, warnings and fire count. Camera poses
are `<district>/W<tier>/<overview|landmark>`. `settings.set({windowMask:true})` selects a
probe-only white-window/black-world pass for measured decay. `perf().loadTiming` splits JSON,
simulation and view load costs. Missions, progression and checkpoints retain explicit stubs.

Render uses the existing Bruno-adapted `InstancedGroup`. For full-world budgets, the survivor
merges rigid meshes within each animated joint and bakes authored swatches into vertex colors;
joints, gear sockets, motion and shadows remain intact. Other character fixtures keep their existing mode. Asset prototypes and palette
materials are shared across reloads; per-level instance buffers, grass geometry, signs,
emitter views and physics are disposed on unload. Placeholder assets remain in use until
manifest status reaches `integrated` or `final`. Lawn grass uses deterministic fixed placement
and GPU tip bending; per-frame CPU work updates one wind uniform.
