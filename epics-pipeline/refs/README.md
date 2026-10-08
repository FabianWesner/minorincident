# Reference image preparation plan — 2026-10-08

405 concrete 3D asset IDs, 405 briefs, 405 scheduler jobs. No game code or manifest changes. Generation has not been launched.

- Categories follow the manifest: prop 155, building 92 (includes interiors and new kits), character 53 (includes NPCs), infected 33, weapon 24 (includes throwables), vehicle 48.
- Sources: sheet 34, text 81, existing 290 asset IDs using restored references and experiment images. `existing` intentionally extends the example schema's two source values to honor step 2.
- `plan.json` stores absolute sheet paths and pixel boxes. All crops were created with Pillow and visually reviewed in labelled contact proofs. The proofs were removed after review.
- `coverage.json` records provenance and exclusions. Excluded: UI, pure aliases, flat decals, abilities and unarmed action placeholders; physical `abl.turret` retained, alias `ability.turret` excluded. Lighting key frames in inventory §6.5 and `decal.bullet-holes` are not 3D models.
- §6 wildcard requirements are expanded into 16 vehicle wreck/burn variants, corridor W2/W3 building variants, Fairhaven W5 twins, named aftermath survivors and three shelter injury/rest poses. These are planning IDs, not manifest additions.
- Restored upscaled references take precedence over crops and experiment references. Matching legacy aliases are reused; 37 distinct restored model subassets/gear variants are additionally included. Existing images are copied to each matching ID's `existing.png`; those briefs request hero only and return `turnaround: null`.
- Some source crops show buildings within dioramas, multiple turnarounds or kit components. Briefs explicitly isolate the named object and preserve its design; interiors use roofless cutaways and kits use one coherent supported assembly.
- Variant briefs first use the base hero when available, otherwise its crop/existing reference. Schedule bases before variants where practical; text-only new building twins will benefit from the finished intact hero before generation.
- Jobs use the requested relative `briefs/<id>.md` paths. Resolve `prompt_file` relative to this refs directory when enqueueing.

Rebuild: `python3 epics-pipeline/refs/build_plan.py` (writes only here). Add `--proofs` to recreate labelled crop contact sheets for review.

Validation: `npm run typecheck` PASS; `npm run lint` PASS; `npm run test:unit -- --maxWorkers=4` PASS (91 files, 309 tests). Reference integrity audit PASS: 405 unique IDs/jobs/briefs, crop dimensions and pixels equal the recorded sheet regions, and reused image copies byte-equal their sources. No gameplay changes or epic implementation: smoke/e2e and epic verification do not apply.

Unclassified assets: none. Remaining work: run the batch and review hero/turnaround images; this lane prepares references only.

The reference source images and generated PNG copies remain git-ignored local artifacts. The plan, briefs, jobs and rebuild script are committed, so their crops/copies can be regenerated from the read-only source files.
