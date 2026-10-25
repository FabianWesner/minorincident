# Courier tier gear in the textured style (Q-183)

Lane `lane/courier-gear-tex`, 2026-10-25. PO, verbatim, with a close shot of the heroine's hands: "What does she have at her hands? Gloves?"
The old ray-fit gear wrapped khaki bands round her knuckles and a band round her chest, in flat palette colours, on the new textured bodies.

## What changed
- `assets/acc.courier-gear/build.py` (rewritten). Every piece is cut from the courier body's own surface (`char.courier-<sex>.skin.glb`):
  - **Field and cut.** Each piece has a smooth field: an oval round the knee or elbow, wrist planes, a neck sphere with straight armhole cuts, hem and belt heights, head bands and lens discs. The skin's own arm, torso, bag and pony ownership is blended into that field, and the skin is cut along the field's zero line.
  - **Cleanup.** Faces under another layer of the body are dropped (inner shirt shells, palms under curled fingers). The patch is refined to edges of 1.3 cm or less, the rim is thinned, and the patch is decimated to a budget per piece.
  - **Lift.** The patch is lifted along smoothed normals by the piece thickness, with a soft bulge. It is Laplacian-smoothed, then pushed out wherever a fold, strap or knuckle comes closer than half the thickness.
  - **Rim and weights.** A rim wall dives 3 mm into the skin, and those vertices are marked `_inner` for the attachment guard. Every vertex takes the skin weights at its anchor on the body, so the gear deforms like the skin under it.
  - **Gloves** are the fist itself, fingers included, 4.5 mm thick and full. Each has a teal cuff with a dark strap and an orange tab, and a stitched knuckle panel.
  - **Vest:** olive, quilted in 3.6 cm channels, with a zip and pull, two pockets and bound edges. **Pads:** slate domes with a light rim; the t3 shoulder pads have an orange rim. **Belt:** leather with a brass buckle and a side pouch.
  - **Tier 4:** forearm guards with rivets, and goggles with a strap and two teal lenses (glints, silver frame). The goggles are on the hair for her and on the cap for him, with the same parameters as before.
- **Texture.** Each survivor has one painted map: 512², WebP, about 60–80 KB. It is painted per texel in 3D (stitches, quilting, rims, glints), with one projected UV island per piece.
  - `tools/assets/courier-gear-compress.ts` now encodes the map as WebP.
  - `CharacterView.loadTierGear` draws the gear on the shared `Materials.fromTexture` route: hero and moving-figure flags, her night lift, blood, and a ref-counted release. Old GLBs without a map still use the vertex material.
- **Node and socket contract unchanged.** It is still one skinned mesh with `tierTris` draw ranges (1 draw call) and t1 < t2 < t3 < t4. The low quality tier gets the full gear: the low body is the same 6k mesh, and a decimated vest tore open (first `webgl2-low` sheet).
- **Budget change.** `tests/unit/render/courier-gear-tiers.test.ts` triangle budgets go from 1200 / 600 / 250 to 3400 / 3400 / 850.
  - The body went from 44.6k to 6k triangles on 10-24, so body plus gear is still below 10k (it was 45.8k).
  - Real numbers, LOD0: female 3,288 triangles, male 3,031.
- `tools/scenelab/gear-close.ts` is the evidence tool: close hands, torso and knees, and the game camera at the closest zoom (0.5) for idle, run and swing.

## Sheets (each one opened)
- `ab-prod-webgpu-low-{female,male}.jpg`: PROD (left) vs new (right), tiers 1–4, hands, torso and knees, WebGPU low.
  - PROD: khaki bands and a palm patch on her hands, and a band across the chest.
  - New: dark full gloves with teal cuffs, a full quilted vest with a zip, oval knee pads, a belt and shoulder pads.
- `webgpu-{high,low}-*.jpg` and `webgl2-{high,low}-*.jpg`: tiers 0–4 × hands, torso, knees, idle, run and swing.
  - WebGL2 and WebGPU match.
  - `webgpu-low` is the final build.
  - `webgpu-high` was taken with the 3.5 mm gloves, one step before the final 4.5 mm.
  - `webgl2-low` was taken with the superseded decimated low gear; its vest tears are why low now gets the full gear.
- `gear-map-female.jpg`: the painted map (vest at the bottom; pads, lenses, gloves and cuffs above).

## Gates
- Gear catalog `courier-gear-*` matrix: 72/72 WebGPU and 72/72 WebGL2 (144/144). After the low-tier change, the low rows were re-run: 36/36 + 36/36.
  - `courierAttachmentGapMaxCm`: max 1.5 cm (gate 2), at t4 swing male.
- Remote `tests/unit tests/levels`: 487 files passed, 3 skipped, 0 failed (exit 0).
- typecheck, lint (changed files) and `assets:validate` pass. The gear and loading unit tests: 27/27.

## Open
- From a low side angle her right glove shows an angular tip at the cuff.
- The vest edges keep a little of the TRELLIS shirt's lumpiness at the armholes.
- The male's watch face stays visible above his cuff (body texture).
- The build is not bit-deterministic (Decimate): triangle counts vary by ±10 between runs.
