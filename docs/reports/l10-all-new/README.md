# L10 all-new (in progress)

- [Census](census.json): 12 spawned appearances from L10 encounters, deterministic Mega looks and generic epilogue residents; 9 were already `crowdSkin` and were skipped.
- Migration scope: `inf.mega-alpha`, `inf.mega-alpha-ashen`, `inf.mega-alpha-ember`; the ashen and ember builds are registered and pass the asset validator at all 3 LODs.
- Base Mega LOD0/1 builds were produced, but LOD2 fails closed: contact repair separates 9.6% of the left lower-leg surface. Manifest remains on the old model until all tiers are sound.
- Reviewed source comparison: `/Users/wesner/Workspace/trellis-highs/mega-alpha/solidified/sheet.jpg`; new crown/bulk reads, but its small face and the old skull emblem need game-camera review.
- Automatic builder fixes: Mega fists no longer trigger the held-prop guard; oversized files retry with smaller atlases; the base source uses the existing Mega rig and a topology-preserving reduction.
- LOD triangle caps: humans 6,000/2,500/900; Alpha 8,000/3,000/1,000; Mega Alpha 16,000/6,000/2,000. File caps: 600/250/150 kB.
- Full asset validator: [evidence](gates/asset-validator.json), 1,262 rows with zero errors; selected Mega variants also pass all six LODs [here](gates/asset-validator-selected.json). Typecheck and `git diff --check` pass; `npm test` passes (104 tests, 24 files; unchanged budget 144/150 cases). HF spend: €0; no inference submitted. Perf: pending.
- Smoke built the QA bundle but could not acquire a browser: the managed sandbox denies loopback connect/listen (`EPERM`) to the live shared pool. See [smoke evidence](gates/smoke.json). Browser-based sheets, scripted scenes, `scene:gate` and L10 playthrough remain pending for the same reason.
