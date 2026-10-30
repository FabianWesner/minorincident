# Q242: soft playable L10 cure mist

The playable epilogue cure puffs now feather their ground-plane radius from 0.52 to 1 and use 0.13 peak opacity instead of 0.20. A phase uniform selects this path inside the existing shared puff material. It is disabled for title/credits and ordinary smoke. Geometry, emission count, random streams, particle cap, and corpse rendering are unchanged.

## Visual review

Matching seed-32 captures were taken from `6384d11c4` and the candidate using the shared headless browser pool, WebGL2/Metal, at 1280×720. Opened and reviewed both original full-size frames and these sheets:

- [Low z1.5 wide and corpse close](low.jpg)
- [High z1 wide and corpse close](high.jpg)

The 138-second wide views retain visible ground wisps without the pale polygon boundaries. The 72-runner corpse field is clearer through the mist; there is no increased pale veil over bodies. Paired no-mist captures also retain the original corpse appearance. Full-size 126/138-second wide frames, corpse/no-mist pairs, title/credits and per-run records are under `test-results/q242/{before,after}-{low,high}`. A further low-tier WebGPU capture is under `test-results/q242/webgpu-low`.

Low/high credits PNGs are pixel-identical to baseline. Title images differ by at most one color level in two/one pixels respectively across the entire frame. The original low-tier title/credits emission count remains 16 (playable remains 8); high remains 24.

## Validation

- `npm test`: 107/107 tests, 25 files; no new cases (suite budget remains 147/150).
- `npm run typecheck`, `npm run lint`, `npm run verify -- E32`: pass.
- `qa-l10-epilogue` and `qa-l10-title-credits`: 12/12 matrix rows on each backend, 24/24 total. Low-tier title/credits peaks are 16/56/112 puffs across the three zooms (minimum 10).
- `npm run test:smoke`: six QA cases plus one public case pass in 129.7 s. Freeze guard: no builds after warm-up; maximum frame 17 ms. [Log](smoke.txt).
- `npm run scene:gate`: 48/48, zero known failures, zero unrun rows. [Summary](scene-gate.md).
- High-tier WebGPU: all 293 shader-build keys and counts identical immediately after scene load, at 126 s, and through title/credits. Low-tier WebGPU: all 283 warmed keys unchanged through the phase transitions. No new blast/mist shader builds.

[Machine-readable receipt](evidence.json) contains the matrices, gate rows, shader-counter hashes, smoke annotations and title/credits pixel comparisons. The reproducible capture tool is `tools/qa/q242-mist-review.ts`; run it with `MIST_TIER=low MIST_OUT=test-results/q242/review-low SCENE_PORT=4242 sh tools/e2e-lock.sh npx tsx tools/qa/q242-mist-review.ts` (set `MIST_BACKEND=webgpu` for that backend). No specification criteria or production assets were changed.
