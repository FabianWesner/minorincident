# Lightweight shotgun ammunition pickup

Performance revision: LOD0 ≤2,500 triangles, ≤6 draw calls. The original open carton silhouette and dimensions, palette colours and all seven exported node names remain. Three broad eight-sided red/gold cartridge shapes replace the five detailed shells. Stepped bases, primers, small wear marks and multi-segment bevels are omitted. Front markings are flat raised geometry reading `12 GA` and `AMMO`, at least 3 mm clear of the printed panels.

Static geometry batches: `body`, `static_blood`, `static_picketWhite`, `static_schoolBusYellow`, `static_survivorRed`, `static_uiDark`, under `root`. No moving parts or lights. Deterministic vertex AO is baked using the shared helper; no textures. The same script exports model.glb, model.lod1.glb and model.lod2.glb, preserving node names while decimating the two lower levels to 50% and 25%. Base geometry is restored before rendering.

Build uses the shared Blender runner. Hero is rendered at 1600×900, 96 samples; game render at 960×540, 24 samples. No manifest edits.

## Art registration (2026-10-07)

Measured delivered bounds (X/Y/Z, metres): 0.4223, 0.3962, 0.584. Source, named pivots/sockets, palette, front marker and delivered tiers are validated by the production validator. Runtime status is integrated. Five-angle LOD contact evidence: `test-results/art-register/pick.shotgun-ammo/lod-contact.png`.
