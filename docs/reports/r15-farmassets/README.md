# L10 farm asset rebuild

Base: `08149d1a`. The existing farm asset IDs, manifest plot dimensions, placement random stream and transforms are retained. Route coverage and the dry landscape palette are owned by `r15-l10pace`.

## What changed

- Corn LOD0 has **154 tapered prism stalks, 616 curled leaves, 63 husked ears, forked tassels and 14 snapped stalks**. Plants lean and bend; boundary plants have thinner stems, shorter leaves and more gaps. Eight authored straw/ochre/brown swatches and darker roots replace the uniform crop colour. Twelve raised soil furrows and loose stubble are part of the same mesh. LOD1 retains 70 volumetric stalks and three curled leaves per stalk; LOD2 uses distant crop silhouettes over the furrows.
- The crop shader consumes the authored RGB. The production batch cache preserves that attribute, including its GPU memory trimming path. Soil remains visible when the courier fades the crop. Existing wind, actor rustling, instancing, cover and movement costs remain in use.
- Tractor: unequal round tyres with treads/hubs, tapered hood, radiator grille, open cab frame, seat, steering column, exhaust, fenders, steps, rust patches and mud ruts. Combine: large front drive tyres, grain hopper, high cab, auger, exhaust, inclined feeder, wide reel and cutter teeth. Both have authored burned variants and recognizable coarse silhouettes.
- Barn/farmhouse: walls, open escape doors, framed/boarded windows, pitched sagging roofs, missing panels, exposed rafters, torn roof edges, fallen timbers and burned variants. The barn also carries a corrugated grain silo, ladder, two bound hay rolls, broken paddock rails and cart ruts inside its original plot. Wall and annex colliders match the rebuilt shapes while retaining the central escape aisle. Existing scarecrows, carcasses, trees, fence placements and irrigator are retained.

Roof/aperture construction follows the native `bld.house-a` recipe. Geometry is authored in the existing headless Blender pipeline with shared palette colours and no new dependency or external model. Rigid farm palettes fold into one material; the crop retains one mesh/primitive at every tier.

## Visual review

[Before/after and all rebuilt LODs](compare.jpg) is the single committed image sheet. It includes the PO corn detail study, high/low crop fields, farm buildings and machinery at zoom 1 and 1.5, followed by all 27 rebuilt normal/burned tiers.

I opened the native renders and the assembled sheet. The close crop now shows narrow curling ribbons attached to solid stalks, husked ears, irregular snapped tops and brown soil between the planted rows. The former isolated triangular flags and blank floor are replaced by a layered dry field. At zoom 1 the high field has continuous crop coverage; the low field keeps discernible planted rows and a rough soil base. The barn reads as a roofed farm building with a grain bin and hay at its near wall; its missing roof reveals rafters. The farmhouse retains its chimney and roof mass when burned. The tractor's large rear wheels/open cab and combine's hopper/reel/feeder remain distinct at zoom 1.5.

The views are **native Cycles inspection renders**, with production camera geometry: vertical FOV 25°, polar `0.3π`, azimuth `π/4`, radius `19 × 1.3 × playerZoom`, 16:9. The close study uses the same lens/angles at an 8 m radius. Before and after staging, lights and camera are identical. [Camera metadata](camera.json) records the method. These are asset fixtures rather than runtime route captures; game fog, final grade, wind, crop fade and HUD are not rendered. No browser was launched.

## Budgets and verification

Source triangles, LOD0 / LOD1 / LOD2:

| Asset | Normal | Burned | Cap |
| --- | --- | --- | --- |
| Corn tile | 5790 / 1371 / 194 | — | 6000 / 1500 / 200 |
| Barn + silo/hay | 2936 / 1456 / 396 | 2936 / 1456 / 396 | 6000 / 2500 / 800 |
| Farmhouse | 1214 / 594 / 146 | 1216 / 592 / 144 | 6000 / 2500 / 800 |
| Tractor | 1348 / 468 / 184 | 1348 / 468 / 184 | 2500 / 1000 / 300 |
| Combine | 1412 / 568 / 236 | 1412 / 568 / 268 | 2500 / 1000 / 300 |

[Source budgets](asset-budgets.json), [packed counts](runtime-budgets.json), [asset validation](asset-validation.json), [rebuild hashes](determinism.json) and [command receipts](verification.json) are retained. All 42 source exports reproduce byte for byte, including the 15 unchanged farm tiers. The final [native audit](native-audit.json) and [E32 gate](E32-checks.json) pass: typecheck, lint and 106 tests passed, with one platform skip. All 42 delivered tiers validate; all 24 unfolded building/machinery tiers have [zero coplanar colour conflicts](raw-surfaces.json). Crop draws stay at one, with 8 / 8 / 7 RGB swatches retained through production batching. Both quality levels retain the same 240 farm placement transforms; all five buildings block wall contact and pass 354 escape-aisle samples in total. The final receipt source hashes match this checkout.

The native audit checks unchanged plots/placement transforms against the base recipe, all delivered tiers, one crop draw, retained RGB through the actual loader/batcher, unfolded geometry for coplanar colour conflicts, and wall contact/open escape aisles at high and low. The E32 per-change gate runs typecheck, lint and the unit suite; it uses no browser.

## Reproduce

```sh
python3 tools/qa/r15-farmassets-evidence.py --prepare
python3 tools/blender/run.py tools/blender/build_l10_farm.py --unfolded-check
python3 tools/qa/r15-farmassets-evidence.py --determinism
python3 tools/qa/r15-farmassets-evidence.py --inputs
MI_LOCAL_FALLBACK=0 sh tools/remote/run.sh "$PWD" \
  --pull docs/reports/r15-farmassets --pull public/assets/models -- \
  bash tools/remote/timing-isolated.sh --whole-run python3 tools/qa/r15-farmassets-remote.py
python3 tools/blender/run.py tools/blender/render_l10_farm.py --render
python3 tools/blender/run.py tools/blender/render_l10_farm.py --render --sheet
python3 tools/qa/r15-farmassets-evidence.py
rm .r15-farmassets-input.tar.gz
```

The temporary archive transports ignored native inputs to the runner and is not a delivery artifact. Blender runs locally headless; packing and CPU checks run on the shared runner. No specs, reference assets or read-only directories were edited. No deployment or push.
