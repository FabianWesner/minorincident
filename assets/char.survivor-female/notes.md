# Female survivor hero model

Frame: meters, +X forward, +Z up, -Y character right. Feet contact z=0.
Reference: reference-upscaled.png, checked against original crop and survivor sheet.
Target height 1.4 m including ponytail, face/head approximately one quarter height.

The reference's tee dominates the front; its red outer layer is exposed at the sides/back.
This build keeps that arrangement as an open sleeveless red jacket with white folded hood.
Detailed parts: tee/neckline/emblem, jacket, hood, denim shorts/cuffs/seams/pockets, belt
and buckle, utility tab, wristbands, fingers/thumbs, knee bandage, striped socks,
layered red high-top sneakers/laces/eyelets/tread, padded backpack straps, teal bag,
piping, zip tracks/pulls, compression straps, brass buckles, sculpted corgi badge,
face/eyes/brows/ears/nose/smile, chestnut swept fringe/crown/temple curls/ponytail.

Rigid hierarchy: root > hip > torso > head/arms; hip > legs > shins > feet;
arms > forearms > hands > weapon sockets. Backpack socket belongs to torso.
Every joint uses world-space anatomical pivots; static meshes merge by material per joint.
Applied subdivision used per explicit hero job request (overrides generic flat-model guidance).
Identity palette colors are exact starter tokens. Extra pal_* entries for skin, hair,
denim, brass, bandage and face details are explicit flat swatches; no texture files.

Final review: five rounds; 55,616 triangles; 80 merged material groups; 23 flat palette
materials. 1.410 m height. Head/face refined toward oval eyes; sharp tee-fold additions
removed. Browser captures use the existing viewer; capture-fitted.mjs zooms out its
study camera for this tall character. Model geometry is deterministic across rebuilds.
See review.md, validation.json, browser-validation.json and report.json for evidence.

M1 scalp fix: the scalp cap and every `lock()` strand were wound inward, so the
single-sided runtime materials culled them and the crown showed skin from the game
camera. Both now wind outward; the cap radii clear the face sculpt by about 1 cm.
`model.lod2.glb` is an authored tier (the per-part floors of `assets:pack` stop
near 5.7%, above the 4.5% LOD2 contract): plain meshopt pre-pass on the source
(weld, ratio .03, error .05, no border lock), then the standard
`optimizeDocument(..., .03)`, saved without `deliveryLodGenerated`. Rebuild with
`python3 tools/blender/run.py <build.py> --glb model.glb`, `npm run assets:pack -- <id>`.
