# Courier cargo bike — production review

Verdict: **PASS**, side tier, four review rounds. Reviewed against both the original crop and the imagegen-cleaned reference. The orange long-john frame, teal lidded front cargo box, diagonal courier marking, small front/large rear wheel, black saddle, headlamp, rear luggage rack and deployed stand preserve the reference identity.

Checklist C (specs/90-test-concept.md §7.1):

- **PASS [must] Gameplay recognition:** the long box silhouette, two unequal wheels and orange/teal blocks remain readable in the high camera capture.
- **PASS [must] Main layout:** the cargo box lies between the front axle and rider; the step-through frame, rear rack, handlebar and lamp occupy the reference positions.
- **PASS [must] Material separation:** rubber tires/grips and saddle are dark, spokes/rims are silver, the frame/tub are orange, and the side panels are teal with cream raised markings.
- **PASS [should] Hidden sides:** the opposite cargo panel repeats the fictional lettering/graphic, and inferred forks, rack struts, pedals and steering linkage remain consistent with the bicycle design.
- **PASS [should] Budget and faceting:** LOD0 is 9,266 triangles, with softened box/saddle edges and 24-segment wheel silhouettes; gameplay captures show no distracting faceting at normal distance.
- **PASS [must] Fictional identity:** only “Sunset Grove Courier” and an original wing-stripe graphic appear; no real-world brands or character content.

Deliberate side-tier simplifications: the shared `pal_orange` token is more amber than the concept's saturated orange; saddle contour, grip texture and fine tire markings are simplified. LOD1 removes lettering and small cosmetic/hidden parts; LOD2 uses intact closed box/frame shapes and annular wheels, omitting lettering, mudguards and rack supports. The rejected automatic-decimation versions showed damaged faces with backface culling and are not delivered.

| Level | Triangles | LOD0 ratio | Bytes | Draw calls |
| --- | ---: | ---: | ---: | ---: |
| LOD0 | 9,266 | 100% | 159,176 | 23 |
| LOD1 | 1,384 | 14.9% | 37,440 | 16 |
| LOD2 | 356 | 3.8% | 16,380 | 12 |

All three exports are quantized, Meshopt-compressed and texture-free, use known shared palette materials, and retain `seat`, `wheelF`, `wheelR` and `basket` as named independent nodes. Wheel pivots are at their axles; semantic nodes have unit scales. Additional body/handlebar/lamp groups, rider/exit sockets, a collider and physics/light extras are present. CPU Cycles bakes AO to the exported `ao` vertex-color layer; studio reviews use Eevee with backface culling enabled. Ground contact is exactly Y=0 in glTF. LOD0 measured bounds are 2.797 × 1.204 × 0.760 m in game XYZ.

Validation: all tiers have finite positions, zero degenerate triangles and single-sided materials. Both WebGPU and WebGL2 load all three delivered compressed files without console errors or warnings. Repeated fixed gameplay frames 1.2 seconds apart have **zero changed pixels** on both backends. A second build reproduces all three GLBs **byte for byte**.

The legacy `/preview/glb.ts` viewer lacks a Meshopt decoder. `browser-check.mjs` injects the standard Three.js MeshoptDecoder into the served viewer module solely inside the test; no preview files were edited. The shipped files remain compressed. The runtime registry already configures its decoder; central registration/integration remains with the orchestrator.

Evidence retained: `reference.png`, `reference-upscaled.png`, `renders/hero.png` (1600×900, 96 samples), `renders/game.png`, four Eevee turntable views, final Three.js turntable/game captures for both backends and all LODs, `validation.json`, `browser-check.json`, `rebuild-check.json`, and `report.json`. Intermediate review renders were deleted.

Rebuild all GLBs:

```sh
python3 experiment/tools/blender_run.py ../assets/veh.courier-bike assets/veh.courier-bike/build.py -- --glb assets/veh.courier-bike/model.glb
```

Render final studio views:

```sh
python3 experiment/tools/blender_run.py ../assets/veh.courier-bike assets/veh.courier-bike/build.py -- --render assets/veh.courier-bike/renders/hero.png --width 1600 --height 900 --samples 96
```

Run browser review (existing server on port 3300, explicit headless mode):

```sh
sh tools/e2e-lock.sh node assets/veh.courier-bike/browser-check.mjs
```

No manifest or registry changes; no commit.
