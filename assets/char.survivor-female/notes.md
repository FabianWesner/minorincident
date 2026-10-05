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
