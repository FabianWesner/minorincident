# Cashier hero model review

Reference reviewed: reference-upscaled.png, reference.png, original zombies-civilian-characters sheet; proportion/finish comparison against accepted inf.common-worker, police-car and fire-engine hero renders.

Three modeling rounds:
1. Uniform, vest, apron/bows, badge, face, bun, sneakers and rigid rig. Browser/studio review exposed upward palms, unprojected blood corners and a smooth bun.
2. Corrected hands, projected blood with a 4 mm offset, added bun locks, normalized overall scale. Front/side/back/three-quarter review exposed the unfinished rear hair coverage and overly dark back uniform.
3. Added nape locks and rear bun folds, revealed the white back shirt between charcoal straps, integrated cheek/jaw blood regions, increased forward lean and stance width. Reviewed all four studio angles and both browser backends.

Final comparison: the high brown bun and loose bangs, pale adult chibi face with emissive red eyes and open toothed mouth, white short sleeves, charcoal vest/trousers, rectangular badge, red draped apron with rear ties, and chunky stained sneakers preserve the reference's identity. Sculpted locks and explicit garment folds interpret the illustration in the same rounded rigid-part language as the accepted worker. Both planted soles contact z=0. Height is 1.635 m including the bun.

Hero: 1600×900, 96 Cycles samples. Turnaround: front/side/back/three-quarter, 1680×540. Pose test: 960×540, 24 samples. The test rotates armL, foreArmL and legR, enables stump_armL, and removes the other arm to show its proximal cut cap. Parent relationships and requested changes are recorded in pose-audit.json.

Export audit: 39,307 triangles; 59 unique GLB meshes / 60 render primitives; all required nodes and seven hidden, zero-scale proximal stump caps; nine palette/emissive materials; no images/textures; finite mesh positions and valid indices. All subdivision, bevel and reduction modifiers are applied. Rest joint scales are one and rotations zero. Canonical geometry/material/topology fingerprint matches across rebuilds; binary serialization ordering is not byte-identical.

Final WebGPU and WebGL2 captures both report no console warnings/errors or page errors. The provided shared runner was used for every Blender build/render; no dev server was started. Source cleanup removed unnecessary device discovery and consolidated review/delivery/turnaround utilities. Reference images and other asset folders were not edited.

Verdict: complete for this hero GLB delivery. No outstanding requested-delivery gaps.
