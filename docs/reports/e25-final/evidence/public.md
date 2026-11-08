# Public artifact check

The full smoke script stops at the known QA failure; this separate command runs its unchanged public build and public-smoke stage with a 240-second cap.

```sh
node tools/qa/test-budget.mjs --name e25-final-public --max-seconds 240 -- sh /tmp/e25-final-public.sh
# Script: npm run build; E2E_PUBLIC_BUILD=1 E2E_DIST=dist E2E_PORT=4350 sh tools/e2e-lock.sh npx playwright test --project=chromium --grep @public-smoke --workers=1
```

```text
[test-budget] 150/150 test cases ({"vitest":129,"e2e":9,"invariantsBrowser":12}), 43/45 files

> build
> NODE_ENV=production sh tools/build-cached.sh

vite v6.4.3 building for production...
transforming...
✓ 618 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                                     1.54 kB │ gzip:     0.68 kB
dist/build/skinnedCrowd-D3M5tKq9.js                 2.88 kB
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
dist/build/DebugInfo-DR9at0-z.js                    2.70 kB │ gzip:     1.20 kB
dist/build/index-CPe6nozN.js                       17.32 kB │ gzip:     6.20 kB
dist/build/light-anchors-BElMGkSS.js               94.19 kB │ gzip:     7.17 kB
dist/build/rapier-ykuY6d4E.js                     212.13 kB │ gzip:    36.15 kB
dist/build/three-core-DFTthFqg.js                 306.17 kB │ gzip:    81.73 kB
dist/build/three-webgpu-VmN4QZ8l.js               688.68 kB │ gzip:   192.06 kB
dist/build/wreck-roofs-GAckelu8.js                755.61 kB │ gzip:   253.19 kB
dist/build/character-clips-CGKWtM3S.js          1,939.70 kB │ gzip:   341.80 kB
dist/build/index--I0J4-3P.js                    3,702.00 kB │ gzip:   963.04 kB

(!) Some chunks are larger than 3200 kB after minification. Consider:
- Using dynamic import() to code-split the application
- Use build.rollupOptions.output.manualChunks to improve chunking: https://rollupjs.org/configuration-options/#output-manualchunks
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.
✓ built in 13.22s
[public-build] PASS: 21 HTML/JS files contain no QA hooks

Running 1 test using 1 worker

  ✓  1 [chromium] › tests/e2e/smoke.spec.ts:16:1 › public build: menu start draws L1, debug info is query-gated, and no QA globals escape @public-smoke (14.1s)

  1 passed (15.3s)
[test-budget] e25-final-public: 32.7 s (budget 240 s)

```
