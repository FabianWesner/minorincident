Police officer: adult alive, 1.42 m crown height; face plus cap approx 1/4 height. Reference matched navy short-sleeve shirt, charcoal ballistic vest, gold shield cap and sleeve badges, shoulder radio, duty pouches, two thigh straps/right holster, gloves and lugged boots. Applied sculpt smoothing; all static geometry grouped by material beneath 19 rigid joint/socket nodes. No textures.

Review history:
- Round 1: all 19 nodes exported; 64,688 triangles. Increased chest lettering and chibi head/hand volume after front/side/back review.
- Round 2: 61,567 triangles. Browser preflight passed WebGPU and WebGL2 with zero warnings/errors; measured 1.418 m height. Found cap/sleeve badge gaps and overly regular nape locks.
- Round 3 changes: simplify smaller sculpted/bevel meshes, matte dark hair and vest, staggered overlapping nape volumes, stronger brows, closer badge relief, outward normal cleanup.

Round 4: conform shield backs to cap and sleeve surfaces via local raycasts, keeping 4 mm relief clearance. Final: 51,703 triangles, 68 meshes. Both backends and fitted captures passed; final hero, four-view turnaround and pose test reviewed.
