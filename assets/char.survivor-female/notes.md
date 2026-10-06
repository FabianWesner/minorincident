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

## M1 crown coverage (2026-10-06)

Corrected inward cap winding; increased scalp clearance to survive distant simplification. Joint pivots, attachment sockets and rig hierarchy are retained. LOD0/1/2: 55,512 / 6,092 / 2,406 triangles. Distant geometry omits fine trim and retains coarse geometry for every required source contract node.

Rebuild hero through `experiment/tools/blender_run.py` with `--glb assets/char.survivor-female/model.glb`, then `npm run assets:pack -- char.survivor-female`. For authored LOD2, build with `--lod2 --glb .cache/m1-art/female-lod2.glb`, then run `npx tsx assets/char.survivor-female/pack-lod2.ts` after building all three edited humanoids. Do not use `--regenerate` after producing the authored tiers. Delivery-driver crowd geometry is rebaked from LOD1.

Regression: `npx tsx assets/char.survivor-female/scalp-regression.ts` casts exterior, backface-culling crown and rear rays against all 15 L1 humanoids and all three tiers. Before: exposed crowns on female survivor, civilian-man-a and delivery-driver. After: all 45 tier checks pass. Other audited humanoids needed no source edits. Desktop/iPhone game-camera and rear-view renders are reviewed then deleted.

Final lane validation: typecheck and lint passed; unit 52 files / 136 tests passed; smoke 22 browser tests passed; `verify -- E19` passed (30 browser tests plus tagged sim checks). The actual L1 slice was exercised with mouse/keyboard and real CDP touch input at 1600×900 and iPhone portrait. Art regression scripts and selected-asset validation passed after final packing. No spec edits.
