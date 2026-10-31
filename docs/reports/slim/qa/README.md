# Slim validation

Runtime and asset revision: `f41cefd10` on `lane/slim`, compared with main baseline `53949e814`.

| Check | Result |
| --- | --- |
| TypeScript / ESLint | PASS |
| `npm test` | 110/110, 26 files |
| `npm run test:smoke` | 7/7 (6 QA + 1 public), 95.2 s |
| `npm run scene:gate` | **48/48**, zero known failures, zero not run, 3.4 min |
| Public L1 load, 10 pairs | median 2193.9 → 2177.5 ms; p90 2209.7 → 2193.9 ms; PASS |
| Export anatomy / retained data | 55 variants / 337 files PASS |
| GPU bake normals | 192 deliveries PASS; zero nonfinite normals, no new zero body normals |
| Runtime LOD fallbacks | 0 baseline / 0 edited |
| Core delivered export contracts | 165 files, zero added errors |
| Head/hand/prop fixed surfaces | Maximum displacement 0 m |
| Source height / ground | Maximum delta 6.7e-16 m |

Smoke compiled all crowd, corpse and accessory programs on both native backends. WebGPU: 719 programs / 82 crowd; crowd maxima 13 attributes, 14 varyings, 5 buffers, all-program buffer maximum 8. WebGL2: 478 programs / 67 crowd, maxima 13 attributes and 14 varyings. The real L1 handover/outbreak check confirms no shader builds after warmup and no frame above 200 ms. The public smoke checks menu → L1 and absence of QA globals; the public build audit passes all 18 HTML/JS outputs.

The initial scene gate exposed two regressions. Both were corrected before this final run: [gear refit](../rollout/gear-refit.json), [finite HDR before](ped-hdr-before.json) / [after](ped-hdr-after.json), [correction review](../rollout/review.md#qa-corrections). The six extra male gear quality/zoom combinations pass in [gear-matrix](gear-matrix/index.md). Existing main auxiliary-eye bounds, legacy rest-cushion findings and close cloth/corpse limitations remain recorded in the export and visual reviews.

Logs: [unit](npm-test.log), [typecheck](typecheck.log), [lint](lint.log), [smoke](smoke.log), [scene gate](scene-gate.log), [48-row summary](scene-gate/summary.md). The earlier [E17 verify receipt](verify-E17.json) also passed; the unit, type and lint checks above were repeated after the final corrections.

The final L1 depot and bench captures were repeated after the corrections. Their PNG pixels are byte-identical to the previously reviewed final body-build images; the updated receipts retain the final run’s timing observations.

## L1 load comparison

[Ten paired public loads](../rollout/load/summary.json), alternating baseline/current order, use fresh isolated contexts of the shared headless pool on native Apple WebGPU, low tier, DPR 1, 1600×900. The public menu → closed L1 loading card measurement has no errors or software-adapter fallback. Median changes by -16.4 ms and p90 by -15.8 ms; this shows no load regression within measurement noise. Admission waited for load <3 and no active build/test/Blender/browser work. One shared slot was reserved; this was not an exclusive GPU timing run. [Conditions](../rollout/load/conditions.jsonl), [load log](load.log), and all 20 raw sample records are retained. No owned browser profiles were created.

The one temporary baseline archive was deleted after the comparison. Browser contexts and private preview/dev servers were closed; the shared pool daemon remains available to other jobs. No GitHub publication or deployment occurred.
