# Modeling notes

Source: `initial-drafts/l1v2-neighborhood-kit-2.png`, crop [469,769,854,873]. Five independent placement parents preserve the manifest's `sign_authorized`, `sign_nobike`, `sign_hazard`, `sign_deliveries`, `keypad`. Grounded metre-scale posts, sign tops about 1.35 m; assembly arranged along Y for review, faces +X, Z up.

Chunky metal posts, inset face plates with raised borders and fasteners. All lettering is mesh geometry; bicycle, red prohibition ring, black exclamation and arrow are geometric, with no textures. Keypad: bevelled grey housing, dark inset face, green screen, 12 raised numeric buttons and card reader. Screen uses palette foliageLight, not a custom color. READY/numeric legends clarify the original tiny markings.

Rebuild: `python3 experiment/tools/blender_run.py ../assets/prop.lab-signs assets/prop.lab-signs/build.py -- --glb assets/prop.lab-signs/model.glb --render assets/prop.lab-signs/renders/game.png`. Then `npx tsx assets/prop.lab-signs/optimize.ts`.

Manifest is untouched: current 2×2×0.3 dimensions are a placeholder. Integrator must use actual dimensions in report.json (or place named pieces individually), and add script/source/LOD paths.

Delivery: build exports all three GLBs with deterministic CPU Cycles AO; optimize.ts applies the project glTF-transform/meshopt pipeline locally. validate.ts runs the shared validator against the measured side-tier contract without registering it. Only final hero and game-camera images are retained. WebGPU must be reviewed manually.
