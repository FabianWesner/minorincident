# Full smoke result

Command: `E2E_PORT=4349 VITEST_MAX_WORKERS=2 npm run test:smoke`

```text

> test:smoke
> node tools/qa/test-budget.mjs --name smoke --max-seconds 240 -- sh tools/qa/smoke.sh

[test-budget] 150/150 test cases ({"vitest":129,"e2e":9,"invariantsBrowser":12}), 43/45 files

> build:qa
> NODE_ENV=production VITE_QA_HOOKS=1 sh tools/build-cached.sh

vite v6.4.3 building for production...
transforming...
✓ 658 modules transformed.
rendering chunks...
computing gzip size...
dist/preview/index.html                             1.81 kB │ gzip:     0.75 kB
dist/build/skinnedCrowd-D3M5tKq9.js                 2.88 kB
dist/index.html                                     2.91 kB │ gzip:     0.95 kB
dist/build/civilianBakeData-DodFhdro.js             4.05 kB
dist/build/deathPose-BH9ouT0s.js                    5.79 kB
dist/build/BufferGeometryUtils-BsKHv_Up.js          6.88 kB
dist/build/civilianBake.worker-_pYKOTSp.js         29.19 kB
dist/build/basis_transcoder-o4Hde_L7.js            57.53 kB
dist/build/three.module--FhUTY-k.js               206.13 kB
dist/build/civilianSource-C-NynhlA.js             410.03 kB
dist/build/basis_transcoder-VXdx5NbI.wasm         527.33 kB │ gzip:   244.57 kB
dist/build/prefetch.worker-LaaqRA_C.js          1,064.82 kB
dist/build/prepareCivilianGeometry-BtnVNVPA.js  1,969.86 kB
dist/build/rapier-C6GCbKVJ.wasm                 3,082.10 kB │ gzip: 1,171.17 kB
dist/build/index-IOL21Ibl.css                      42.33 kB │ gzip:     9.02 kB
dist/build/lookViewpoints-BX-OEann.js               0.23 kB │ gzip:     0.16 kB
dist/build/modulepreload-polyfill-B5Qt9EMX.js       0.71 kB │ gzip:     0.40 kB
dist/build/three.module-KnJ4A_3u.js                 1.10 kB │ gzip:     0.64 kB
dist/build/preload-helper-BlTxHScW.js               1.11 kB │ gzip:     0.65 kB
dist/build/controls-BD2KGrGS.js                     1.40 kB │ gzip:     0.75 kB
dist/build/crowdProbe-DvPBfiPi.js                   1.53 kB │ gzip:     0.88 kB
dist/build/worldLook-o3T_90Bf.js                    1.96 kB │ gzip:     0.88 kB
dist/build/DebugInfo-DR9at0-z.js                    2.70 kB │ gzip:     1.20 kB
dist/build/crowd-C2C9mOd6.js                        3.10 kB │ gzip:     1.59 kB
dist/build/lookPatch-BJ2Iw5hk.js                    5.68 kB │ gzip:     2.83 kB
dist/build/probe-DKgptAsS.js                        7.52 kB │ gzip:     3.05 kB
dist/build/footSoles-BpKRdiEU.js                   10.41 kB │ gzip:     3.52 kB
dist/build/index-CZreE_Fj.js                       12.43 kB │ gzip:     4.50 kB
dist/build/Inspection-DEAbZAm2.js                  12.86 kB │ gzip:     4.41 kB
dist/build/MotionLab-DcJBED33.js                   18.38 kB │ gzip:     7.93 kB
dist/build/LevelFiveBot-CEA9IF3v.js                23.12 kB │ gzip:     6.84 kB
dist/build/survivor-DjMktlck.js                    24.62 kB │ gzip:    10.03 kB
dist/build/index-fMpwkyH5.js                       28.31 kB │ gzip:     7.74 kB
dist/build/LevelSixSubway-CX0NUps2.js              29.72 kB │ gzip:    11.16 kB
dist/build/testApi-Dm8RIwwe.js                     37.42 kB │ gzip:    13.61 kB
dist/build/Physics-DruYAVvN.js                     83.20 kB │ gzip:    28.95 kB
dist/build/light-anchors-BElMGkSS.js               94.19 kB │ gzip:     7.17 kB
dist/build/SceneLab-paVYguzZ.js                   105.02 kB │ gzip:    36.08 kB
dist/build/Pickups-BYFMxM4j.js                    105.62 kB │ gzip:    36.17 kB
dist/build/PropSystem-DRkLnMa4.js                 142.88 kB │ gzip:    48.23 kB
dist/build/Debug-C5mqunPp.js                      155.77 kB │ gzip:    33.00 kB
dist/build/registry-BTjI_iSc.js                   212.07 kB │ gzip:    72.15 kB
dist/build/rapier-ykuY6d4E.js                     212.13 kB │ gzip:    36.15 kB
dist/build/infected-BHeoBb7b.js                   287.70 kB │ gzip:    89.17 kB
dist/build/three-core-CRIfo7il.js                 307.47 kB │ gzip:    82.36 kB
dist/build/WeatherView-Cd33dw15.js                364.76 kB │ gzip:    42.46 kB
dist/build/three-webgpu-Dm7bMjwu.js               688.68 kB │ gzip:   192.06 kB
dist/build/wreck-roofs-GAckelu8.js                755.61 kB │ gzip:   253.19 kB
dist/build/install-BsIPuax1.js                  1,070.14 kB │ gzip:   199.73 kB
dist/build/index-DgeYAakW.js                    1,401.45 kB │ gzip:   438.44 kB
dist/build/character-clips-CGKWtM3S.js          1,939.70 kB │ gzip:   341.80 kB
✓ built in 13.73s

Running 6 tests using 2 workers

[gpu-limits] webgpu: 781 programs, 88 crowd; crowd max attributes 13, varyings 14, buffers 5; all max attributes 13, varyings 14, buffers 8
  ✓  1 [chromium] › tests/e2e/crowd-gpu-limits.spec.ts:19:52 › every crowd, corpse and accessory program compiles within the portable GPU limits on webgpu @smoke (56.3s)
[gpu-limits] webgl: 525 programs, 73 crowd; crowd max attributes 13, varyings 14, buffers 0; all max attributes 13, varyings 14, buffers 0
  ✓  2 [chromium] › tests/e2e/crowd-gpu-limits.spec.ts:19:52 › every crowd, corpse and accessory program compiles within the portable GPU limits on webgl @smoke (1.2m)
  ✓  4 [chromium] › tests/e2e/smoke.spec.ts:234:54 › L1 start: pedestrians are drawn on screen (webgl), not only their props @smoke (39.3s)
  ✓  5 [chromium] › tests/e2e/smoke.spec.ts:234:54 › L1 start: pedestrians are drawn on screen (webgpu), not only their props @smoke (35.3s)
  ✓  6 [chromium] › tests/e2e/webgpu-unflagged.spec.ts:12:1 › menu → L1 start on unflagged WebGPU compiles every render pipeline with suit zombies drawn (low tier) @smoke (12.3s)
  ✘  3 [chromium] › tests/e2e/smoke.spec.ts:59:1 › L1 handover + outbreak: no shader builds after warm-up and no frame over 200 ms @smoke (1.7m)


  1) [chromium] › tests/e2e/smoke.spec.ts:59:1 › L1 handover + outbreak: no shader builds after warm-up and no frame over 200 ms @smoke 

    Error: L8 APC boarding exercised after warm-up

    expect(received).toBe(expected) // Object.is equality

    Expected: true
    Received: false

      205 |   writeFileSync('test-results/smoke/l8-boarding-builds.json', JSON.stringify({ level: 'L8', vehicle: 'APC', boarded: l8.boarded, before: l8.loaded, after: l8.after, lateVehicleBuilds: Object.fromEntries(lateVehicleBuilds) }, null, 2));
      206 |   test.info().annotations.push({ type: 'L8 boarding shader builds', description: JSON.stringify({ carId: l8.carId, boarded: l8.boarded, builds: Object.fromEntries(lateVehicleBuilds) }) });
    > 207 |   expect(l8.boarded, 'L8 APC boarding exercised after warm-up').toBe(true);
          |                                                                 ^
      208 |   expect(lateVehicleBuilds, 'courier, weapon, or vehicle builds after L8 warm-up and APC boarding').toEqual([]);
      209 |   // Q-227: L10 grants its guns through mission arsenal transactions, long after loading, rather than ground entities.
      210 |   // Exercise every authored weapon checkpoint in this existing freeze guard; every held graph must already be warm.
        at /Users/wesner/Workspace/minorincident/.claude/worktrees/e25-final/tests/e2e/smoke.spec.ts:207:65

    Error Context: test-results/playwright/run-4349/e2e-smoke-L1-handover-outb-c8fda--no-frame-over-200-ms-smoke-chromium/error-context.md

    attachment #2: trace (application/zip) ─────────────────────────────────────────────────────────
    test-results/playwright/run-4349/e2e-smoke-L1-handover-outb-c8fda--no-frame-over-200-ms-smoke-chromium/trace.zip
    Usage:

        npx playwright show-trace test-results/playwright/run-4349/e2e-smoke-L1-handover-outb-c8fda--no-frame-over-200-ms-smoke-chromium/trace.zip

    ────────────────────────────────────────────────────────────────────────────────────────────────

  1 failed
    [chromium] › tests/e2e/smoke.spec.ts:59:1 › L1 handover + outbreak: no shader builds after warm-up and no frame over 200 ms @smoke 
  5 passed (2.7m)
[test-budget] smoke: 179.7 s (budget 240 s)
[test-budget] FAIL: smoke failed (exit 1)
[test-budget] See docs/qa/test-strategy.md: merge into an existing test or delete one before adding another.

```
