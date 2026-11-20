The hanging suit is derived from the retained TRELLIS.2 hazmat source at
`/Users/wesner/Workspace/trellis-highs/l4-inf.hazmat/tris300000_tex2048.glb`
(SHA-256 `7ce105894078531371467cb41747e76a3da313d210d928c8a45060e1dd52d60b`).
Run `node assets/prop.l10-warning-effigy/simplify.mjs`, then
`python3 tools/blender/run.py assets/prop.l10-warning-effigy/build.py`, then
`npm run assets:pack -- prop.l10-warning-effigy`. The reducer retains source UVs;
the builder samples them and simplifies the result to broad palette masses so
it can use the existing instanced district renderer. The rope is a separate
world prop; the mesh and rope share a swing pivot. This is an effigy, not a live
infected or a new enemy model.
