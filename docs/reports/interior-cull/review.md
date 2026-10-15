# Game-camera review

Reviewed the PO reference `epics-pipeline/briefs/po-l5-interior-1015.webp`, the full-size closed/occupied shop captures, and [all 60 final geometry poses](matrix-overview.jpg). [WebGL2 results](matrix-webgl2.json) and [WebGPU results](matrix-webgpu.json) each cover five scenes × high/low × zoom 0.5/1/1.5. Actual backends were checked in their metrics; all runs reported zero console errors.

- **PASS — shell:** the PO shop keeps its pink tiled side wall, red door frames, floor and black roof trim. Closed interiors do not leave a hole in the facade.
- **PASS — occupied interior:** the freezer, shopping cart, shelf frames and colored stock appear with the lifted/cut roof. High and low retain the same readable arrangement at both required zooms.
- **PASS — same-frame reveal:** the enter/leave scene changes from the closed shop to the fully stocked cutaway on its first rendered entry frame, and closes again on exit. Compare the [last closed frame](reveal-frame-15.png) and the [first cutaway frame](reveal-frame-16.png). The final player/reveal cache also passed all 12 backend/tier/zoom combinations.
- **PASS — streets:** L4 keeps its bright storefronts, benches, paving and lamp silhouettes; L5 keeps the same street layout with its darker ruined facades and debris. The courier stays readable at zoom 0.5 and 1.
- **PASS — geometry fidelity:** the reference-loop regression compares every submitted triangle’s position, normal, color and palette attribute bits and winding across the new interior partitions. No triangle/appearance budget was relaxed.

The PO fixture assembles on the east sidewalk and places the courier at the exact reported coordinate on frame zero because that narrow continuous-physics position lies between walkable nav cells. Full-level performance captures use the actual coordinate, seed 1, four found survivors and zoom 1.5.
