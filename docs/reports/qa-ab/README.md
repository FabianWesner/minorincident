# Visual A/B QA reports

Run from the repository root:

```sh
E2E_UNITS=1 E2E_ADMISSION_TIMEOUT_SECONDS=3600 E2E_PORT=4201 SCENE_PORT=4202 \
  npm run qa:ab -- --baseline https://7d1aff32.minor-incident.pages.dev \
  --candidate https://minor-incident.com --levels L1-L4
```

`--baseline` defaults to PROD (`https://minor-incident.com`). `--candidate dist` serves the local production build on port 4201; a URL can be supplied instead. `--levels` accepts a range such as `L1-L4` or a comma-separated list. The capture uses one headless Chromium browser, 1280×720, DPR 1, low quality, WebGPU, seed 13, disabled camera shake and VFX, and alternates zoom 1.5/1. Tour stops load campaign progression presets (L9 restores the L8 campaign save; L10 uses authored campaign checkpoints), begin the mission, and use the game's scripted bot where one exists. No actor or player teleport is used.

Each stop records a still and six frames spanning three simulated seconds for both builds. `index.html` sorts side-by-side baseline/candidate/heatmap comparisons by pixel difference; `summary.json` lists scores above the default 2.5% threshold and the six named PO findings. The summary's finding hit rate is the number of named findings with a relevant stop over threshold divided by the six findings. Change the gate with `--threshold <fraction>`.

The dated report directory is ignored except for this README and `summary.json`; image artifacts are JPEG quality 70 and are intended to stay below 30 MB per run.

## Validation runs

No comparable hit-rate result is recorded yet. The required 13g snapshot versus 13h PROD run and same-build control are pending execution through `tools/e2e-lock.sh`; in this managed workspace its macOS GPU guard currently fails because the sandbox denies `ps`. Do not interpret an absent dated summary as a passing run.
