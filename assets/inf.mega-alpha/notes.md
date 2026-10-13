# Mega Alpha (L10 final boss)

`build.py` derives from the shipped worker exactly like `inf.alpha` (same node names, identity rest rotations, hidden stump caps), so the Alpha special-move clips retarget unchanged. Worker x3.3 height (measured 5.03 m, 2.0x the Alpha's 2.51 m), extra breadth (x1.3), a 24 degree hunch baked into the rest pose (rest rotations stay identity), head shrunk and dropped low and forward, and an oversized right arm (character right, x1.6 about the shoulder, hand included).

Authored features (palette only, six materials): hunch mass (`leatherShadow`), bone-white spine ridge (`picketWhite`) riding the hump, blood scar slashes on the chest and the hump, enlarged emissive eyes with brow wounds.

Tiers: LOD0 15,580 triangles (decimated worker surfaces plus the features; 2x the Alpha's 8,000 cap is 16,000). LOD1 5,610 and LOD2 1,900 are closed solids: each rigid part is voxel-remeshed per material (watertight union), reduced, welded and stripped of any non-watertight island; the features are re-authored with fewer segments; stump caps are rebuilt as closed ellipsoids per tier. No decimation of open surfaces. LOD1/2 source meshes have no open edges (see `build-stats.json`; LOD0 inherits the worker surfaces' open edges like the Alpha).

Rebuild:

```sh
python3 tools/blender/run.py assets/inf.mega-alpha/build.py --glb assets/inf.mega-alpha/model.glb
npm run assets:pack -- inf.mega-alpha
npm run assets:validate -- --ids inf.mega-alpha
```

Budgets (manifest): 16,000 / 6,000 / 2,000 triangles, 6 materials, 1,600 KB LOD0. QA: `specs/scenes/catalog/inf-mega-alpha-lineup.json` (`npm run scene:catalog -- --matrix --filter 'inf-mega-alpha-lineup'`) and `npx tsx tools/scenelab/lod-objectives.ts <out> inf.mega-alpha`.
