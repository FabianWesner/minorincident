# Prototype flamethrower

The L10 hangar weapon is a two-hand, under-barrel-fuel prototype. The chunky olive receiver and rear stock continue the weapon kit's palette; the broad burner shroud and yellow fuel-cylinder bands make its fire role readable at courier scale. A routed brass fuel hose connects the cylinder and burner assembly.

- Build axis: Blender Z-up, muzzle toward +X; ground contact at z=0.
- Measured envelope: 1.1625 m long × 0.355 m wide × 0.4221 m tall.
- `grip`: rear hand hold; `muzzle` and `flameOrigin`: burner tip/pilot-light origin; `pilot_light`: visible pilot assembly.
- LOD targets: 1,800 / 700 / 200 triangles. LOD2 retains the receiver, burner, cylinder, grips and pilot light.
- Courier fit: 0.65 scale, support hand 0.42 m forward of the rear grip in asset space, using the existing long-gun IK.
- Palette-only materials; no external textures or licenses.

The held-action muzzle hook reads `flameOrigin` for `weapon.flamethrower`, so the existing cover-clipped fire particles and muzzle light originate at the burner tip.
