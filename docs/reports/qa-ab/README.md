# Visual A/B regression review

```sh
npm run build
npm run qa:ab -- --candidate dist --levels L1-L4
npm run qa:ab -- --baseline https://7d1aff32.minor-incident.pages.dev \
  --candidate https://minor-incident.com --levels L1-L4 \
  --out docs/reports/qa-ab/2026-10-22-13g-vs-13h
```

`--baseline` defaults to PROD. Both sides accept an HTTP(S) URL or `dist`; the latter starts a strict local production preview on 4201 and closes it afterward. `--levels` accepts `L1-L4`, `L1,L4,L10`, or their combination. The default covers L1–L10. `--stops substring` selects a tour stop for diagnosis; `--seed` defaults to 1; `--threshold` defaults to `.02`. Every run needs a fresh output directory; the default includes the date and time.

The npm wrapper reserves one browser through `tools/e2e-lock.sh`, with `E2E_UNITS=1`, admission timeout 3600 s, E2E port 4201 and Scene port 4202. Chromium is always headless, using ANGLE Metal on macOS. The runner requires actual WebGPU and low quality; fallback is an unmeasured error. Both builds use 1280×720, DPR 1, the same seed, and both zoom 1.5 and zoom 1 at every stop. Simulation stays paused and advances exact ticks. Camera shake and VFX particles are disabled; weather uses the game's seeded simulation clock. Production game code is unchanged.

## Tour and evidence

The snapshot's own `__SS__` campaign API and the existing Scene Lab camera bridge reach each stop. L1–L4 restore an unlocked L10 campaign fixture to exercise a progressed save. Later levels use their normal progressed campaign boundary. Authored checkpoint graph prefixes, ordinary bot inputs, navigation steering and vehicle inputs advance the game. Actors are never teleported or synthesized. A failed state predicate is reported as **unmeasured**, and the command exits 2.

- L1: depot contact and return, lab signing and return, bike rack, park and fire station.
- L2: ride start, bench sitters and accessories.
- L3: both raised ramp/deck junctions and the actual army pull-back.
- L4: alarm wave, entering/parked tank at the barrier, and plaza civilians.
- L5–L10: start areas, gates, handovers and finales using campaign checkpoints and ordinary movement where a checkpoint cannot be reconstructed.

Each stop has six captures at 0, 0.6, 1.2, 1.8, 2.4 and 3 seconds. Its JPEG sheet contains a large still from the most changed frame (baseline | candidate | heatmap), followed by all six motion frames for each side and their heatmaps. `index.html` sorts by score. `summary.json` records source bundle IDs, setup/state evidence, actual camera/backend/quality, per-frame scores, errors and the above-threshold review list. Images use JPEG quality 70 and share a hard 30 MB budget; temporary lossless captures live under ignored `test-results/qa-ab/`. Report images and HTML are ignored; README and dated summaries are committed.

## Score and interpretation

`pixelmatch` applies a perceptual color tolerance of .15 and suppresses antialias-only differences. The score is the greatest changed-pixel coverage in an overlapping 48×48 tile across the six paired frames. The default review threshold is 2%. Global changed coverage is also recorded. Local coverage prevents a vanished person or hat being diluted by the full 921,600-pixel viewport. The metric tests cover identical frames, a small missing actor, sparse particle noise and incompatible dimensions.

A score requests visual review; it does not decide whether a change is intended, an improvement or a regression. The six PO categories report candidate coverage when a relevant, successfully captured stop exceeds the same threshold. A reviewer must confirm that the difference actually depicts that finding before counting a hit. Missing categories are explicitly unmeasured. Same-build controls must have **every** stop below threshold, including later motion frames.

## Validation

Browser validation is in progress. The specified snapshot is build `769d9f8ce` (13g), and PROD currently reports `73bce8bc5` (13h). The first complete natural-camera L1–L4 run measured 30 stop/zoom variants and 180 frame pairs. Two tank sheets exceeded 2%; the other five PO categories scored zero. This is **1/6 candidate categories (16.7%), 0/6 confirmed PO regressions**: visual inspection showed the same tank/barrier overlap in both builds, with warning/shading differences causing the flags. The depot return, lab handover, accessory, sitter and ramp comparisons did not demonstrate newly introduced defects.

The requested six-finding demonstration is therefore **not met** by this pair. An earlier known-good snapshot is needed to distinguish defects already present in 13g. Expanded same-build controls, the explicit glasses stop and local `dist` serving are being checked. A failing demonstration is not a passing regression gate.

Static checks pass: typecheck, lint, production build, and all 1,960 unit tests. The unit run exposed an existing GNU `stat` assumption in the remote-cache fixture; its fixture now supplies the Linux stat interface using the real temporary-file mtimes on macOS.
