# r36-lion: lion and lioness read as big cats (2026-11-11)

Finding (verbatim, r35-vqa): "Lion and lioness still don't read as big cats. The colour is fixed: both are tan now, including at Nadia's stop. The lion is still a spiky round mane ball with a tail, and the lioness a striped bell shape."

## Cause
The old lion was an image-to-3D reconstruction: a short chibi body hidden behind a spherical spiky mane; the lioness was that mesh with the mane squeezed in a vertex pass (the striped bell).

## What changed
- New body mesh built headless in Blender: `assets/amb.lion/build_cat.py` (Blender 5.2, via tools/blender/run.py). Long low barrel with a tucked waist and deep chest, four continuous legs with the shipped splayed stance (shoulder/elbow/wrist, haunch/knee/hock), round paws with toes, head with brow, muzzle, nose, jaw and fangs, ears, tufted tail. Lion: hood-shaped mane that sweeps from the withers around the head and hangs as a bib, face and muzzle free in front, lighter tips and a sawtooth rim. Lioness: no mane, sleeker head and longer muzzle, cream chest, no stripes.
- `tools/assets/build-l8-cats.ts` replaces only `skin_body` (positions, normals, UVs, joints, weights, part ids) and the atlas in the shipped GLBs, so the skeleton, joint names and bind pose, stump caps, materials and eye quads (re-seated on the new face) are unchanged. Weights are chain weights on the existing joints (hip/torso, neck/head, arm/foreArm/hand, leg/shin/foot, tail). Atlas = palette gradient strips (512 px, tan coat, cream, chestnut mane); infected variants get wound patches (same geometry, coat-coloured in the healthy atlas) and a redder mane. Tan colours kept.
- `tools/assets/bake-l8-cats.ts` re-bakes the four crowd deliveries (amb/inf lion/lioness), refreshes `civilianBakes.json`, removes the old bins and sets manifest dimensions from the new LOD0 body (2.25 x 1.12 x 0.82 lion, 2.25 x 1.01 x 0.69 lioness; was 1.89 x 1.30 x 1.08).
- Scene Lab: `lioness` accepted as an animal species in `src/debug/scenelab/spec.ts`; scenes `specs/scenes/r36-lion-cats*.json`.
- Animations (walk, run, pounce, roar, pin, death) are the existing procedural/baked ones on the same joints; nothing in the sim, hitboxes or AnimalMoves changed.

## Budgets (skin_body triangles, old -> new; whole-file incl. stumps from validate)
| | LOD0 | LOD1 | LOD2 | file LOD0 |
|---|---|---|---|---|
| lion | 7034 -> 3802 (total 4177) | 2634 -> 2003 (2164) | 920 -> 876 (945) | 303 KB -> 86 KB |
| lioness | 7034 -> 3462 (3837) | 2634 -> 1811 (1972) | 920 -> 804 (873) | 323 KB -> 82 KB |
`assets:validate --ids amb.lion,amb.lioness,inf.lion,inf.lioness`: no errors (all LODs and .low). No LOD dimension fallbacks.

## Verification (Scene Lab, game camera, old vs new, `sheet.jpg`)
Captured: night preset, WebGL2 high and low, zoom 1.5 and zoom 1 (idle, 4 cats: infected lion, infected lioness, healthy lion, healthy lioness), settled corpses, L8 zoo night run-in and pounce (r32-animalmoves scenes, lion and lioness), plus new-only WebGPU high idle and low zoom 0.5 (LOD2 distance; files in the lane scratchpad, not committed).
I looked at the sheet. Old column: round spiky mane balls with a face and stubby limbs; the lioness a white bell. New column: every figure is a long horizontal quadruped with four visible legs and a stance, a head with muzzle in front of the mane, a tail with a dark tuft; the lion's mane is a chestnut hood behind and around the head rather than a ball; the lioness has no mane and no stripes. Corpses read as fallen cats. The pounce frames show the stretched leap with forelegs reaching and the amber ring; the run-in shows a low cat. Skinning holds in the poses (no tearing, no gaps at elbow/knee after making the legs one continuous tube).
Also checked: validate clean, WebGPU idle renders (no console errors).

## Known limits
- Night fill makes the coat strongly orange (existing animal night boost, unchanged); the lion's mane reads a bit like a smooth hood from above, not individual locks. More lock detail fits the budget (LOD0 has ~3k triangles spare) if the PO wants it shaggier.
- Healthy wound patches are flush coat-coloured geometry (invisible). The scripted `run` action in my Scene Lab run scene did not move the cats (idle result); run is judged from the lion-game run-in frames instead.
- Overall length grew about 19 % (tail and muzzle follow the shipped joints); sim hitboxes untouched.
- No pounce/roar sim fixture run in real L8 play; qa:threat, unit suite and the matrix were not run in this lane.
- `assets/amb.lion/model.skin.glb` (old source) is stale; the shipped GLBs are produced by build_cat.py + build-l8-cats.ts. Rebuild: Blender build_cat.py `--out <dir>`, then `BASIS=<pipeline>/vendor/basis-encoder-2.1 node --import tsx tools/assets/build-l8-cats.ts <dir>` (templates are copied from the pre-r36 GLBs into `<dir>/templates` on first run; restore originals first), then `node --import tsx tools/assets/bake-l8-cats.ts`.
