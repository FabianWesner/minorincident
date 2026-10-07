# Asset tooling

`npm run assets:build -- veh.fire-engine` runs Blender 5.2, validates the raw
export, bakes CPU Cycles AO, optimizes all three hero LODs and validates them
before replacing runtime outputs. `BLENDER_BIN` overrides the standard macOS
installation. Builds use three threads, three global process slots and one
Cycles slot, shared with the reference runner when its locks exist.

Shared scripts implement `build(ctx)` and return a root object. The context
contains `quality`, `seed` and `decay`; the CLI accepts `--quality high|low`
and `--decay <declared variant>`. Batch selection supports `--all` and
`--changed` (working-tree changes against HEAD). Existing standalone scripts
accept `--glb`. This E17 lane rebuilt only the fire engine; supplied production
exports were inspected unchanged.

`npm run assets:pack -- --all` packs existing detailed exports without running
Blender or changing `model.glb`. It writes runtime GLBs under `public/assets/models`
and missing source `model.lod1.glb` / `model.lod2.glb` beside each export.
Use an asset ID or category prefix instead of `--all` for an incremental pack.
Assets with `authoredLodRatios` keep reviewed Blender-authored tiers and their
hard normals. Packing checks the declared triangle ceilings and refuses missing
tiers or `--regenerate`; rebuild those from their `build.py` source. The initial repair
used ratio ceilings; native distance variants now use `authoredLodTriangles`
(12,000/4,000 for buildings, 6,000/2,000 for vehicles) and may never be larger
than the next-better tier. These explicit caps apply to the repaired chain; the small printed
lab sign kit retains its glyph geometry at every tier. Other
authored tiers are preferred; generated tiers record their provenance and are
regenerated from LOD0. `--regenerate` rebuilds all selected distance tiers.
Targets are 12% / 3% of LOD0; retries stop before destroying small rigid parts.
Simplification measures error per connected component and per axis, preserving
thin panels in large assemblies. Component extrema stay locked and small parts
retain their geometry. Static surfaces use tighter error to retain curved shells
and lettering. Sixteen-bit positions keep millimetre geometry from quantizing flat. Micrometre seam
rounding allows lower tiers to weld exporter duplicates before simplification.
Geometry floors that exceed the target remain explicit validation failures.
Weapons, throwables and pickups above 2,000 triangles require LOD1 only.
All other hero/side exports require both tiers. Required pivots, sockets, skin
joints, animation targets and closed infected caps survive every tier.
Quantization and meshopt preserve palette materials and active vertex AO;
no palette conversion is performed. `--all` also packs layout/crowd GLBs and
copies the licensed Three.js Basis transcoder into `public/assets/basis`.

`npm run assets:validate` checks delivery for every available source export,
including assets awaiting manifest registration, and the full authored contract
for registered production and modeled/integrated/final assets. It enforces LOD
presence, maximum triangle ratios (15.5% / 4.5%), LOD1 bytes (25%), hero/side
sizes (1.5 MB / 300 KB), codecs, textures, required names and animation/skin
preservation. Intentionally empty source bones remain required empty pivots.
Pending assets retain their status; their placeholder dimensions and authoring
budgets are not mistaken for real-export contracts. Findings are written to
`test-results/epics/E17/validate.json` (or `validate-production.json` with
`--production`) and cause exit 1. No delivery exceptions are silently waived.

`npx tsx tools/assets/delivery-report.ts` records shipped bytes, all export tiers,
and both active and planned start-district asset payloads. For temporary visual
comparison and measured network bytes, build first and run:

```sh
ASSET_DELIVERY_VISUAL=1 E2E_PORT=3337 sh tools/e2e-lock.sh npx playwright test \
  tests/visual/asset-delivery.spec.ts tests/e2e/asset-delivery-download.spec.ts \
  --project=chromium --workers=2
```

Contact sheets use the close isometric camera at 16 m and the same camera at
30 m. `inspection=1` in the test viewer renders actual files pending registration;
it does not alter runtime status gates. Delete sheets after review.

`assets:optimize -- <id>` also exports supplied LODs for side assets. Optional
`generatedLodRatios` in the manifest regenerates a tier from LOD0 when its
supplied export violates the size or density contract. Compound corpse rigs
keep prefixed joints and stump caps; distant generated caps use six sides.
Animal dimensions use their own metre scales, outside the standing-adult height check.

Palette tokens live in `src/assets/palette.json`. AO is the active `COLOR_0`
attribute. PNG atlases require `toktx` on PATH or `TOKTX_BIN`; color maps use
ETC1S, detail maps use UASTC. Texture-free builds need no encoder. The bundled
Three.js Basis transcoder is loaded by KTX2Loader.

`npm run assets:bake-crowd -- inf.common-worker` reads a supplied LOD1 or
generates lower-density geometry without rebuilding Blender. It exports one
primitive per palette material, `_PART_INDEX` and a sampled rigid-part clip
in scene extras. E07 can supply its clip evaluator to `bakeCrowd`.

The registry returns independent clones of cached prototypes and logs
`asset.placeholder` for unavailable or pre-integrated art. Use
`loadAsset(id, 'lod0'|'lod1'|'lod2', decay?)`; `lodForScreenHeight` selects
tiers at 160 and 40 pixels. Palette replacement preserves named gameplay
nodes, light/collider extras and sockets.

`/preview/?asset=<id>` provides orbit, wireframe, explode, node, LOD and decay
controls. With a production preview already running on the lane port,
`E2E_PORT=3313 npm run assets:turntable -- veh.fire-engine` saves four views
plus the gameplay camera and a reference comparison. It also accepts `--all`
(integrated/final assets) and `--changed`. It never starts another server.
`npm run assets:crop -- veh.fire-engine` uses `assets/regions.json`.

References first resolve locally, then in the supplied main checkout. Template
briefs and reviews are in `tools/assets/templates/`. Final status requires an
existing comparison, all must items passing and at least 70% of should items.
Milestone production and the infected gore-probe review remain separate batch
work; a passing readiness guard does not complete those criteria.

`E2E_PORT=3349 sh tools/e2e-lock.sh npx tsx tools/assets/lod-check.ts <id> ...`
saves small 3×2 contact sheets to each asset’s `renders/lod-check.png`, using
shipped GLBs, game palette/light, 36° elevation, and 45°/225° azimuths. It uses
one headless Chromium process with ANGLE/Metal and requires an existing server.

Native distance builds use the same source primitives without bevels, drop
interior furnishings/small trims, flatten wheel faces and use fewer cylinder/curve
samples. No triangle-collapse decimator runs on these tiers. Source scripts accept
`--distance-tier 1|2 --glb assets/<id>/model.lodN.glb`; full source exports and
`--lod-only` rebuild both native tiers. Use the existing `blender_run.py` wrapper
from the main checkout, with CPU Cycles. A minimal interior floor, rigid owners,
roof groups, lamps and sockets remain addressable. `distance-stats.json` records
exact omissions and raw triangle counts.

`compactMeshopt` uses the smallest supported lossless attribute encoding
(level 3, bitstream version 0 or 1); geometry, AO, normals and quantization
precision remain identical. It brings mainstreet-brick and school-elementary
LOD0 below 1500 KiB. The game decoder is verified by contact-sheet loading.

House and vehicle distance caps are absolute: houses LOD1 ≤ 12,000 / LOD2
≤ 4,000 triangles; every manifest vehicle LOD1 ≤ 6,000 / LOD2 ≤ 2,000.
Validation enforces these independently of declared budgets and authored ratios,
including pending registrations that already have production GLBs.
Native exports preserve detailed-source batch names and late sockets. Sources
that fit their hero geometry to manifest dimensions also fit their native tiers.

For five-angle side-by-side LOD0/1/2 sheets using shipped geometry:
`E2E_PORT=3349 sh tools/e2e-lock.sh npm run assets:turntable -- <id>,<id> --lod-contact --output test-results/asset-fix-2`
Each asset gets `<output>/<id>/lod-contact.png`. This mode needs no reference
image, fails on placeholders, and uses one headless Chromium process with Metal.

Art registration wave 0 documents the current inventory in `art-register-triage.md`, missing models/compositions in `missing-models.md`, and retained distance budgets in `art-register-lod-budgets.md`. Cheap meshes (up to 3k triangles), side props (up to 12k), and handheld/pickup models (up to 6k) may retain complete geometry; dense unexceptioned meshes still use ratio budgets. Independently articulated models have a 4k triangle floor. Vehicle/house distance caps remain absolute. Delivery sizes use 1500/300 KiB, matching `fileKB`. Only native road/house tiers require decreasing bytes, because other authored material/normal streams can grow independently of triangles.
