# Phone stress performance — incomplete handoff

Baseline: c81ea8ec (merged main / perf-sweep). Work stopped at the orchestrator's request on 2026-10-14. The persistent reservation and all its descendants were terminated; all four browser slots are released. No further timing run was started after that instruction.

**The overall goal is not complete.** L7 meets the requested margin in the latest measured implementation. L2/L3 still have failing windows. A complete L1–L10 run and full verification of the final commit remain outstanding.

## Measurement and results

Headless native Chrome, Apple M4 / ANGLE Metal, Pixel 7 touch, 390×844, 4× CDP CPU throttle, explicit low quality. Campaign render DPR remains 1.5; the existing dedicated L7 probe uses DPR 1. No automated WebGPU runs. Unchanged gates: frame p95 33.3 ms; sim tick p95 6 ms; 300 draws; 500,000 triangles. The probes retain their original heap units and limits. L7 margin gate is 29.97 ms.

### Dedicated L7 rocket/fire stress

| Implementation | Frame p50 | Frame p95 | Headroom below 33.3 ms |
| --- | ---: | ---: | ---: |
| Baseline | 18.4 ms | 34.3 ms | fails |
| Candidate 26 | 13.7 ms | 19.7 ms | 40.8% |
| Candidate 28, latest retained runtime | 13.7 ms | **18.8 ms** | **43.5%** |

Every row retains 100 peak infected, 28 fires at start and end, seven rockets, 125 draws and 208,248 triangles. Candidate 28 sim tick p95 is 3.4 ms; retained heap is 236.24 MiB. Raw evidence: [baseline](stress-before/district-perf-low.json), [candidate 26](stress-candidate26/district-perf-low.json), [candidate 28](stress-candidate28/district-perf-low.json). These are successive implementations, not two repetitions of an identical final commit. The scheduled final window should repeat L7 twice.

### Latest retained-runtime problem windows

| Level / coverage | Worst frame p95 | Worst sim tick p95 | Status |
| --- | ---: | ---: | --- |
| L2, all 9 camera windows | 34.2 ms | 5.4 ms | frame fails |
| L3, all 9 camera windows | 34.7 ms | 6.2 ms | frame and sim fail |

See [L2](candidate28-l2/L2-low-webgl.json) and [L3](candidate28-l3/L3-low-webgl.json). Draws, triangles and heap pass in those windows. Final runtime retains candidate 28's 160 CSS-pixel animation cutoff; the later 200-pixel experiment was reverted.

### Last complete campaign matrix: intermediate candidate 18

This is **historical diagnostic coverage**, not acceptance of the final commit. It visits 131 windows, including all 46 L10 photos/checkpoints.

| Level | Windows | Worst frame p95 | Worst sim p95 | Maximum heap, MB |
| --- | ---: | ---: | ---: | ---: |
| L1 | 10 | 16.6 | 4.7 | 80.27 |
| L2 | 9 | 34.6 | 5.4 | 84.04 |
| L3 | 9 | 35.0 | 5.9 | 91.65 |
| L4 | 13 | 34.3 | 5.0 | 78.28 |
| L5 | 10 | 34.4 | 4.2 | 77.71 |
| L6 | 8 | 13.1 | 2.8 | 56.85 |
| L7 | 1 | 33.3 | 3.3 | 72.32 |
| L8 | 8 | 17.4 | 5.6 | 106.23 |
| L9 | 7 | 21.0 | 4.3 | 243.09 |
| L10 | 46 | 35.0 | 5.4 | 450.53 |

[Raw complete intermediate matrix](candidate18-full/). Its L10 heap regression came from an experimental 1 m ground grid. Restoring the original 2 m grid brought the opening to about 174 MB; perimeter instancing later reduced it to about 163 MB. All 46 L10 windows still need remeasurement after those fixes. Iteration summaries, including rejected experiments, are preserved in [iterations.json](iterations.json).

## Retained changes and profile evidence

- Crowd contacts and IK reuse already-current matrices; sibling joints share inverse parents. Private quaternion-only pose bones avoid Euler synchronization. Rigid decorations and ordinary arms retain atlas matrices; throw/chest-beat layers acquire joint TRS when needed. Numerical oracles cover layers, scales, reflections and world matrices.
- Low ordinary far-band figures below 160 rendered CSS pixels use authored GPU gait outside the melee contact ring plus 17 cm. Nearby figures, actions, reactions, specials and rising bodies remain procedural. Barely moving ordinary phone figures can hold their complete world pose on alternate frames for less than 25 ms with at most 5 cm displacement; clip changes solve immediately. Geometry LOD and all crowd/effect counts remain intact.
- Armed pedestrians' CPU aim mirror loads the torso branch and ancestors, rather than the complete skeleton. Exact Float32 comparisons cover carry, aim, recoil and hand props across three authored NPC models. Pose-row interpolation computes frame bounds once per row.
- Drawn-ground queries reject triangles using conservative bounds and cache only proven uniform flat support. The original 2 m cell size is retained. [L2 ground profile](candidate10-l2-profile/).
- Character contact queries cache eligible positions in the existing bucket order, retaining updates/removal/reuse semantics. Exact multi-tick horde comparisons pass. [Query profiles](candidate17-l3-profile/).
- Static hit queries traverse the crossed 8 m cells with a conservative DDA and closest-hit early exit. Padded queries retain the original path. Numerical comparisons cover 5,000 rays, ties and edges. [L3 combat profile](candidate10-l3-profile/).
- Footprint rasterization marks touched rows once and skips zero-coverage arithmetic; existing reconstructed-upload digests remain unchanged. Tyre/occupant contacts avoid redundant full-vehicle hierarchy walks; matrix and hand-contact oracles pass.
- L2 prefetch previously consumed 23.1 MB of response data during a measured window. The same requests/concurrency now run in a dedicated worker and consume native blobs. Unit tests and a real headless worker download/cleanup test passed. [Prefetch diagnostic](candidate14-l2-profile/).
- Lighting's existing sun/spot selection is preserved rather than accidentally enabling a second night shadow map. The renderer shares one scene matrix update with nested shadow passes. Material/view uniforms use their appropriate shared render scopes. Desktop effects remain enabled.
- L10's perimeter contained 4,316 individual rail/post meshes; L3's contained 528. Repeated posts now share their original geometry/material in 16 m spatial instance batches. Every post, rail, placement and shadow setting is retained; disposal is tracked. [Scene census](census24-l10/L10-low-webgl.json). The experimental generic renderer traversal hook was removed.

No budgets, population caps, content counts or desktop effects were reduced. No dependencies or protected source/art directories were changed.

## Remaining profile finding

Latest profiles still show crowd pose correction, renderer submission/uniform updates and contact queries as substantial costs: [L3 profile](candidate26-l3-profile/), [L10 profile](candidate26-l10-profile/), [per-figure animation eligibility](candidate27-policy/L3-low-webgl.json).

The detailed draw breakdown identifies **36 NPC shadow submissions in L3 and 35 in L10**, alongside existing shared contact shadows. These are exact NPC counts; the broader shadow category also contains other passes. Corgi rigid-part batching is currently enabled only in L7; reusing that established batching elsewhere is a promising follow-up that can preserve detailed shadows. A phone-only blob-shadow experiment was withdrawn before native timing and is **not committed**. NPC shadow behavior remains unchanged in this candidate.

Other rejected experiments: MSAA removal, a longer pose-hold interval, a smaller ground grid, removing the animation geometry-band guard, and a 200-pixel gait cutoff. Reducing render DPR did not help L2 (34.0 ms at DPR 1 versus 33.6 ms at DPR 1.5); the original resolution remains. [DPR 1](candidate26-dpr1/L2-low-webgl.json), [DPR 1.5](candidate26-dpr15/L2-low-webgl.json).

## Automatic quality and baseline assets

The unchanged existing T-E18-04-browser passed on the fresh merged baseline: high→low in **5,103 ms** under its synthetic 30 ms load, stayed low after load removal, recovered on the next scenario start, and restored 32 audio voices. [Evidence](adaptive.json). No Quality policy change was necessary. It still needs a final-commit rerun.

Both asset failures were already fixed on main before this lane's edits:

- 23107e4e: regenerate rebuilt turbine-hall collision data.
- 8f01bb4d: regenerate physics metadata against current collision data.

Targeted confirmation passed 5/5. A complete intermediate unit run passed 1,415 tests with seven skipped, including the asset validator and derived-asset checks. No asset rebake is included in this commit.

## Validation performed / outstanding

- Latest retained runtime: 299 focused render tests passed; typecheck, lint and build passed on the corresponding late candidates. [Logs](validation/). The final report and E18 command-selection cleanup were not followed by another run after the stop instruction.
- Last complete unit suite: intermediate candidate 12, 1,415 passed / seven skipped. [Summary](validation/full-unit-candidate12-summary.txt). **A full suite on the final commit remains outstanding.**
- Native L7 margin and latest L2/L3 measurements are above. No final all-level green result is claimed.
- Final authored stress/transition probes, corrected touch L9 routes, phone Mega Alpha probe, latest desktop visual regressions, automatic quality, and full E18 verification remain outstanding.
- An earlier E18 verification selected unsupported remote WebGPU smoke cases: 11 WebGL functional cases passed and five WebGPU cases failed. Selection now follows the manual-WebGPU policy and serializes E18 native browser tests. The corrected verification was not rerun.
- E25 night-eye readability failed identically on main and the earlier candidate, with identical measured pixels/contrast; the duplicate-shadow-map fix passed its native hero-shadow check. [Baseline comparison](visual-comparison/comparison.json). Latest rendering changes still need the normal visual regression run.

## Scheduled-window reproduction

The orchestrator supplies the quiet window. These commands use normal finite browser locks; **no persistent reservation worker is required**. Keep source fixed across the campaign and authored probes; some existing tools rebuild dist.

    npm run typecheck
    npm run lint
    npm run test:unit -- --maxWorkers=2
    npm run build

    E2E_PORT=3493 L7_PHONE_MARGIN=1 L7_PERF_OUTPUT=docs/reports/phone-perf/final-l7 \
      sh tools/e2e-lock.sh npx playwright test tests/perf/l7-district.spec.ts \
      --project=chromium --workers=1 --grep 'district low'

    E2E_PORT=3493 SWEEP_PHONE=1 SWEEP_PHASE=final SWEEP_ASSERT_BUDGETS=1 \
      sh tools/e2e-lock.sh npx playwright test tests/perf/campaign-sweep.spec.ts \
      --project=chromium --workers=1

    E2E_PORT=3495 SCENE_PORT=3496 MI_VERIFY_REMOTE_SIM=1 MI_VERIFY_REMOTE_BROWSER=1 \
      SWEEP_PHONE=1 SWEEP_PHASE=verify SWEEP_ASSERT_BUDGETS=1 npm run verify -- E18

For existing authored phone probes, set PHONE_PERF=1, project pixel-7 and workers=1; select the low or explicit phone cases and WebGL cases. The separate L3/L8 phone cases duplicate their desktop-low variants, so those variants need not be run twice. Relevant specs: L1 street/horde; L2–L6 budgets; L7 rocket/encounters; L8 budgets; L9 dress/handover; L10 district/campus/arena/Alpha contracts.

    SCENE_SERVER=preview SCENE_PORT=3494 L9_PROFILE=phone L9_SKIP_MEMORY=1 \
      L9_OUTPUT=docs/reports/phone-perf/final-l9 npx tsx tools/l9/streaming-perf.ts
    SCENE_SERVER=preview SCENE_PORT=3494 MEGA_PHONE=1 \
      MEGA_OUTPUT=docs/reports/phone-perf/final-mega npx tsx tools/scenelab/mega-moves-performance.ts

Real-device iOS/Android acceptance and WebGPU remain manual; these emulated measurements do not certify a physical phone.
