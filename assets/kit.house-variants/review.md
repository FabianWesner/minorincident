# kit.house-variants collection review

Source crop and imagegen cleanup verified against initial-drafts/l1v2-neighborhood-kit-2.png. The collection is split into the labelled individual IDs, per the requested scope. Each item has a self-contained build.py, model.glb, model.lod1.glb, model.lod2.glb, reference crops, retained Eevee game render, and review.md.

- `house.garage.closed` — see `../house.garage.closed/review.md`.
- `house.garage.open` — see `../house.garage.open/review.md`.
- `house.garage.half` — see `../house.garage.half/review.md`.
- `house.porch-a` — see `../house.porch-a/review.md`.
- `house.porch-b` — see `../house.porch-b/review.md`.
- `house.driveway.empty` — see `../house.driveway.empty/review.md`.
- `house.driveway.anchor` — see `../house.driveway.anchor/review.md`.
- `house.driveway.hoop` — see `../house.driveway.hoop/review.md`.

No aggregate collection GLB is supplied: these are placement-ready individual props/kit pieces. No manifest changes or commits. WebGPU/integration are deferred; automated WebGL2 checks use the shared headless lock.
