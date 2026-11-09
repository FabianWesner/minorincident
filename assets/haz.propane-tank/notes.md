# Propane cylinder

Original low-poly pressure cylinder with rounded ends, a protective collar, brass service valve, transverse handle and three welded feet. Palette: redDark, uiDark, brass. Grounded at y=0; forward +X.

Rebuild source and base delivery with `node --import tsx/esm tools/assets/build-propane-tank.ts`, then produce distance tiers with `node --import tsx/esm tools/assets/pack.ts haz.propane-tank --regenerate`. Validate with `node --import tsx/esm tools/assets/validate.ts --ids haz.propane-tank`.

All geometry is authored in the generator using the project's existing permissively licensed Three.js primitives. No external model or texture is used.
