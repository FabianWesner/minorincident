# Courier headlamp

Original procedural asset; no external reference or dependency. Licensed under the accompanying MIT license.

Rebuild from the repository root:

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --python assets/acc.headlamp/build.py
npx tsx assets/acc.headlamp/optimize.ts
npx tsx tools/assets/validate.ts --ids acc.headlamp
```

LOD0: 144 triangles; LOD1/LOD2: 80 triangles each. All four palette materials and the cap, brim, band, housing and lens remain in every tier. Delivery uses meshopt/quantization and retains the head pivot. `CharacterView` fits the +X lens above the female and male couriers' existing caps and attaches it to their `head` node, including the skinned rig. The pickup uses the same asset. It introduces no light: collection enables L6's existing warm beam and glow. Equipment is excluded from the civilian random headwear pool.
