# E17 asset pipeline report — 2026-10-05

The authorized E17-AC01–AC08 pipeline/fire-engine increment is complete.
AC09 milestone production and AC11 infected gore-probe vision are assigned to
later production batches by the orchestrator. They remain pending, and
`specs/status.json` deliberately records E17 as `in-progress`.

## Delivered and acceptance evidence

| Criterion | Result | Evidence |
| --- | --- | --- |
| AC01 | PASS | Two real Blender exports have equal raw geometry hashes; injected script errors are fatal (`build.test.ts`) |
| AC02 | PASS | Geometry, dimensions, materials, naming, front markers, budgets and all three fire-engine LODs validate; independent negative cases fail |
| AC03 | PASS | Actual join/quantize/meshopt roundtrip preserves named parts and world pivots within 1 mm; texture-free and fatal encoder-failure paths tested |
| AC04 | PASS | Legacy dimensions match; five screenshots and comparison receive checklist C PASS in `review.md` |
| AC05 | PASS | Cached/cloned registry, missing-art and below-integrated placeholders, LOD paths, catalog references, every supplied source export and E04 placeholder logs tested |
| AC06 | PASS | All 207 concrete inventory rows and their statuses match; registry has 223 unique IDs, including 16 additional supplied exports |
| AC07 | PASS | Source hierarchy and baked vertices at five clip times; 100 GPU instances use one draw per material and pass pose readback |
| AC08 | PASS | Five actual game-renderer views, toolbar hidden, occupied pixels between 10% and 80%; comparison generated |
| AC09 | PENDING | Later milestone asset-production batches; readiness rejection tests do not certify finished production |
| AC10 | PASS (tooling) | Final-review gate requires evidence and comparison; negative review cases rejected. Existing needs-human reviews remain pending |
| AC11 | PENDING | Hidden-cap/detachment readiness tests pass; actual infected gore-probe vision evidence belongs to later production batches |

`acceptance.json` maps every AC01–AC08 ID to passing tagged tests. AC09/AC11
are explicitly pending; their passing readiness tests are not counted as
completed production or vision.

The implementation extends the existing renderer, loaders and test API and
adapts Bruno references. It includes Blender palette/primitives, pivots,
sockets, colliders, decay, AO/export helpers; a staged three-LOD build;
contract validation/optimization; registry/material/placeholder integration;
rigid crowd bake and shader; preview/crop/turntable tools; and authoring/review
templates. Runtime crowd updates change one scalar uniform without per-frame
array allocations. Blender uses three threads, four shared global slots and
one CPU Cycles render slot using the reference lock protocol.

## Final verification

Pinned main `b3c4e07` is merged through `da91b4e`, including E02 camera/rendering,
E03 input and E04 survivor behavior. Integration commits `7a77925` and
`2a0c3f1` register supplied sources and enforce the required below-integrated
placeholder rule for survivor art. Code rigs preserve animation, gear,
selection and cleanup behavior; integrated art loads via manifest URLs.
The E04 extra GLB-only assertion now follows asset status; its conditional
vision test records pending placeholders rather than reusing a GLB art review.
No E04 acceptance criterion was changed. E01–E04 retain their done statuses.

All required gates exit 0 with no new warnings:

| Command | Result | Evidence |
| --- | --- | --- |
| `npm run typecheck` | 0 | `finish/logs/typecheck.log`, also rerun by verify |
| `npm run lint` | 0 | `finish/logs/lint.log`, also rerun by verify |
| `npm run build` | 0 | `finish/logs/build.log`, `finish/logs/artifacts-build.log` |
| `npm run test:unit` | 0; 43 tests / 19 files | `finish/logs/unit.log` |
| `E2E_PORT=3313 npm run test:smoke` | 0; 1 Vitest + 12 browser tests | `finish/logs/smoke.log` |
| `E2E_PORT=3313 npm run verify -- E17` | 0; 19 Vitest + 16 browser tests | `checks.json`, `vitest.json`, `finish/verify-browser.json`, `finish/logs/verify-E17.log` |
| `npm run test:sim` | 0; 13 tests | `finish/logs/sim.log` |
| `npm run assets:validate` | 0; three LODs | `validate.json`, `finish/logs/validate.log` |
| Final generated-asset browser capture | 0; 16 tests | `finish/artifacts-browser.json`, `finish/logs/artifacts-browser.log` |

Playwright uses two workers; Vitest caps threads at four. Production previews
use port 3313. After verify regenerated the GLBs, the final bundle was rebuilt
and its browser captures refreshed. Whole diff reviewed and whitespace checks
pass. No deployment, push, .env read or shared-3300 server operation occurred.
Main is pinned to the already-merged base as requested by the finish job.

Earlier merge regression evidence is retained under `merge/`: E01 verify
16 Vitest + 19 browser, E02 verify 6 Vitest + 26 browser, and E03 45 browser tests
passed. E04 placeholder integration passed 20 combined E04/E17/smoke browser
tests, including a 3,600-tick animation bot with zero missing mappings, movement,
selection, cleanup, five gear tiers and conditional pending-art vision. These
are historical checks on their recorded merge versions; current final checks
are listed above.

## Measurements

| Fire-engine tier | Triangles | Materials | Asset draws | KiB | X/Y/Z (m) |
| --- | ---: | ---: | ---: | ---: | --- |
| lod0 | 66335 | 11 | 39 | 3664.96 | 7.40000 / 3.55000 / 2.09997 |
| lod1 | 10821 | 11 | 39 | 873.63 | 7.34186 / 3.54062 / 2.09997 |
| lod2 | 2505 | 11 | 38 | 283.27 | 7.27126 / 3.51235 / 2.09997 |

LOD0 ceilings: 80,000 triangles, 40 static draws, 32 materials, 6,000 KiB;
LOD1 12,000 triangles; LOD2 4,000. Dimensions target 7.4 / 3.55 / 2.1 m ±5%.
Viewer presentation adds one draw/triangle (40 / 66,336).
Raw geometry hash: `56d574a236126f1b45e5b5604db9319b98d23fb71c212d2e6c9411d48844a93c`.
Hashing compares exact triangle positions/winding and named transforms,
independent of normal-induced vertex numbering and GLB serialization.
AO/normal serialization and lower-tier simplification vary slightly between
builds; raw and runtime LOD0 geometry hashes stay stable. Final lower tiers pass
all declared budgets. Committed GLBs and screenshots correspond to the last build.

Crowd: 100 instances, 8 materials, 8 asset draw calls; maximum pose error
7.49297796688e-08 m against a 0.02 m limit at five times; baked file 943.39 KiB.
Five screenshot coverages: 11.11%, 51.42%, 11.25%, 51.26%, 16.06%.
These are WebGL2/SwiftShader proofs; native WebGPU frame-time budgets were not
measured or inferred from software-renderer timings.

## Deviations and known issues

- AC09/AC11 production and vision increments remain pending by explicit
  orchestrator decision; E17 stays in-progress.
- Shared Blender queues exceeded the original 120-second integration-test
  timeout. `f190d85` allows 30 minutes including queue wait, without changing
  assertions. Final real-build tests pass.
- The outdated fire-engine inventory status was updated to integrated for
  the delivered registry/turntable proof. No acceptance criterion was weakened.
- All 63 supplied standalone source GLBs and available LODs are registered
  unchanged. The source audit inspects 140 export/LOD slots: 15 pass and 125
  have findings. Exit 1 is intentional for this findings audit, separate from
  the passing modeled/integrated-assets gate. Findings include missing LODs,
  front markers, palette names, dimensions, budgets, degenerate geometry,
  required separate parts and hidden cap metadata (`validate-production.json`).
  No supplied production build.py or source model was rewritten or rebuilt.
- The matte light trim is stylized rather than photographic chrome; hidden
  sides are inferred from the reference. All checklist C must/should items pass.
- Hero simplification ratios 0.12/0.035 follow the updated three-tier budgets.
- Textured atlas production requires absent `toktx` (`TOKTX_BIN`). Texture-free
  builds and fatal encoder failure are tested; no textured KTX2 asset was produced.
- Native WebGPU timing, milestone photo spots and gore-probe vision await
  their integration/production increments.
- Existing needs-human reviews remain unchanged: char.corgi collar/ruff and
  palette-token review; char.survivor-male final hero art-quality sign-off.

## Commits

Core implementation: `bc2b57a`, `aa222a6`, `0952781`, `e2d565a`, `67b9b9b`.
Merge/integration: `a09d09a`, `986d036`, `94b4d2a`, `23a7008`, `c6a66c0`,
`7a77925`, `da91b4e`, `2a0c3f1`. Final generated assets and evidence are committed
with this report. No push.

## Asset conformance follow-up

The production audit now has zero forward, missing-LOD, unknown-palette and degenerate-triangle findings across 163 slots. See [conformance/report.md](conformance/report.md) for pipeline changes, verification, reviewed screenshots, density exceptions and remaining source-contract findings.
