# E17 asset pipeline report — 2026-10-05

The authorized pipeline/fire-engine lane (E17-AC01–AC08) is complete and its
checks pass. **The whole E17 epic is not done:** AC09 milestone production is
explicitly deferred to separate per-asset batches, and AC11's actual infected
`gore-probe` vision evidence is outside this lane. `specs/status.json` remains
`in-progress`; readiness tests are not counted as completed asset production.

## Acceptance results

| Criterion | Result | Evidence |
| --- | --- | --- |
| E17-AC01 | PASS | `tests/unit/assets/build.test.ts`: two real Blender 5.2.2 builds, equal geometry hashes, fatal script error; committed GLB/meta |
| E17-AC02 | PASS | `validate.json`: all three modeled/integrated fire-engine LODs pass; tagged negative cases reject each contract violation; supplied source audit in `validate-production.json` |
| E17-AC03 | PASS | `tests/unit/assets/optimize.test.ts`: actual NodeIO roundtrip, join, meshopt/quantization, independent geometry and world pivots ≤1 mm; static siblings really join |
| E17-AC04 | PASS | Dimension checks for all LODs; `turntable_0.png`–`turntable_4.png`, `comparison.png`, `review.md`: all four must and both should checklist C items PASS |
| E17-AC05 | PASS | Manifest/data reference scan; missing GLB, cache/clones and LOD/variant tests; real pre-integrated-art placeholder browser test |
| E17-AC06 | PASS | Inventory parser test cross-checks every concrete inventory ID and status; 207 unique manifest IDs |
| E17-AC07 | PASS | `tests/unit/assets/crowd.test.ts`: source hierarchy and every baked vertex at five times; `crowd.json` and `crowd.png`: 100 instances, one GPU draw/material, pose readback |
| E17-AC08 | PASS | Five game-renderer screenshots with toolbar hidden; pixel coverage 11.11%, 51.42%, 11.25%, 51.26%, 16.06%; reference comparison generated |
| E17-AC09 | PENDING | Separate milestone production batches, as instructed. Tagged test verifies pending art is rejected by the gate; it does not prove completed milestones or placeholder-free level photo spots |
| E17-AC10 | PASS (tooling; no final assets) | Final-status validator requires evidenced checklist and existing comparison; negative tests reject invalid reviews; needs-human assets listed below |
| E17-AC11 | PENDING (readiness tooling passes) | Tagged tests enforce hidden cap geometry and placeholder detachment. No actual infected gore-probe hole-free vision review was performed |

## Built

- Shared Blender palette/primitives/naming/pivots/sockets/colliders/decay/export/AO
  helpers and headless wrapper, three threads, four global Blender slots, one
  CPU Cycles slot; reference locks are opened read-only.
- Bruno loader/material/compression adaptations, cached registry, independent
  clones, named-node restoration, palette AO swap, placeholder fallback and
  hero LOD selection. KTX2 transcoders are bundled by Three.js.
- GLB contract validation, geometry hashing, protected-pivot optimization,
  staged publication after all LODs validate, PNG atlas KTX2 encoder stage.
- Fire engine rebuilt by adapting the read-only hand-built pilot. Supplied
  standalone production scripts/models were never rebuilt or modified.
- Crowd bake with part-index geometry and sampled rigid-part clip; the E07
  integration point accepts a clip evaluator. Runtime time updates change one
  scalar uniform and allocate no per-frame arrays.
- GLB preview controls, five-view capture/comparison, crop regions, authoring
  templates, inventory sync, final-review and pending-production guards.

## Verification

All required gates exit **0**, without new warnings:

| Command | Result | Evidence |
| --- | --- | --- |
| `npm run typecheck` | 0 | final verify static step, `checks.json`, `logs/verify.log` |
| `npm run lint` | 0 | final verify static step, `checks.json`, `logs/verify.log` |
| `npm run build` | 0 | `logs/build.log`, both game and preview production entries |
| `npm run test:unit` | 0; 29 tests / 13 files pass | `logs/test-unit.log`, includes earlier epic tags |
| `E2E_PORT=3313 npm run test:smoke` | 0; 1 Vitest + 12 browser tests pass | `logs/smoke.log`, Chromium/mobile/WebKit |
| `E2E_PORT=3313 npm run verify -- E17` | 0; 18 selected Vitest + 15 browser tests pass | `checks.json`, `vitest.json`, `logs/verify.log` |
| `npm run assets:validate` | 0; three LODs pass | `validate.json`, `logs/validate.log` |
| `npm run test:sim` | 0; four tests pass | `logs/test-sim.log` |
| `E2E_PORT=3313 npm run test:e2e` | 0; 12 Chromium tests pass | `logs/regression-browser.log`, includes earlier resource/visual/perf tests |

Verify skips 15 non-selected Vitest tests by tag selection; the separate full
unit and sim suites pass. Browser and Vitest configurations cap workers at four.
Production previews used port 3313. No deployment, push, .env read or shared
3300 server operation occurred. `git merge main` reports already up to date at
`2ffb7b7`, before the final checks. Whole diff reviewed; obsolete command stub
removed. Lockfile licenses are permissive; Sharp/libvips and deprecated request
are absent. The small PNG-only ndarray-pixels adapter avoids libvips's license.

## Measurements

| Fire-engine tier | Triangles | Materials | Asset draws | KiB | Dimensions X/Y/Z (m) |
| --- | ---: | ---: | ---: | ---: | --- |
| lod0 | 66,335 | 11 | 39 | 3664.74 | 7.40000 / 3.55000 / 2.09997 |
| lod1 | 10,821 | 11 | 39 | 873.95 | 7.34186 / 3.54062 / 2.09997 |
| lod2 | 2,507 | 11 | 38 | 283.55 | 7.27126 / 3.51235 / 2.09997 |

LOD0 budgets: 80,000 triangles, 40 static draws, 32 materials, 6,000 KiB;
LOD1 triangle ceiling 12,000; LOD2 ceiling 4,000. Dimensions target
7.4 / 3.55 / 2.1 m ±5%. The viewer reports 40 draws / 66,336
triangles because screen presentation adds one pass/triangle.
Raw deterministic geometry hash: `56d574a236126f1b45e5b5604db9319b98d23fb71c212d2e6c9411d48844a93c`.
Hashing compares exact triangle positions, winding and node transforms;
normal-induced vertex numbering and serialized GLB byte order are excluded.

Crowd: **100 instances / 8 materials / 8 asset draw calls**;
maximum GPU readback pose error **7.49297796688e-08 m** against a
0.02 m limit at five clip times. Baked file size
943.39 KiB.
These are Chromium WebGL2/SwiftShader proofs. Native WebGPU frame-time budgets
were not measured and are not inferred from software-renderer timings.

## Deviations and known issues

- AC09 is pending by explicit lane scope. Full epic completion also needs the
  infected AC11 vision proof; E17 status is deliberately not marked done.
- The fire-engine inventory U+L row was an outdated snapshot. It was corrected
  to integrated to reflect the delivered registry/turntable proof and preserve
  AC06 sync. No acceptance criterion was weakened or changed.
- The fire-engine uses the art palette's matte light trim rather than the
  reference's photographic chrome. Far-side/rear details are inferred from
  the single reference. Checklist C still passes.
- Hero LOD1 simplification uses 0.12 and LOD2 0.035 rather than the older generic
  0.5 low-tier suggestion, following the updated §7 hero/side/distant chain.
- 23 supplied standalone source GLBs are registered as-is, with supplied LODs
  when present. Their statuses remain the inventory snapshot: files alone do
  not certify integration. The audit inspected 62 exports/LOD slots:
  **9 passing / 53 with findings**. It exits 1 intentionally;
  this is the requested findings audit, not the modeled-asset validation gate.
  Findings include 26 missing LOD slots, 17 missing/invalid front markers,
  unknown palette tokens, degenerate triangles, crawler parts lacking separate
  geometry, and brute stump caps lacking hidden-default metadata. Details are
  in `validate-production.json`; no supplied build.py/model.glb was altered.
- There are no actual action/vehicle/district data catalogs in this M0 main
  checkout yet. The reference scanner covers their declared literal asset/
  assetId fields and will gate new catalog references as those epics land.
- Atlas encoding requires KTX Software's `toktx` (`TOKTX_BIN`); it is absent
  here. Texture-free builds and fatal missing-encoder behavior are verified;
  an actual textured KTX2 asset was not produced in this lane.
- Native WebGPU performance, milestone-level placeholder ID passes, and the
  actual gore-probe scene await their integration/production epics.

Existing **needs-human** reviews (not regraded or edited):

- `char.corgi`: collar/ruff intersection and additional palette-token registration.
- `char.survivor-male`: final hero sculptural richness/art-quality sign-off.

## Commits

```
bc2b57a feat(assets): define manifest contracts and validate supplied GLBs
aa222a6 feat(assets): build deterministic fire-engine LODs and render contract-aware previews
0952781 build(assets): keep image tooling dependencies permissive
e2d565a feat(assets): bake instanced rigid crowds and enforce production readiness gates
67b9b9b feat(assets): bake palette AO and publish validated LOD and variant outputs
```

The final evidence/report commit follows these implementation commits. No push.

## Full-goal continuation audit

The committed lane remains clean and `main` remains at `2ffb7b7`. The main
checkout now has uncommitted per-asset batch edits. They were inspected
read-only, without copying or rebuilding their source files; they are not yet
available through the required merge of `main`.

`main-working-tree-audit.json` records 59 supplied export/LOD slots (excluding
the lane's fire-engine proof): 12 pass and 47 have findings. All three supplied
sedan-red and pickup-red LODs now pass this audit. Other findings still include
missing hero LODs/front markers, unregistered material tokens, malformed
geometry, changed dimensions against the declared contracts, missing crawler
part geometry, and brute caps without hidden-default metadata.

Full E17 completion remains unproven: only the fire engine is integrated in
the manifest; there are no milestone-level placeholder ID-pass proofs or
gore-probe vision artifacts. AC09 was expressly assigned to later batches,
and existing standalone sources must remain unchanged in this lane. Those
batch outputs need to be committed, validated/integrated with inventory sync,
and accompanied by their milestone/gore evidence before the full goal can be
achieved. Passing readiness guards do not replace these requirements.

Additional main-only exports are present for sedan-white, house-a/b/c, porch
stairs, Joe's diner, mainstreet brick and pharmacy/clinic. Their presence is
recorded in the audit, but presence alone does not establish validation,
integration or milestone photo-spot completion.
