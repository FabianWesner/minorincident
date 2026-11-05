# inf.crawler

Adult legless crawler, +X forward, Z up, right side -Y. Approximate extents: 1.55 m long, 1.15 m wide, 1.04 m tall including hair. Oversized head retains the chibi silhouette of the supplied turnaround. The crouched silhouette uses two arms to support a hunched upper body; the trousers terminate in short torn stumps.

Head calibration (q260): retain the full PROD `fd8f56ca3` head and neck bind geometry. The standing head/height ratio is invalid for this crouched pose: q249's shrink buried the face between the shoulders. Run `node --import tsx assets/inf.crawler/restore-head.ts` to reproduce all three LODs, both texture tiers and the corpse bakes. This retains q249's 0.75 hand scale and the current height fitting rules; it changes no other figure.

Reference: white collared shirt with rolled sleeves, loose bloody red tie, charcoal trousers and belt, thick brown tousled hair, glowing red irises, bloody cheek/chin and clothing. The upscaled turnaround and explicit legless brief take precedence over ambiguous shoe-like remnants in the original crop.

Rigid hierarchy: root → hip → torso → head/armL/armR; upper arm → forearm → hand. Short thigh stumps attach to legL/R. Shin and foot nodes remain geometry-free contract joints. No weapon sockets are required. Backpack socket remains for the category contract. Dismemberment caps sit on the surviving side of their joint and export at zero scale, with showScale and ss_hidden extras.

All subdivision, bevel, remesh and reduction modifiers are applied. Details merge by palette material within each rigid joint. Blood surfaces ray-fit to underlying forms with 4 mm clearance. No image textures. Deterministic random seed 187.
