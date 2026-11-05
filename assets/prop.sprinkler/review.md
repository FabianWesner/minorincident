# prop.sprinkler — side-tier review

Reviewed 2026-10-06 against the original labelled sheet crop and imagegen-cleaned reference. Retained render: `renders/game.png` (Eevee, one-sided materials, orthographic close game angle). 3 bounded modeling rounds.

## Checklist C

- **PASS [must] Recognizable silhouette.** Green stepped base, yellow perforated head, hose loop and brass coupling preserve the opaque prop design.
- **PASS [must] Main part layout.** The major components and their relative placements match the concept crop; hidden surfaces are closed and plausible.
- **PASS [must] Material separation.** Palette-named materials distinguish painted parts, wood/metal, foliage, cloth and rubber as appropriate; no image textures or coplanar overlays. Baked vertex AO has a soft 0.55 floor, preserving readable colors on framed surfaces.
- **PASS [should] Hidden sides.** Back and underside volumes remain consistent with the toy-like styling; normals are corrected and culling remains enabled.
- **PASS [should] Budget/readability.** LOD0 2,708 triangles / 5 primitives; no visible silhouette breakdown in the close game render. LOD1 320 (11.8%), LOD2 72 (2.7%). LOD0 63,780 bytes (≤300 KiB).

## Verification

- Determinism: two fresh raw exports compared with the project's `geometryHash` validator; geometry/winding/node transforms match.
- GLB audit **PASS**: palette tokens, AO colors, finite positions, non-degenerate triangles, +X front, ground contact, collider nodes, meshopt compression and quantization, LOD ratios and delivery budgets.
- WebGL2: PASS — headless Chromium / Metal loaded and rendered all three compressed LODs without errors.
- WebGPU: manual check deferred per repository guidance.
- Shared repository gates: typecheck/lint passed; 200 unit tests passed, two TODO. No epic verification is claimed for this unregistered asset batch.

## Modeling decisions / limits

The reference design is retained at side tier; tiny woven/wood details use geometry rather than textures. All models use metres, +X forward, Z-up in Blender, and ground at z=0. Each committed `build.py` embeds its modeling/export helpers and imports only the existing project sslib. Rebuild via the wrapper, then run `pack_lods.mjs prop.sprinkler` in the garden-set directory’s documented pipeline. The individual ID is not registered in the manifest, as requested.

**Verdict: PASS for modeled side-tier delivery.** Integration and WebGPU manual sign-off remain with the integrator.

The reference’s water spray is deliberately excluded from the opaque mesh and must be supplied by runtime VFX; it is not a baked mesh effect.
