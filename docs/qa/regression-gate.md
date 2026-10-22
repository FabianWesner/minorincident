# Regression gate (10-22)

The PO found 14 issues in L1–L4 on PROD 13h that every bot and the Opus QA had passed. Each PO finding becomes a permanent check, automated where possible.

1. **Invariant sweep (`npm run qa:invariants`, every merge, remote).** All levels:
   - load-time budget against the previous PROD;
   - accessory anchors (hats and glasses on the head) for every crowd variant × LOD × tier;
   - every seated NPC has a seat;
   - scripted actors stay visible through their scene;
   - vehicles don't overlap solids (scripted routes, parked, after dismount);
   - wave spawn counts = authored counts;
   - the objective marker is visible within 2 s of every step start;
   - walkable height follows the drawn surface.
   - Run the sim/asset checks on the remote runner and one headless, one-browser load-time comparison on the Mac. Set `QA_INVARIANTS_BASELINE` to override the default PROD URL. A load fails when it exceeds either the 10% or 1 s budget. The renderer check requires WebGPU low; it records and fails on a backend/tier fallback.
2. **Visual A/B against PROD (`npm run qa:ab`).** Per level, a seeded camera tour at the PO's settings (low, zoom 1.5 and 1, WebGPU) through the scripted moments. It is rendered on the PROD build and on the candidate and diffed per frame. Opus judges only the changed frames: improvement, intended or regression.
3. **PO-style QA.** The Opus QA plays L1–L4 at least, at close zoom, low quality and with a progressed save. It works through the PO checklist (docs/qa/po-checklist.md), which gets every PO finding added.
4. **Process:**
   - cross-cutting render/crowd/corpse/prewarm changes need the all-level A/B before they merge;
   - no PROD deploy without green 1 + 2 and a GO from 3.

Run `npm run qa:invariants`. The headless sim suite is also available as `npm run qa:invariants:sim` for local diagnosis; it is not a substitute for the remote gate. Browser admission is serialized through `tools/perf/quiet-run.sh` at port 4191, with Scene Lab reserved at 4192.

## Running the invariant sweep

```sh
npm run qa:invariants                 # remote sim, build dist, then Mac rendering / PROD timing
npm run qa:invariants:sim:remote      # remote sim only (840 s execution ceiling)
npm run qa:invariants:render          # Mac only; requires an existing npm run build
npm run qa:invariants:proof           # eight intentionally broken fixtures; each must exit red
```

The full command collects both sim and browser results even when a sim invariant is red. Sim checks load L1–L10 with seed 1 and the campaign preset required by the level. Seat and initial scripted-cast sweeps cover both quality tiers. Accessories exercise every registered single-person crowd model, all three LODs, all appearance tiers, both instance and inline head geometry, source GLB dimensions and manifest fits. Native glasses are part of the civilian head GLB. The asset tolerance is the fitted extent / 1024 with a 2 mm numerical floor; the manifest's own dimension tolerance guards source scale changes.

Wave fixtures isolate finite authored batches from later story-phase cancellation, retain real queue/cap/admission/navigation behavior, and suppress damage where a kill would obscure the route measurement. Counts come from authoring data and actual entity/arrival ledgers. The ground sweep samples exposed walkable supports, paving routes, both L3 ramp cross-sections and their outside-rail / joint cases with the 20 cm limit. Objective probes run actual activation actions and the marker presentation rule, including the L3 checkpoint pull-back.

The **single Scene Lab spec** contains rendered cast/seat submission checks and ten level timing cases. It uses built output on 4191/4192, headless Chromium with native Metal/WebGPU, one worker/browser, `E2E_UNITS=1`, and `E2E_ADMISSION_TIMEOUT_SECONDS=3600`; quiet-run owns the exclusive capacity reservation and calls the reentrant e2e-lock wrapper. Each timing observation has a fresh browser context and a level-appropriate progressed save; candidate/baseline order alternates by level. The timer starts immediately before the real level-menu click, activates Begin as soon as ready, and ends after the first settled gameplay frame. It rejects a renderer or quality fallback. The default baseline is `https://minor-incident.com`; override it with `QA_INVARIANTS_BASELINE=https://…`.

Results are under `test-results/qa-invariants/`: sim/browser JSON, per-level load receipts, fixture-red receipts and full-command stage logs. A missing/non-finite measurement fails. Known-red baseline evidence and coverage details live in [the invariant report](../reports/qa-invariants/README.md). A broken-fixture proof is successful only when the selected check actually exits 1 at its invariant assertion; the proof command itself exits 0 after all eight receipts are verified.
