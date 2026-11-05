# prop.cure-canister

Backpack-style pressurised cure canister: steel tank with a glowing teal agent window (emissive `tealLight`), valve wheel, gauge, back frame and straps. Window faces -X, the frame faces +X. Attach: `backSocket` sits on the +X face of the frame; parent it to the courier `backpackSocket` (the existing equip attach point in `CharacterView`, a back-mounted pack hangs toward -X of the wearer). Stands on the ground (origin at the foot).

Dimensions (game Y up): 0.445 x 0.725 x 0.34 m. Blender Z up, front +X, ground z=0.

Source: `build.py` and `tools/blender/sslib/minigun_cure.py` (shared palette, no textures, deterministic Cycles vertex AO, authored LOD1/LOD2 as closed solids with explicit recipes, no decimation).
Triangles LOD0 / LOD1 / LOD2: 520 / 390 / 236 (budget rows proposed in `specs/05-asset-inventory.md` section 7.2: 800 / 500 / 300).

Rebuild/publish: `npm run assets:build -- prop.cure-canister`. Registry status: integrated; independent asset QA and level placement pending.
