# Blender reference preparation plan — 2026-10-08

The PO cancelled the image-to-3D experiment. Blender remains the modelling pipeline. This batch generates only missing turnaround references; generation has not been launched.

## Coverage

`plan.json` contains 405 distinct 3D asset IDs. Categories follow the manifest: prop 155, building 92 (includes interiors and new kits), character 53 (includes NPCs), infected 33, weapon 24 (includes throwables), vehicle 48.

- Existing: 290. References are read directly from the paths in `existing`. There are no briefs/jobs for these assets and no requested hero images. Restored `reference-upscaled.png` takes precedence over raw crops and experiment references.
- Sheet: 34. Exact pixel boxes and cropped `crop.png` files are supplied.
- Text: 81. New descriptions primarily cover L2–L6 military, Fairhaven, subway, aftermath and damaged variants.

`jobs.json` and `briefs/` contain only the 115 assets with no reusable reference. Each requests `turnaround.png` only: front, side, back and three-quarter views at consistent scale, matching the established restored turnarounds. No hero image is produced.

37 distinct restored gear and component models beyond the manifest are included. §6 wildcard requirements are expanded into concrete vehicle damage variants, corridor W2/W3 variants, Fairhaven W5 twins and aftermath/injury references. These planning IDs do not change the manifest.

`coverage.json` records provenance and exclusions. UI, flat decals, nonphysical abilities, unarmed actions, pose-only references and pure aliases are excluded. Physical `abl.turret` is retained; `ability.turret` is its excluded alias. Lighting key frames and bullet-hole decals are not 3D models. Legacy `fire-engine` is reused for `veh.fire-engine`; other matching legacy references are mapped to current IDs.

## Use

Resolve job `prompt_file` paths relative to this refs directory when enqueueing. Jobs use the requested model, effort, sandbox and timeout settings.

For newly designed intact/damaged pairs, generate the intact turnaround before its variants where practical. Variant briefs read the base's restored reference, new turnaround or crop when available and require the same footprint and identity.

Rebuild: `python3 epics-pipeline/refs/build_plan.py` (writes only here). Add `--proofs` to temporarily recreate labelled crop contact sheets for review. The crops have been visually reviewed. Source sheets and restored reference images remain read-only. Generated PNG crops remain git-ignored local artifacts; metadata and the reproducible rebuild script are committed. Unneeded duplicate existing-image copies were removed.

## Validation and remaining work

`npm run typecheck`: PASS. `npm run lint`: PASS. `npm run test:unit -- --maxWorkers=4`: PASS (91 files, 309 tests). These checks cover the unchanged game baseline. No gameplay or epic implementation changed, so smoke/e2e and epic verification do not apply.

Final batch integrity audit: PASS — 405 unique plan IDs, 290 existing source files, exactly 115 unique jobs/briefs covering only missing references, all 34 crops pixel-equal the recorded source regions. No existing-reference jobs remain.

Unclassified assets: none. Remaining work: run the 115 imagegen jobs, review their turnarounds, then continue Blender modelling.
