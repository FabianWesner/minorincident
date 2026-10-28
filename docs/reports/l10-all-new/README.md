# L10 all-new (review in progress)
- [Census](census.json): 27 possible identities including shared selectors, couriers, companion, dog coats, residents and corpse states; nine rigid at lane base, six owned by L9 and three Mega looks here; no batch-3 remainder.
- Migrated `inf.mega-alpha`, `inf.mega-alpha-ashen`, `inf.mega-alpha-ember` through `skin-crowd-build.sh`; all three LODs × two tiers validate; no manual asset steps, no inference, HF spend €0.
- Sources: existing TRELLIS high and reviewed ashen/ember casts; pipeline branch `lane/l10-all-new`, commit `2f61c10`, reproduces the base paint on its matching semantic rig and fixes the detached LOD2 leg.
- Automated preservation: authored skull, eye cores, horns/tusks and fitted neck boundary remain on the reconstructed skinned bodies; no held weapons belong to these Mega looks.
- LOD0/1/2 triangle caps: humans 6,000/2,500/900; Alpha 8,000/3,000/1,000; Mega 16,000/6,000/2,000. Standalone file caps 600/250/150 kB; each existing identity retains its registered budget.
- [Validator](gates/asset-validator.json): 1,262 rows, zero errors; [typecheck](gates/typecheck.txt), [lint](gates/lint.txt), [npm test](gates/npm-test.txt) pass (104 tests; unchanged registered budget 144/150 cases, 40/45 files).
- Game-camera old/new sheets, mixed crowd, motion/corpses, scripted scenes, smoke, scene gate, real-input L10 and showcase are in progress; L9 must be imported after its main merge.
- Performance acceptance pending PO quiet window; shared-pool diagnostics, draws, decoded texture memory and five cold loads are being collected.
