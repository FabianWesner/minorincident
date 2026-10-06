# prop.lawn-chair-a — side-tier review

Reviewed 2026-10-06 against the original labelled sheet crop and imagegen-cleaned reference. Retained render: `renders/game.png` (Eevee, one-sided materials, orthographic close game angle). 3 bounded modeling rounds.

## Checklist C

- **PASS [must] Recognizable silhouette.** White plastic seat, arched slatted back, raised arms and splayed legs reproduce the garden-chair silhouette.
- **PASS [must] Main part layout.** The major components and their relative placements match the concept crop; hidden surfaces are closed and plausible.
- **PASS [must] Material separation.** Palette-named materials distinguish painted parts, wood/metal, foliage, cloth and rubber as appropriate; no image textures or coplanar overlays. Baked vertex AO has a soft 0.55 floor, preserving readable colors on framed surfaces.
- **PASS [should] Hidden sides.** Back and underside volumes remain consistent with the toy-like styling; normals are corrected and culling remains enabled.
- **PASS [should] Budget/readability.** LOD0 1,520 triangles / 2 primitives; no visible silhouette breakdown in the close game render. LOD1 180 (11.8%), LOD2 38 (2.5%). LOD0 43,216 bytes (≤300 KiB).

## Verification

- Determinism: two fresh raw exports compared with the project's `geometryHash` validator; geometry/winding/node transforms match.
- GLB audit **PASS**: palette tokens, AO colors, finite positions, non-degenerate triangles, +X front, ground contact, collider nodes, meshopt compression and quantization, LOD ratios and delivery budgets.
- WebGL2: PASS — headless Chromium / Metal loaded and rendered all three compressed LODs without errors.
- WebGPU: manual check deferred per repository guidance.
- Shared repository gates: typecheck/lint passed; 200 unit tests passed, two TODO. No epic verification is claimed for this unregistered asset batch.

## Modeling decisions / limits

The reference design is retained at side tier; tiny woven/wood details use geometry rather than textures. All models use metres, +X forward, Z-up in Blender, and ground at z=0. Each committed `build.py` embeds its modeling/export helpers and imports only the existing project sslib. Rebuild via the wrapper, then run `pack_lods.mjs prop.lawn-chair-a` in the garden-set directory’s documented pipeline. The individual ID is not registered in the manifest, as requested.

**Verdict: PASS for modeled side-tier delivery.** Integration and WebGPU manual sign-off remain with the integrator.
