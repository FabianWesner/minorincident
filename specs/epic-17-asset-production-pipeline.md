# E17 · Asset Production Pipeline

## Goal
Put the Blender-based pipeline from `03-asset-pipeline.md` into practice: the shared `bpy` library, the headless build, gltf-transform optimization, the crowd bake, the manifest and registry with placeholder fallback, palette material swap, the validator, the in-game turntable, and the GLB viewer. Then run it for the P0 → P2 assets in `05-asset-inventory.md`. The first proof is a **Blender rebuild of the fire engine** from its upscaled reference.

## Depends on / Enables
E01, E02 / every visual epic.

## Scope
**In:**
- `tools/blender/sslib/*` (palette, primitives, naming, pivots, sockets, colliders, decay, export) and `tools/blender/build.py`.
- `npm run assets:build`, `tools/assets/optimize.ts` (gltf-transform), `tools/assets/bake-crowd.ts`, and `tools/assets/validate.ts`.
- `src/assets/{manifest.json,registry.ts,placeholders.ts}` and the palette material swap.
- `npm run assets:turntable` and `/preview/?asset=<id>`.
- `tools/assets/crop.ts` + `assets/regions.json`.
- Templates for `prompt.md`, `notes.md`, and `review.md`, plus the inventory sync check.

**Production increments:** **M1** = P0 list, **M2** = P1, **M3** = P2, **M4** = P3.
**Out:** img2threejs (not used in production).

## Bruno references
Reuse first, per the [reuse map](08-bruno-reuse-map.md). Read these before writing new code:
- [`ResourcesLoader.js`](../folio-2025/sources/Game/ResourcesLoader.js): loaders + cache (port)
- [`Materials.js`](../folio-2025/sources/Game/Materials.js): updateObject material swap by name
- [`scripts/compress.js`](../folio-2025/scripts/compress.js): gltf-transform + toktx pipeline (adapt to meshopt)
- [`readme.md`](../folio-2025/readme.md): Blender export philosophy

## Acceptance criteria

| ID | Criterion | Verification |
| --- | --- | --- |
| E17-AC01 | `npm run assets:build -- <id>` runs headless Blender 5.2 (`BLENDER_BIN`), exits non-zero on any script error, and produces `<id>.glb` + `<id>.meta.json`; a second run gives an identical geometry hash (determinism) | static |
| E17-AC02 | `npm run assets:validate` checks every manifest entry at status ≥ `modeled`: dimensions ± tolerance, required and animated nodes present and **not joined**, sockets, forward +X, triangle, material, and file-size budgets, materials restricted to `pal_*`/`emi_*`/`keep_*` with known tokens, no NaN or degenerate geometry | static |
| E17-AC03 | The optimization keeps manifest nodes addressable: after `join`, every `requiredNodes` and `animatedNodes` entry still exists as its own node with its original pivot (world-space pivot delta ≤ 1 mm vs the raw export) | unit |
| E17-AC04 | **Fire engine rebuilt in Blender:** `assets/veh.fire-engine/build.py` produces a GLB that matches the legacy spec dimensions (length 7.4, width 2.1, roof 3.55 ±5%), has nodes `body, wheel*, ladder, sirenL/R`, passes validate, and passes vision checklist C against `reference-upscaled.png` | static/vision |
| E17-AC05 | Every asset ID referenced by data (actions, infected, vehicles, districts, levels) exists in the manifest; a missing GLB falls back to its placeholder with an `asset.placeholder` log, never a crash | unit/e2e |
| E17-AC06 | Inventory sync: every asset in the dated `05-asset-inventory.md` snapshot exists in the manifest at or above its snapshot status; the manifest records current integration status (parser test) | unit |
| E17-AC07 | Crowd bake: a baked infected renders 100 instances in one draw call per material; the GPU-animated pose matches the node-hierarchy pose within 0.02 m per part at 5 sampled clip times | unit/e2e |
| E17-AC08 | Turntable: 5 images per asset rendered in the game renderer, the object covering 10–80% of the frame, plus a comparison sheet with the reference | e2e |
| E17-AC09 | Milestone production: all P0 assets ≥ `integrated` at M1, P1 at M2, P2 at M3, and no placeholder visible at the milestone's level photo spots (ID-pass check for the placeholder material) | static/e2e |
| E17-AC10 | For each asset at `final`, `assets/<id>/review.md` exists with the vision checklist filled in, a pass verdict, and the comparison image path; assets marked `needs-human` are listed in the milestone report | static |
| E17-AC11 | Dismemberment readiness: every infected GLB contains its stump-cap nodes, hidden by default, and detaching a limb in the `gore-probe` scenario shows the cap with no visible holes (vision) | unit/vision |
