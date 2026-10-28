# L10 all-new (review in progress)

- [Census](census.json): 27 possible identities including shared selectors, couriers, companion, dog coats, residents and corpse states; nine rigid at lane base, six owned by L9 and three Mega looks here; no batch-3 remainder.
- Migrated `inf.mega-alpha`, `inf.mega-alpha-ashen`, `inf.mega-alpha-ember` through `skin-crowd-build.sh`; all three LODs × two tiers validate; no manual asset steps, no inference, HF spend €0.
- Sources: existing TRELLIS high and reviewed ashen/ember casts; pipeline branch `lane/l10-all-new`, commit `2f61c10`, reproduces the base paint on its matching semantic rig and fixes the detached LOD2 leg.
- Automated preservation: authored skull, eye cores, horns/tusks and fitted neck boundary remain on the reconstructed skinned bodies; no held weapons belong to these Mega looks.
- Mega LOD0/1/2 triangle caps: 16,000/6,000/2,000; actual maxima 15,977/5,946/1,971. Standalone file caps 600/250/150 kB; each existing identity retains its registered budget.
- [Validator](gates/asset-validator.json): 1,262 rows, zero errors; [typecheck](gates/typecheck.txt), [lint](gates/lint.txt), [npm test](gates/npm-test.txt) pass (104 tests; unchanged registered budget 144/150 cases, 40/45 files).
- Reviewed [three native old/new portrait sheets](visual-review.json), low/high WebGL2/WebGPU at 120/400 px, front/back. [Smoke](gates/smoke.json) passes (six QA + one public; freeze guard 0 shader rebuilds / frames >200 ms; GPU ≤13 attributes / ≤8 buffers).
- Mixed crowd, motion/corpses, scripted scenes, scene gate, real-input L10 and showcase remain in progress; L9 must be imported after its main merge.
- Formal low p95 +1 ms acceptance remains perf pending PO quiet window; [five cold loads](cold-loads/summary.json) pass: new worst 5,675 ms vs PROD 6,310 ms (89.9%, limit 110%). Draws and decoded memory are being collected.
