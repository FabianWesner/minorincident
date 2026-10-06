# Privacy fence modeling notes

Source crop: initial-drafts/l1v2-neighborhood-kit.png, pixel bounds [526, 603, 774, 823]. Built-in imagegen edit, one attempt, exact prompt in prompt.md.

One cedar privacy segment: fourteen separate upright boards, two capped square posts, upper/lower front rails and inferred matching rear support rails. Grain, knots and rail fasteners are raised solid details. woodWarm and leatherShadow are exact shared palette tokens. No texture dependency.

Blender +X front / +Z up; glTF +X front / +Y up. Place repeats 2.6 m apart along glTF Z (Blender Y). tileStart and tileEnd are at Blender Y = -1.3/+1.3 m. Caps meet at the repeat boundary with no overlap; paired end posts form a wider junction, rather than duplicate coplanar shared posts. The two-segment WebGL2 test confirms an unbroken fence. Height is approximately 1.80 m, maximum thickness 0.27 m. col:body is a fixed cuboid.

LOD1 retains all planks, rails, posts and caps using single-segment bevels. LOD2 keeps complete closed boxes for each board and rail plus capped posts; no wood grain, fasteners or automatic triangle erosion. All tiers bake deterministic CPU AO individually. Exact geometry/bounds are in validation.json.

Reproduce:

```sh
python3 experiment/tools/blender_run.py ../assets/prop.privacy-fence assets/prop.privacy-fence/build.py -- --glb assets/prop.privacy-fence/model.glb --render assets/prop.privacy-fence/renders/game.png --view game
npx tsx assets/prop.privacy-fence/pack.ts
```

pack.ts quantizes/compresses with the project optimizer and writes local validation.json. Runtime registration belongs to the integrator.
