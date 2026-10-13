# kit.crossing-crash (L9-A2)

Collapsed road/bridge crash site for the mandatory L9 crash (epic 31, section 5.4 and 5.7). Visual-only kit, no collider (`world.solid: false`): the sim ground stays flat and the D-CROSSING route tests are unchanged; S6 owns the trigger, camera and the crash itself.

Local origin is the centre of the 16 m gap (layout x=516, z=0), +X along the road, ground z=0. The terrain gully itself (sloped banks, 8 m floor 5.5 m down, tapering to ground level at z=+-90, a hole cut into every ground and road patch, and a matching hole in the DistrictView backdrop plane) is authored in `layouts/D-CROSSING/layout.py`; this kit dresses it: nine broken asphalt teeth per lip with concrete undercut, three fallen deck slabs (asphalt top, broken centre line, ragged ends with rebar), three broken pier stubs with bent rebar, torn guard rails with a bent beam hanging into the gap, cracks on both approaches, faceted block rubble and two copies of the existing `decay.rubble-pile` GLB (reused, LOD matched per tier). Sockets: `debrisOrigin` (falling debris above the near lip), `smokeSocket`, `explosionSocket` (gully floor), `front`. No scorch decals on purpose: dark polygons read as holes at night; the explosion is S6's VFX.

Triangles LOD0/1/2: 5,616 / 2,688 / 1,952 (spec cap bridge+rubble 16,000 / 5,500 / 2,000). Authored tiers (`--lod 1|2`): bevels off, thin prisms and rails keep their sides longest, lip teeth 9 / 9 / 7, round columns replaced by boxes; the far tier drops slab-end teeth, edge lines and rail/rebar detail only where the silhouette check allows. `tests/unit/assets/lod-fidelity.test.ts` passes without a baseline entry (game-view IoU 0.82 / 0.82). That check is a 48 px raster of a sparse object, so any change to chunks, rods or piles must re-run it: `npx vitest run tests/unit/assets/lod-fidelity.test.ts -t kit.crossing-crash`.

Rebuild:
```
python3 tools/blender/run.py assets/kit.crossing-crash/build.py --lod 0 --glb assets/kit.crossing-crash/model.glb
python3 tools/blender/run.py assets/kit.crossing-crash/build.py --lod 1 --glb assets/kit.crossing-crash/model.lod1.glb
python3 tools/blender/run.py assets/kit.crossing-crash/build.py --lod 2 --glb assets/kit.crossing-crash/model.lod2.glb
npm run assets:pack -- kit.crossing-crash && npx tsx tools/layouts/build.ts D-CROSSING
```
(`assets:pack` rewrites `src/assets/staticCollision.ts`; revert that file, the kit has no collider.)

Crash anchors in the D-CROSSING layout (game space): `crash-approach` (470, 0), `crash-impact` (508, 0, near lip), `crash-wreck` (517.7, -5.5, 0, wrecked APC at yaw 90 sits clear of slabs and piers), `crawl-start` (527.5, 0, 2.6), `crawl-fallback` (527.5, 0, -3.2), `crawl-end` (547, 0, safe L10 start). Seven wrecks (truck, school bus, police sedan, sedan, pickup, two `veh.wreck`) and three barricades flank the approach on the verge, two more `veh.wreck` lie on the gully floor. The 12 m lane stays open: the E09 route-test cars overshoot the (450, 0) corner and oscillate by +-3 m for 50+ m, and they must reach x >= 538 across the gap (the sim ground there is flat).
