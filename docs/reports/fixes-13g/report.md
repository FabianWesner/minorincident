# Fixes 13g — validation in progress
- #89 debug level selections receive strict-valid, level-consistent campaign presets; normal save validation stays strict.
- #90 the L8 boarding objective, ring/pin, and minimap destination activate at mission start.
- #91 key 1 selects innate fists without changing carried racks or L10 checkpoint arsenals.
- #95 the held pipe bomb is 0.443 m long, aligned to the palm, comparable to the molotov.
- #93 Alpha appearances and all three infected-dog coats use intact corpse geometry; living LODs stay unchanged.
- All five regression areas fail on batch 13f (`baseline-red.log`); targeted current tests, typecheck, lint, and build pass.
- Reviewed eight before/after sheets: zoom 0.5/1/1.5, high/low, WebGL2/WebGPU; both survivors hold the smaller pipe; dogs retain ribs, paws, tails, and rounded silhouettes.
- `invariants.json` proves matching body IDs/transforms, all 18 frozen instances retained across zooms, and zero pipe grip gap.
- Pending: protected real-input handover, fresh debug-menu probe, final remote suite, smoke, and final evidence commit.
