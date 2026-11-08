# L10 vignette asset batch

Reproduction (from repo root, sequentially, no browser):

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup -t 1 --python-exit-code 1 --python assets/l10-vignettes/build.py -- --batch
python3 assets/l10-vignettes/atlas.py
node --import tsx/esm tools/assets/l10-vignettes.ts
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup -t 1 --python-exit-code 1 --python assets/l10-vignettes/render.py
```

`build-report.json` records actual Blender triangle counts for the five new small props, capped at 800/300/60 per tier. `delivery-report.json` validates all 33 delivered tiers. `corpse-source.json` identifies reused production worker geometry and three frozen death poses; these are the existing 840-triangle character LOD2, not newly modeled small props. No living actors, rigs or per-frame animation are added.

The cow uses the existing zebra quadruped builder with stockier proportions, horns, cattle colors and a frozen fallen pose. Lowest tier is a closed, deliberately coarse silhouette. Sedans reuse existing wreck meshes with open doors. Helicopter reuses the army helicopter, rolls the hull, detaches the bent rotor, and turns off emissive lenses. Vehicle derivatives retain fixed physics-only colliders.

The atlas contains only the two verbatim environmental messages authorized in `docs/design/story-script.md`, plus spent casings and cold ash. Runtime cells 0/1 are writing, 12/13 are scatter. CPU Cycles renders are generated in `docs/reports/eg-l10-vignettes/assets/`; screenshots remain local under repository ignore rules. These are asset inspections, not game captures.
