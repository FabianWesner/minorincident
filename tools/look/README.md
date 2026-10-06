# Look development

`npm run look:capture` builds production, starts an isolated preview on 3306, and captures V1–V6 with seed 1 and paused simulation. Desktop: 1600×900/high. iPhone portrait: 390×844/low, DPR 1. It writes twelve PNGs, six comparison sheets, capture metadata, a reviewer rubric and a blank scoring template to gitignored `test-results/look-round/`. References are style targets, not matching locations. The supplied local mockup and PO Bruno image must exist; they are never committed.

In a worktree references default to the main checkout. Overrides: `LOOK_MOCKUP=/path/mockup.png LOOK_BRUNO=/path/bruno.webp`. `E2E_PORT=3316` selects another isolated preview port. `LOOK_SKIP_BUILD=1` uses an existing dist. `LOOK_URL=https://… npm run look:capture` targets a deployed production build without building/starting a server. `LOOK_OUTPUT=test-results/look-round/round-2` preserves rounds. All browser runs use the machine-wide e2e lock and a headless native-GPU Chromium on macOS. Only one game page runs at a time.

`npm run look:score` regenerates sheets and review files from existing captures. Give `reviewer.md`, all six sheets and original PNGs to an independent reviewer. Fill a copy of `scores-template.json`, documenting evidence and gaps for both tiers. A paused still cannot prove motion: supply a live review/clip and record it in `motionEvidence`, otherwise leave motion null. Paused capture counters are diagnostic, not FPS measurements. Use the separate E18 200-infected fixture for performance.

Delete generated screenshots after review; retain only needed metric/review JSONs. Keep `ref/` source images.
